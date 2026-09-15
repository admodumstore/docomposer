#!/usr/bin/env python3
"""
Backend for two optional features, both gated on the same switch:

  - The "Deploy" button: writes the compose YAML the browser generated to
    DEPLOY_BASE_DIR/<project>/ and runs `docker compose up -d` for it,
    using the Docker socket mounted into this container.
  - The container dashboard (dashboard.html): list/start/stop/restart/
    remove/view-logs for *any* container on the host, via the same socket.

Both are on whenever DEPLOY_BASE_DIR is set (in docker-compose.yml) and
mounted into the container at that same path — see the guide's "Deploying"
section, or the snippet builder there. There's no login: mounting the
Docker socket already hands this container the ability to control every
container on the host, so a password in front of a second door to the same
room wouldn't add real protection — only run this with DEPLOY_BASE_DIR set
on a host/network you trust, same rule as the socket mount itself.

Talks to the Docker Engine API directly over the socket (no docker CLI
needed for any of this — only `docker compose up` still shells out, since
reimplementing compose's own orchestration would be a much bigger job).
Listens on 127.0.0.1 only; nginx proxies /api/ to it, so it's never
reachable directly from outside this container.
"""
import http.server
import json
import os
import re
import select
import socket
import http.client
import subprocess
import time
import urllib.parse

DEPLOY_BASE_DIR = os.environ.get("DEPLOY_BASE_DIR", "")
PORT = 8181

PROJECT_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
MAX_BODY_BYTES = 2_000_000
DEPLOY_TIMEOUT = 300

# Separates the streamed `docker compose up` output from the final result
# JSON at the end of an /api/deploy response — a NUL byte never appears in
# that output, so the frontend can split on it unambiguously.
RESULT_MARKER = "\x00RESULT\x00"


def deploy_enabled():
    return bool(DEPLOY_BASE_DIR) and os.path.isdir(DEPLOY_BASE_DIR)


# ---- talking to the Docker Engine API over the socket (stdlib only) ------

class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, sock_path):
        super().__init__("localhost")
        self.sock_path = sock_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(15)
        self.sock.connect(self.sock_path)


def docker_api(method, path, body=None):
    conn = UnixHTTPConnection("/var/run/docker.sock")
    try:
        headers = {}
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        return resp.status, data
    finally:
        conn.close()


def docker_api_json(method, path, body=None):
    status, data = docker_api(method, path, body)
    try:
        parsed = json.loads(data) if data else None
    except Exception:
        parsed = None
    return status, parsed



# Runs a subprocess, calling emit(line) with each line of its combined
# stdout+stderr as it's produced (for streaming to the browser), while
# still enforcing an overall timeout — select() lets the deadline be
# checked between reads instead of only after the whole thing finishes,
# the way subprocess.run(timeout=...) would.
def stream_process(args, cwd, emit, timeout=DEPLOY_TIMEOUT):
    proc = subprocess.Popen(
        args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
    )
    deadline = time.monotonic() + timeout
    output_lines = []
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                proc.kill()
                proc.wait()
                raise subprocess.TimeoutExpired(args, timeout)
            ready, _, _ = select.select([proc.stdout], [], [], min(remaining, 1.0))
            if not ready:
                continue
            line = proc.stdout.readline()
            if line == "":
                break  # EOF — process closed stdout, it's finishing up
            output_lines.append(line)
            emit(line)
        proc.wait(timeout=max(0.0, deadline - time.monotonic()) + 5)
    finally:
        proc.stdout.close()
    return proc.returncode, "".join(output_lines)


def demux_docker_log(data):
    # Non-tty containers' logs come back frame-multiplexed: an 8-byte
    # header (stream type + big-endian length) before each chunk of text.
    # Tty containers (checked by the caller) send plain text instead.
    out = []
    i = 0
    while i + 8 <= len(data):
        size = int.from_bytes(data[i + 4:i + 8], "big")
        i += 8
        out.append(data[i:i + size].decode("utf-8", errors="replace"))
        i += size
    return "".join(out)


def container_logs(name, tail):
    status, info = docker_api_json("GET", f"/containers/{urllib.parse.quote(name)}/json")
    if status != 200:
        return None
    tty = bool(info.get("Config", {}).get("Tty"))
    qs = urllib.parse.urlencode({"stdout": 1, "stderr": 1, "tail": tail, "timestamps": 0})
    log_status, raw = docker_api("GET", f"/containers/{urllib.parse.quote(name)}/logs?{qs}")
    if log_status != 200:
        return None
    return raw.decode("utf-8", errors="replace") if tty else demux_docker_log(raw)


CONTAINER_NAME_RE = re.compile(r"^\s*container_name:\s*(\S+)\s*$", re.MULTILINE)


