#!/bin/sh
# Polls for currently-used host ports from two sources, so the builder can
# warn about conflicts with already-running things, not just newly
# selected ones:
#
#   1. The Docker Engine API, over the socket mounted into this container —
#      catches ports published by regular (non-host-network) containers,
#      with the container's name attached to the warning.
#
#   2. The host's own /proc/net/{tcp,udp}{,6} files, if /proc is mounted in
#      (optional — see docker-compose.yml) — catches everything the API
#      above genuinely cannot see: ports bound by network_mode: host
#      containers (Docker doesn't track those at all) and non-Docker
#      processes. These show up unattributed (no container name), which
#      the frontend already renders as a generic "already taken" warning.
#
# Writes a plain JSON file into nginx's document root; the frontend fetches
# it directly as a static file. If neither source is available, this just
# keeps trying quietly — the frontend treats a missing/unreachable file as
# "no host-port info available" and falls back to the selected-services-only
# conflict check.

OUT=/usr/share/nginx/html/live-ports.json
TMP=/tmp/live-ports.json.tmp
DOCKER_TMP=/tmp/docker-ports.json.tmp
RAW_TMP=/tmp/raw-ports.ndjson.tmp
HOST_NET=/host/proc/1/net

# `unique` collapses the duplicate entries Docker returns when a port is
# published on both an IPv4 and IPv6 host address — same port, same
# container, we only care once. `ip` is Docker's own bind address for that
# publish, normalized so "0.0.0.0"/"::"/unset (all mean "every interface")
# all become "" — the one sentinel the frontend's conflict logic checks for,
# so a port bound to a specific IP is only ever flagged as a real conflict
# against that same IP or against something bound to every interface.
JQ_FILTER='[.[] as $c | ($c.Names[0] // "unknown" | ltrimstr("/")) as $name | ($c.Ports // [])[] | select(.PublicPort != null) | {host: .PublicPort, protocol: (.Type // "tcp"), container: $name, ip: (.IP as $ip | if ($ip == "0.0.0.0" or $ip == "::" or $ip == null or $ip == "") then "" else $ip end)}] | unique'

# Reads one /proc/net/{tcp,udp}[6] file and prints one JSON object per
# bound port (no container name — the caller only keeps the ones the
# Docker API above didn't already explain). $3 is the required socket
# state for TCP ("0A" = LISTEN); pass "" for UDP, where we instead treat
# "not connected to a specific remote peer" (remote address all-zero) as
# "listening".
read_raw_ports() {
  file="$1"
  proto="$2"
  need_state="$3"
  [ -r "$file" ] || return 0
  tail -n +2 "$file" 2>/dev/null | while read -r _sl local_addr rem_addr state _rest; do
    if [ -n "$need_state" ]; then
      [ "$state" = "$need_state" ] || continue
    else
      case "$rem_addr" in
        *:0000) ;;
        *) continue ;;
      esac
    fi
    port_hex="${local_addr##*:}"
    case "$port_hex" in
      ""|*[!0-9A-Fa-f]*) continue ;;
    esac
    port_dec=$((16#$port_hex))
    # ip is deliberately always "" (all interfaces) here rather than the
    # real bound address — un-reversing /proc's little-endian hex IPv4
    # isn't worth the shell complexity for this already-best-effort
    # fallback, and treating it as "every interface" is the safe direction
    # to be wrong in: it can only cause an extra conflict warning, never
    # miss a real one.
    printf '{"host":%d,"protocol":"%s","ip":""}\n' "$port_dec" "$proto"
  done
}

while true; do
  if curl -s --max-time 3 --unix-socket /var/run/docker.sock http://localhost/containers/json 2>/dev/null \
      | jq -c "$JQ_FILTER" > "$DOCKER_TMP" 2>/dev/null; then

    : > "$RAW_TMP"
    read_raw_ports "$HOST_NET/tcp" tcp "0A" >> "$RAW_TMP"
    read_raw_ports "$HOST_NET/tcp6" tcp "0A" >> "$RAW_TMP"
    read_raw_ports "$HOST_NET/udp" udp "" >> "$RAW_TMP"
    read_raw_ports "$HOST_NET/udp6" udp "" >> "$RAW_TMP"

    if [ -s "$RAW_TMP" ] && jq -s -c '.' "$RAW_TMP" > "$RAW_TMP.json" 2>/dev/null; then
      # Only keep raw entries for ports the Docker API didn't already
      # attribute to a named container — that list always wins.
      jq -s -c '
        .[0] as $docker | .[1] as $raw
        | ($docker | map([.host, .protocol])) as $known
        | $docker + [ $raw[] | select([.host, .protocol] as $k | ($known | any(. == $k)) | not) ]
      ' "$DOCKER_TMP" "$RAW_TMP.json" > "$TMP" 2>/dev/null && mv "$TMP" "$OUT"
      rm -f "$RAW_TMP.json"
    else
      mv "$DOCKER_TMP" "$OUT"
    fi
  fi
  sleep 5
done
