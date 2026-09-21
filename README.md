# DoComposer

![DoComposer screenshot](DoComposer.png)

**[Try it live](https://admodumstore.github.io/docomposer/)** — runs entirely
in your browser, nothing to install just to take a look.

**A friendly starting point if you're new to Docker.** Pick a few self-hosted
services from a checklist, get back a working `docker-compose.yml` (or the
equivalent `docker run` commands, if you'd rather see exactly what's
happening). No accounts, no backend calling home, nothing leaves your
browser except when you deploy it yourself.

It's not trying to replace hand-writing compose files once you know what
you're doing — it's meant to save the hour of copy-pasting, typo-hunting,
and looking up "what port does Jellyfin use again?" that comes with wiring
up more than one container by hand, especially while you're still learning.
New to Docker entirely? Start with the
[in-app guide](https://admodumstore.github.io/docomposer/guide.html) — a
short, practical intro to what Docker is, how to install it, and how to
actually run what this tool builds for you. (Live host-port checking and
the Deploy/Dashboard features all need this tool's own backend running —
see [below](#live-host-port-checking-optional) — everything else, building
and downloading a compose file, works fine on the live demo above.)

## What it does

- **80+ services** across media, networking, productivity, security,
  monitoring, automation, AI/developer tools, and container-management
  categories, each with real project icons, a homepage link, and
  searchable tags.
- **Search and tag filtering**, plus an "Arr Stack" bundle (Sonarr, Radarr,
  Prowlarr, qBittorrent, SABnzbd, Lidarr, Readarr, a dashboard and a request
  manager) you can add in one click and then exclude individual pieces from.
- **Editable Settings panel** — every environment variable, volume mount,
  and port is editable before you download anything: change a password
  placeholder, point a volume at your own folder, add extra volumes/ports
  a service doesn't ship with by default, or override a default port —
  including an optional **bind IP** per port, so a service can be pinned to
  `127.0.0.1` or a specific LAN address instead of every interface, which
  is what an unqualified `host:container` port binds to by default.
- **Two output formats** — a `docker-compose.yml` + `.env` pair, or the
  same setup as plain `docker run` commands, toggled per file.
- **Port-conflict detection**, IP-aware (the same host port is fine on two
  different bind IPs, but not on the same one twice), including
  (optionally) against containers *already running* on the host — see
  [Live host-port checking](#live-host-port-checking-optional).
- **Real startup ordering for services with a database** — Nextcloud,
  Immich, Authentik, Documenso, Dawarich, WordPress and a few others
  generate a `healthcheck:` on their database/cache container plus
  `depends_on: … condition: service_healthy` on the service that needs it,
  so the app actually waits for the database to accept connections, not
  just for its container process to have started. Compose-only — the
  plain `docker run` script still starts the database first, just without
  waiting for it to report healthy.
- A **beginner's guide** (`guide.html`) covering installing Docker on
  Windows/macOS/Linux, running the generated files, opening the result in a
  browser, deploying straight from the browser, and GUI alternatives
  (Dockge, Portainer) if you'd rather not touch a terminal at all — plus a
  small builder of its own for the `DEPLOY_BASE_DIR` snippet this tool's
  *own* `docker-compose.yml` needs.

## Try it

Open `index.html` directly in a browser, or serve the folder with any
static file server (`python3 -m http.server`, VS Code's Live Server, etc).
Live host-port checking won't be available this way — see below.

## Running it as a Docker container (in your own homelab)

There's a bit of irony in running a docker-compose generator inside Docker,
but it works fine:

```bash
docker compose up -d
```

This pulls the prebuilt image from GitHub Container Registry
(`ghcr.io/admodumstore/docomposer`, built for `amd64` and `arm64` by
[the repo's own Actions workflow](.github/workflows/docker-publish.yml)) —
no local build needed. If you're customizing `services.js` or anything
else in this checkout, uncomment the `build: .` line in `docker-compose.yml`
and run `docker compose up -d --build` instead to build from your own copy.

Then visit `http://<your-server-ip>:8190`. To change the port, edit the
left side of the `ports` mapping in `docker-compose.yml` (e.g. `"9000:80"`).

If you'd rather use plain `docker run`:

```bash
docker run -d --name docomposer \
  -p 8190:80 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --restart unless-stopped \
  ghcr.io/admodumstore/docomposer:latest
```

Or building from source instead of pulling:

```bash
docker build -t docomposer .
docker run -d --name docomposer \
  -p 8190:80 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --restart unless-stopped \
  docomposer
```

### Live host-port checking (optional)

The shipped `docker-compose.yml` mounts `/var/run/docker.sock` into the
container so a small background script (`poll-ports.sh`) can poll the
Docker Engine API for currently-published ports and warn if a service you
pick collides with something already running — not just with other
services in your current selection.

**This is optional but not risk-free.** A bind-mounted Docker socket
carries full API access regardless of whether the mount has a `:ro` flag —
that flag only affects filesystem operations on the socket file itself, not
which API calls can go through it. Only run this with the socket mounted on
a host you trust, the same rule as any tool that asks for it (Portainer,
Dockge, Portracker). If you'd rather not grant that, just remove the
`volumes:` block from `docker-compose.yml` — everything else works
identically, you just lose the "already running on this host" half of the
port check.

The Docker API has one real blind spot even with the socket mounted: it
reports **no** port information at all for containers using
`network_mode: host`, and obviously nothing for non-Docker processes
either. There's a second, also-optional mount that closes that gap —
`/proc:/host/proc:ro` — which lets the poller read the host's real
listening ports directly, the same technique tools like Portracker use.
It's read-only and only ever used to read port numbers/state, but it is
more host visibility, so it's opt-in separately from the socket above.

### Deploying directly, and the Dashboard (optional)

Each `docker-compose.yml` output has a **Deploy** button next to Copy that
runs `docker compose up -d` for it immediately, on the host DoComposer
itself is running on — no copy-pasting into a terminal or another tool.
Clicking it asks for a project name (pre-filled from the service's own
name), checks whether it's already running under a different name first,
then replaces the compose preview in place with `docker compose up`'s
output, streaming live and growing to fit the whole log rather than
capping it behind an internal scrollbar — a successful deploy adds an
**Open** button straight to the service's own web UI, right below it.

There's also a **Dashboard** tab listing every container on the host —
not just ones DoComposer deployed — with start/stop/restart/remove/logs,
an IP Address and Ports column (each host port individually clickable,
opening straight to it), and a Health column reflecting Docker's own
healthcheck status where one's configured (`N/A` where it isn't, for any
container on the host, not just ones this tool generated). The direct
"open" link on a container's name picks whichever port is actually its
web UI, not just whatever port Docker happens to list first — including
containers that share another container's network namespace entirely
(the arr-stack-behind-a-VPN-gateway pattern), resolved via known
Servarr/LinuxServer env-var conventions where possible. For the rare case
nothing can be resolved automatically (Sabnzbd, notably — its port lives
only in its own config file, invisible to the Docker API), a small link
icon next to each row lets you set the port/scheme by hand; that override
is stored server-side, so it's remembered for every device that opens the
dashboard, not just the browser that set it.

Both are off by default, and both turn on together from one setting:

- **`DEPLOY_BASE_DIR`** — an absolute path on your host (e.g.
  `/home/youruser/docker-stacks`) where deployed stacks get written, one
  folder per project name. It has to be added to `volumes:` too, mounted at
  the *identical* path inside the container. This isn't just tidiness:
  Docker resolves the `./relative` volume paths in your compose files
  against that folder, but the actual bind mount is created by your host's
  Docker daemon — which only understands host paths. Mounting the same
  absolute path on both sides is what makes the two line up. The in-app
  guide has a small builder that generates both lines together so they
  can't drift apart.

**There's no login.** Mounting the Docker socket (already required for
live host-port checking) already gives this container the ability to
start, stop and remove anything on the host, so a password in front of
Deploy/Dashboard wouldn't add real protection on top of that — only set
`DEPLOY_BASE_DIR` on a host/network you actually trust, the same rule as
the socket mount itself.

If a project you're deploying is already running, the result banner says
so explicitly instead of just silently updating it. Deployed files stay in
`DEPLOY_BASE_DIR/<project-name>/` afterward — a normal compose project you
can `docker compose down`, edit, or hand off to Dockge/Portainer to manage
going forward, same as anything you'd deployed by hand. The Dashboard,
unlike Deploy, isn't limited to stacks DoComposer deployed — it shows and
controls every container the socket can see.

## How it's organized

- `services.js` — the data model and the actual logic. Every service is
  one object: image, ports, volumes, environment variables, tags, a
  homepage link, and optional `dependsOn` for services needing a companion
  container (Nextcloud → MariaDB, Immich → Postgres/Redis/ML, ...). This
  file also builds the compose YAML and `docker run` script, and resolves
  port conflicts.
- `app.js` — all DOM wiring: the checklist, search/tags, the Settings
  panel (including the add-volume/add-port forms), tab switching, and the
  live host-port poll.
- `index.html` / `style.css` — structure and look for the builder page.
- `guide.html` — the standalone beginner's guide, linked from the header.
- `dashboard.html` / `dashboard.js` — the optional container dashboard
  (list/start/stop/restart/remove/logs for every container on the host).
- `nav.js` — grays out the header's Dashboard tab when it isn't enabled.
- `poll-ports.sh` / `deploy-server.py` / `start.sh` — the background port
  poller, the optional deploy + dashboard backend, and the container
  entrypoint that starts both alongside nginx.
- `nginx-default.conf` — adds the `/api/` proxy to `deploy-server.py` on
  top of nginx:alpine's normal static-file defaults, with buffering off
  so the Deploy button's streamed output actually arrives live rather
  than all at once at the end.
- `Dockerfile` / `docker-compose.yml` — packages the whole thing as a
  static site served by nginx, plus the poller's dependencies (`curl`,
  `jq`) and the deploy backend's (`docker-cli`, `docker-cli-compose`,
  `python3`).
- `favicon.svg` — the header logo, reused as the browser tab icon.
- `.github/workflows/docker-publish.yml` — builds and publishes this
  image to GitHub Container Registry (`ghcr.io/admodumstore/docomposer`)
  on pushes to `main` and version tags, for `amd64` and `arm64`.
- `scripts/catalog-refs.mjs` / `.github/workflows/catalog-drift.yml` — a
  daily check for catalog entries that may have gone stale (an image
  that no longer resolves, or an upstream source that changed) — see
  "Keeping the catalog from going stale" below.

## Adding a new service

Add an object to `SERVICES` in `services.js` with `name`, `icon` (a URL —
this project uses the [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
set), `homepage`, `image`, `description`, `tags`, `ports`, `volumes`, and
`environment`. It appears in the checklist, search, and tag filters
automatically — no changes needed anywhere else. Use `changeme`-prefixed
default values for anything that must be replaced before first run (a
password, a signing key); the Settings panel highlights those automatically
and won't let the tooltip lie about what's still a placeholder, and offers
a "Generate" button for the ones it recognizes as a secret rather than a
value you have to supply yourself (see `generatorFor` in `app.js`).

A few optional fields cover less common cases:

- `dependsOn` — a companion container (a database, a search index, ...):
  `{key, name, image, volumes, environment, healthcheck?}`. **It never gets
  a published port** — the generator hardcodes an empty `ports` list for
  every dependency, so this only fits a backing service the top-level
  container talks to internally (Nextcloud's MariaDB, Milvus's etcd/MinIO).
  RustDesk (hbbs+hbbr) is the one catalog entry that doesn't really fit —
  both need their own published ports — kept in anyway with hbbr's ports
  left for you to add by hand (see its notes) rather than growing the
  schema for a case used by one service so far. `healthcheck` —
  `{test, interval, timeout, retries, startPeriod?}` — makes the
  *top-level* service's own generated `depends_on` entry for this
  dependency wait for `service_healthy` instead of just `service_started`.
- `networkMode: "host"` — for anything that needs host networking (device
  discovery, seeing the LAN directly); pair it with `ports: []`, since
  compose doesn't allow both a `network_mode` and a `ports:` section.
- `capAdd`, `devices`, `extraLines` — added capabilities, device mounts,
  and an escape hatch for any other one-off compose key (`command:`,
  `security_opt:`, ...) that doesn't warrant its own structured field.
- `iconBg` — a CSS color to show behind the icon, for the rare
  dashboard-icons asset that's a plain white cutout with no background of
  its own (invisible on a light page otherwise) — pull the color from the
  project's own branding rather than guessing.
- If there's no usable icon in the set at all, use `placeholderIcon("X")`
  (a plain initial) rather than borrowing an unrelated logo.
- `sourceUrl` / `sourceHash` — the official docs/compose file this entry
  was last verified against, and a sha256 of its content at the time. Both
  optional, and independent of each other in practice: an entry with only
  `image` set still gets checked for whether that image still resolves;
  adding `sourceUrl` additionally lets the catalog-drift workflow (below)
  notice when the upstream source itself changes. Pick a URL that's stable,
  plain-text content — a raw `README.md`/`docker-compose.yml` on GitHub, not
  a rendered GitHub or Docker Hub page, which embeds star/pull counts and
  other content that changes on every check regardless of anything that
  actually matters. Set `sourceHash` to that URL's content hashed the same
  way the workflow does: `curl -fsSL <url> | sha256sum`.

### Keeping the catalog from going stale

`.github/workflows/catalog-drift.yml` runs daily (and on demand) and opens
a GitHub issue, labeled `catalog-drift`, for any entry where either check
fails — it never edits `services.js` itself. It caught a real one within
days of being written: MinIO stopped publishing new images to Docker Hub
in October 2025 and pulled most existing tags, which silently broke
Milvus's `minio` dependency (fixed by switching to `quay.io/minio/minio`,
MinIO's own remaining registry). When one of these issues fires: check
whether the image genuinely moved/is gone (update `image`) or the source
page changed in a way that matters (update the entry to match) — or, if
the diff was just cosmetic, leave the entry alone and refresh `sourceHash`
to the new content so it stops re-flagging. `scripts/catalog-refs.mjs` is
what extracts `{key, image, sourceUrl, sourceHash}` for every entry (and
`dependsOn` companion) for the workflow to check.

## Known limitations (good candidates for a v2)

- Compose YAML is hand-built as strings, not through a YAML library — fine
  while the shape is this simple (it already covers `depends_on`/
  `healthcheck`), but worth revisiting if it grows further (networks,
  multiple compose profiles).
- No "troubleshoot my existing compose file" mode — parsing and diagnosing
  arbitrary YAML is a meaningfully harder problem than generating it.
- Host-port checking only sees the Docker host this container itself has
  access to — never a different host. With just the socket mounted, it
  also can't see `network_mode: host` containers or non-Docker processes
  (the Docker API doesn't report ports for those at all); mounting
  `/proc` read-only too (see above) closes that specific gap.
- Icons and screenshots for a few niche services are either a plain
  initial-letter placeholder or a reasonable stand-in (e.g. DockFlare uses
  the `cloudflared` icon it wraps) where no dedicated logo exists in the
  icon set used.

## Support

If this saved you some time, there's a "buy me a coffee" link at the
bottom of the builder page — never required, always appreciated.

## License

[MIT](LICENSE)