# A network_mode: host container publishes nothing Docker tracks as a
# port mapping — the summary list's Ports is just empty for these. The
# ports it actually uses are whatever its image EXPOSEs, since host
# networking means container port == host port; Config.ExposedPorts on
# the full inspect is the closest thing to ground truth available.
# Formatted as "port:port/proto" — a self-mapping — so callers can reuse
# the same "host:container/proto" parsing they already use for published
# ports.
def _host_network_ports(container_id):
    status, info = docker_api_json("GET", f"/containers/{urllib.parse.quote(container_id)}/json")
    if status != 200 or not info:
        return []
    exposed = ((info.get("Config") or {}).get("ExposedPorts")) or {}
    ports = []
    for key in exposed:
        port, _, proto = key.partition("/")
        if port.isdigit():
            ports.append(f"{port}:{port}/{proto or 'tcp'}")
    return ports


def _ports_for(c):
    ports = list(dict.fromkeys(
        f"{p['PublicPort']}:{p['PrivatePort']}/{p.get('Type', 'tcp')}"
        for p in c.get("Ports", []) if p.get("PublicPort")
    ))
    if not ports and (c.get("HostConfig") or {}).get("NetworkMode") == "host":
        ports = _host_network_ports(c["Id"])
    return ports


# First host port, if any (published, or inferred for network_mode: host
# — see _ports_for) — lets the frontend link straight to the
# already-running container instead of just naming it.
def _first_host_port(c):
    ports = _ports_for(c)
    if not ports:
        return None
    host_port = ports[0].split(":", 1)[0]
    return int(host_port) if host_port.isdigit() else None


# Checks by actual container name, not project label — the thing Docker
# itself enforces uniqueness on, and the thing that actually matches "is
# this service already running": a service redeployed under a *different*
# project name (e.g. once via "separate file per service", once via "one
# combined file", which default to different project names) is still the
# same container_name, so this catches it where a project-label check
# wouldn't.
def already_running(compose_text):
    names = CONTAINER_NAME_RE.findall(compose_text)
    found = []
    seen = set()
    for name in names:
        filters = json.dumps({"name": [f"^/{name}$"]})
        qs = urllib.parse.urlencode({"all": "true", "filters": filters})
        status, data = docker_api_json("GET", f"/containers/json?{qs}")
        if status != 200 or not data:
            continue
        for c in data:
            cname = c["Names"][0].lstrip("/") if c.get("Names") else name
            if cname in seen:
                continue
            seen.add(cname)
            found.append({"name": cname, "state": c.get("State", "?"), "port": _first_host_port(c)})
    return found


# Turns Docker's raw failure text into something a beginner can act on —
# the two cases actually seen in practice so far.
PORT_BIND_PATTERNS = [
    re.compile(r"Bind for [\d.:a-fA-F]*:(\d+) failed: port is already allocated"),
    re.compile(r"listen tcp[46]? [\d.:a-fA-F]*:(\d+): bind: address already in use"),
]

NAME_CONFLICT_PATTERN = re.compile(r'The container name "/([^"]+)" is already in use')


def explain_failure(stderr):
    stderr = stderr or ""
    for pattern in PORT_BIND_PATTERNS:
        match = pattern.search(stderr)
        if match:
            port = match.group(1)
            return (
                f"Port {port} is already in use on the host by something DoComposer couldn't see in "
                f"advance. Edit the port and try again."
            )
    match = NAME_CONFLICT_PATTERN.search(stderr)
    if match:
        name = match.group(1)
        return (
            f'A container named "{name}" already exists under a different project name. Deploy this '
            f'under that same project name to update it in place, or remove the existing one from the '
            f"Dashboard first."
        )
    return "docker compose up failed — see the details below."


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _require_enabled(self):
        if not deploy_enabled():
            self._send(503, {
                "error": "Not enabled — set DEPLOY_BASE_DIR in docker-compose.yml (and mount it) to turn "
                         "this on. See the guide.",
            })
            return False
        return True

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        try:
            return json.loads(self.rfile.read(length))
        except Exception:
            return None

    # ---- routing -----------------------------------------------------

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path)
        parts = [p for p in path.path.split("/") if p]  # ['api', ...]

        if parts == ["api", "status"]:
            self._send(200, {"deployEnabled": deploy_enabled()})
        elif parts == ["api", "containers"]:
            if not self._require_enabled():
                return
            status, data = docker_api_json("GET", "/containers/json?all=true")
            if status != 200:
                self._send(502, {"error": "Couldn't reach the Docker API."})
                return
            containers = [{
                "id": c["Id"][:12],
                "name": c["Names"][0].lstrip("/") if c.get("Names") else c["Id"][:12],
                "image": c.get("Image", ""),
                "state": c.get("State", "?"),
                "status": c.get("Status", ""),
                "ports": _ports_for(c),
                "project": c.get("Labels", {}).get("com.docker.compose.project", ""),
            } for c in (data or [])]
            containers.sort(key=lambda c: c["name"])
            self._send(200, {"containers": containers})
        elif len(parts) == 4 and parts[0:2] == ["api", "containers"] and parts[3] == "logs":
            if not self._require_enabled():
                return
            name = urllib.parse.unquote(parts[2])
            tail = path.query and urllib.parse.parse_qs(path.query).get("tail", ["200"])[0] or "200"
            if not re.match(r"^\d{1,5}$", tail):
                tail = "200"
            logs = container_logs(name, tail)
            if logs is None:
                self._send(404, {"error": "Container not found or logs unavailable."})
                return
            self._send(200, {"logs": logs[-100_000:]})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]

        if parts == ["api", "deploy", "check"]:
            self._handle_deploy_check()
            return

        if parts == ["api", "deploy"]:
            self._handle_deploy()
            return

        if len(parts) == 4 and parts[0:2] == ["api", "containers"] and parts[3] in ("start", "stop", "restart"):
            if not self._require_enabled():
                return
            name = urllib.parse.unquote(parts[2])
            status, _ = docker_api("POST", f"/containers/{urllib.parse.quote(name)}/{parts[3]}")
            if status in (204, 304):
                self._send(200, {"ok": True})
            else:
                self._send(502, {"error": f"Docker API returned {status}."})
            return

        self._send(404, {"error": "not found"})

    def do_DELETE(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        if len(parts) == 3 and parts[0:2] == ["api", "containers"]:
            if not self._require_enabled():
                return
            name = urllib.parse.unquote(parts[2])
            status, _ = docker_api("DELETE", f"/containers/{urllib.parse.quote(name)}?force=true")
            if status == 204:
                self._send(200, {"ok": True})
            else:
                self._send(502, {"error": f"Docker API returned {status}."})
            return
        self._send(404, {"error": "not found"})

    # ---- deploy --------------------------------------------------------

    # Cheap pre-flight the frontend calls before actually deploying, so it
    # can ask "this is already running, update it in place?" *before*
    # anything happens, instead of finding out from the result afterward.
    def _handle_deploy_check(self):
        if not self._require_enabled():
            return

        data = self._read_json_body()
        if data is None:
            self._send(400, {"error": "invalid request body"})
            return
        compose = str(data.get("compose", ""))
        if not compose.strip():
            self._send(400, {"error": "empty compose file"})
            return

        self._send(200, {"alreadyRunning": already_running(compose)})

    # Streams `docker compose up`'s output to the browser line by line as
    # it happens, ending with one RESULT_MARKER-prefixed JSON blob once
    # it's done — see stream_process() and nginx-default.conf's
    # proxy_buffering off (without that, nginx would sit on the whole
    # response until the end anyway). Validation errors below still
    # return a plain JSON response; only a validated, in-progress deploy
    # streams.
    def _handle_deploy(self):
        if not self._require_enabled():
            return

        data = self._read_json_body()
        if data is None:
            self._send(400, {"error": "invalid request body"})
            return

        project = str(data.get("project", "")).strip()
        compose = data.get("compose", "")
        env_text = data.get("env", "")

        if not PROJECT_NAME_RE.match(project):
            self._send(400, {"error": "invalid project name — use lowercase letters, numbers, - and _ only"})
            return
        if not str(compose).strip():
            self._send(400, {"error": "empty compose file"})
            return

        already_running_containers = already_running(compose)
        project_dir = os.path.join(DEPLOY_BASE_DIR, project)

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")  # belt-and-suspenders alongside the nginx config
        self.end_headers()

        def emit(text):
            try:
                self.wfile.write(text.encode("utf-8", errors="replace"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass  # browser navigated away mid-deploy — docker compose keeps running regardless

        try:
            os.makedirs(project_dir, exist_ok=True)
            compose_path = os.path.join(project_dir, "docker-compose.yml")
            env_path = os.path.join(project_dir, ".env")
            with open(compose_path, "w") as f:
                f.write(compose)
            with open(env_path, "w") as f:
                f.write(env_text)

            returncode, output = stream_process(
                ["docker", "compose", "-f", compose_path, "--env-file", env_path, "-p", project, "up", "-d"],
                project_dir, emit,
            )
            ok = returncode == 0
            error = None if ok else explain_failure(output)

            if not ok:
                # `up` can create containers before it fails to start them
                # (e.g. a port conflict) — clean those up so the next
                # attempt isn't blocked by leftover half-created containers.
                subprocess.run(
                    ["docker", "compose", "-f", compose_path, "--env-file", env_path, "-p", project, "down"],
                    capture_output=True, text=True, timeout=120, cwd=project_dir,
                )

            result = {
                "ok": ok,
                "path": project_dir,
                "error": error,
                "alreadyRunning": already_running_containers,
            }
        except subprocess.TimeoutExpired:
            result = {"ok": False, "error": "docker compose up timed out after 5 minutes"}
        except Exception as e:
            result = {"ok": False, "error": str(e), "alreadyRunning": already_running_containers}

        emit(RESULT_MARKER + json.dumps(result))

    def log_message(self, fmt, *args):
        pass  # keep container logs quiet — nginx's own access log already covers requests


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
