/*
  Same data model as before (see README) — SERVICES maps a key to
  image/ports/volumes/environment/dependsOn/notes.

  What changed from v1: environment variables are now returned as
  structured objects {varName, key, defaultValue, isTimezone} instead
  of being flattened straight into .env text. That lets app.js render
  an editable field per variable (and a real dropdown for TZ) without
  touching this file again when a new service is added.
*/

// Real per-service brand icons, sourced from the community-maintained
// homarr-labs/dashboard-icons SVG set.
const ICON_BASE = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg";

// Fallback for the handful of niche services with no icon in that set —
// a plain initial, not a borrowed logo, so it never misrepresents the app.
function placeholderIcon(letter) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#6B6558"/><text x="16" y="21" font-family="sans-serif" font-size="15" font-weight="600" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SERVICES = {
  plex: {
    name: "Plex",
    icon: `${ICON_BASE}/plex.svg`,
    homepage: "https://www.plex.tv/",
    image: "plexinc/pms-docker:latest",
    description: "Media server for movies, TV and music.",
    tags: ["media", "movies", "tv", "music"],
    ports: [{ container: 32400, host: 32400, label: "Web UI" }],
    volumes: ["./plex/config:/config", "./media:/data/media"],
    environment: { TZ: "Etc/UTC", PLEX_CLAIM: "" },
    notes: "Get a claim token from plex.tv/claim and paste it into PLEX_CLAIM before first run.",
  },

  pihole: {
    name: "Pi-hole",
    icon: `${ICON_BASE}/pi-hole.svg`,
    homepage: "https://pi-hole.net/",
    image: "pihole/pihole:latest",
    description: "Network-wide ad blocking via DNS.",
    tags: ["network", "dns", "adblock"],
    ports: [
      { container: 80, host: 80, label: "Web UI" },
      { container: 53, host: 53, label: "DNS (TCP)", protocol: "tcp" },
      { container: 53, host: 53, label: "DNS (UDP)", protocol: "udp" },
    ],
    volumes: ["./pihole/etc-pihole:/etc/pihole", "./pihole/etc-dnsmasq.d:/etc/dnsmasq.d"],
    environment: { TZ: "Etc/UTC", WEBPASSWORD: "changeme" },
    notes: "Port 53 must be free on the host — disable systemd-resolved's DNS stub listener first on most Linux distros.",
  },

  nextcloud: {
    name: "Nextcloud",
    icon: `${ICON_BASE}/nextcloud.svg`,
    homepage: "https://nextcloud.com/",
    image: "nextcloud:latest",
    description: "Self-hosted file sync and share.",
    tags: ["files", "cloud", "productivity"],
    ports: [{ container: 80, host: 80, label: "Web UI" }],
    volumes: ["./nextcloud/html:/var/www/html"],
    environment: {
      MYSQL_HOST: "nextcloud-db",
      MYSQL_DATABASE: "nextcloud",
      MYSQL_USER: "nextcloud",
      MYSQL_PASSWORD: "changeme",
    },
    dependsOn: [
      {
        key: "nextcloud-db",
        name: "MariaDB (for Nextcloud)",
        image: "mariadb:11",
        volumes: ["./nextcloud/db:/var/lib/mysql"],
        environment: {
          MYSQL_ROOT_PASSWORD: "changeme-root",
          MYSQL_DATABASE: "nextcloud",
          MYSQL_USER: "nextcloud",
          MYSQL_PASSWORD: "changeme",
        },
      },
    ],
    notes: "Change every 'changeme' password before running docker compose up.",
  },

  homeassistant: {
    name: "Home Assistant",
    icon: `${ICON_BASE}/home-assistant.svg`,
    homepage: "https://www.home-assistant.io/",
    image: "ghcr.io/home-assistant/home-assistant:stable",
    description: "Smart home automation hub.",
    tags: ["smart-home", "automation"],
    ports: [{ container: 8123, host: 8123, label: "Web UI" }],
    volumes: ["./homeassistant/config:/config"],
    environment: { TZ: "Etc/UTC" },
    notes: "For device discovery (Bluetooth, HomeKit) some users switch this to network_mode: host instead of a published port.",
  },

  "uptime-kuma": {
    name: "Uptime Kuma",
    icon: `${ICON_BASE}/uptime-kuma.svg`,
    homepage: "https://github.com/louislam/uptime-kuma",
    image: "louislam/uptime-kuma:1",
    description: "Uptime monitoring dashboard for your other services.",
    tags: ["monitoring"],
    ports: [{ container: 3001, host: 3001, label: "Web UI" }],
    volumes: ["./uptime-kuma/data:/app/data"],
    environment: {},
    notes: "",
  },

  homarr: {
    name: "Homarr",
    icon: `${ICON_BASE}/homarr.svg`,
    homepage: "https://homarr.dev/",
    image: "ghcr.io/homarr-labs/homarr:latest",
    description: "Customizable start-page dashboard for all your other homelab services.",
    tags: ["dashboard"],
    ports: [{ container: 7575, host: 7575, label: "Web UI" }],
    volumes: ["./homarr/appdata:/appdata"],
    environment: { SECRET_ENCRYPTION_KEY: "changeme-generate-with-openssl-rand-hex-32" },
    notes: "Generate a real key with `openssl rand -hex 32` and put it in SECRET_ENCRYPTION_KEY before first run. For Docker container status widgets, also mount /var/run/docker.sock:/var/run/docker.sock (optional, grants host-level access).",
  },

  "it-tools": {
    name: "IT Tools",
    icon: `${ICON_BASE}/it-tools.svg`,
    homepage: "https://it-tools.tech/",
    image: "corentinth/it-tools:latest",
    description: "Handy collection of online tools for developers — encoders, converters, generators.",
    tags: ["developer", "tools"],
    ports: [{ container: 80, host: 8080, label: "Web UI" }],
    volumes: [],
    environment: {},
    notes: "",
  },

  jellyfin: {
    name: "Jellyfin",
    icon: `${ICON_BASE}/jellyfin.svg`,
    homepage: "https://jellyfin.org/",
    image: "jellyfin/jellyfin:latest",
    description: "Free, open-source media server for movies, TV and music.",
    tags: ["media", "movies", "tv", "music"],
    ports: [{ container: 8096, host: 8096, label: "Web UI" }],
    volumes: ["./jellyfin/config:/config", "./jellyfin/cache:/cache", "./media:/media"],
    environment: { TZ: "Etc/UTC" },
    notes: "",
  },

  linkding: {
    name: "Linkding",
    icon: `${ICON_BASE}/linkding.svg`,
    homepage: "https://github.com/sissbruecker/linkding",
    image: "sissbruecker/linkding:latest",
    description: "Minimalist, self-hosted bookmark manager.",
    tags: ["bookmarks", "productivity"],
    ports: [{ container: 9090, host: 9090, label: "Web UI" }],
    volumes: ["./linkding/data:/etc/linkding/data"],
    environment: { LD_SUPERUSER_NAME: "admin", LD_SUPERUSER_PASSWORD: "changeme" },
    notes: "",
  },

  nginx: {
    name: "Nginx",
    icon: `${ICON_BASE}/nginx.svg`,
    homepage: "https://nginx.org/",
    image: "nginx:alpine",
    description: "Lightweight web server, useful as a static site host or reverse proxy.",
    tags: ["network", "web-server", "proxy"],
    ports: [{ container: 80, host: 8081, label: "Web UI" }],
    volumes: ["./nginx/html:/usr/share/nginx/html:ro", "./nginx/conf.d:/etc/nginx/conf.d:ro"],
    environment: {},
    notes: "Drop your static files into ./nginx/html and any server blocks into ./nginx/conf.d before starting.",
  },

  "stirling-pdf": {
    name: "Stirling PDF",
    icon: `${ICON_BASE}/stirling-pdf.svg`,
    homepage: "https://www.stirlingpdf.com/",
    image: "stirlingtools/stirling-pdf:latest",
    description: "Self-hosted toolbox for merging, splitting, converting and editing PDFs.",
    tags: ["productivity", "documents"],
    ports: [{ container: 8080, host: 8080, label: "Web UI" }],
    volumes: ["./stirling-pdf/configs:/configs", "./stirling-pdf/logs:/logs"],
    environment: {},
    notes: "",
  },

  vaultwarden: {
    name: "Vaultwarden",
    icon: `${ICON_BASE}/vaultwarden.svg`,
    homepage: "https://github.com/dani-garcia/vaultwarden",
    image: "vaultwarden/server:latest",
    description: "Lightweight, self-hosted Bitwarden-compatible password manager.",
    tags: ["security", "passwords"],
    ports: [{ container: 80, host: 8222, label: "Web UI" }],
    volumes: ["./vaultwarden/data:/data"],
    environment: { ADMIN_TOKEN: "changeme", SIGNUPS_ALLOWED: "true" },
    notes: "ADMIN_TOKEN should be an Argon2 hash, not plain text — generate one with 'docker run --rm -it vaultwarden/server /vaultwarden hash'. Set SIGNUPS_ALLOWED to false once your account is created.",
  },

  doublecommander: {
    name: "Double Commander",
    icon: `${ICON_BASE}/double-commander.svg`,
    homepage: "https://doublecmd.sourceforge.io/",
    image: "lscr.io/linuxserver/doublecommander:latest",
    description: "Dual-pane file manager, served as a full desktop in your browser.",
    tags: ["files", "tools"],
    ports: [
      { container: 3000, host: 3000, label: "Web UI (HTTP)" },
      { container: 3001, host: 3001, label: "Web UI (HTTPS)" },
    ],
    volumes: ["./doublecommander/config:/config", "./doublecommander/data:/data"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "Runs as a full remote desktop (KasmVNC) in your browser. If the desktop crashes under heavy use, add 'shm_size: 1gb' to this service in the compose file.",
  },

  dockge: {
    name: "Dockge",
    icon: `${ICON_BASE}/dockge.svg`,
    homepage: "https://github.com/louislam/dockge",
    image: "louislam/dockge:1",
    description: "Reactive UI for managing docker-compose stacks on this host.",
    tags: ["docker", "management"],
    ports: [{ container: 5001, host: 5001, label: "Web UI" }],
    volumes: [
      "/var/run/docker.sock:/var/run/docker.sock",
      "./dockge/data:/app/data",
      "./dockge/stacks:/opt/stacks",
    ],
    environment: {},
    notes: "Mounts the Docker socket, which gives this container root-equivalent control over the host — only run it on a trusted network.",
  },

  portainer: {
    name: "Portainer",
    icon: `${ICON_BASE}/portainer.svg`,
    homepage: "https://www.portainer.io/",
    image: "portainer/portainer-ce:latest",
    description: "Web UI for managing Docker containers, images, volumes and networks.",
    tags: ["docker", "management"],
    ports: [
      { container: 9443, host: 9443, label: "Web UI (HTTPS)" },
      { container: 8000, host: 8000, label: "Edge Agent Tunnel" },
    ],
    volumes: ["/var/run/docker.sock:/var/run/docker.sock", "./portainer/data:/data"],
    environment: {},
    notes: "Mounts the Docker socket, which gives this container root-equivalent control over the host — only run it on a trusted network. Set the admin password on first visit to the Web UI.",
  },

  immich: {
    name: "Immich",
    icon: `${ICON_BASE}/immich.svg`,
    homepage: "https://immich.app/",
    image: "ghcr.io/immich-app/immich-server:release",
    description: "Self-hosted photo and video backup with mobile auto-upload.",
    tags: ["media", "photos", "backup"],
    ports: [{ container: 2283, host: 2283, label: "Web UI" }],
    volumes: ["./immich/upload:/data"],
    environment: {
      TZ: "Etc/UTC",
      DB_HOSTNAME: "immich-postgres",
      DB_USERNAME: "postgres",
      DB_PASSWORD: "changeme",
      DB_DATABASE_NAME: "immich",
      REDIS_HOSTNAME: "immich-redis",
    },
    dependsOn: [
      {
        key: "immich-machine-learning",
        name: "Immich Machine Learning (for Immich)",
        image: "ghcr.io/immich-app/immich-machine-learning:release",
        volumes: ["./immich/model-cache:/cache"],
        environment: {},
      },
      {
        key: "immich-redis",
        name: "Redis (for Immich)",
        image: "valkey/valkey:9",
        volumes: [],
        environment: {},
      },
      {
        key: "immich-postgres",
        name: "PostgreSQL (for Immich)",
        image: "ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0",
        volumes: ["./immich/db:/var/lib/postgresql/data"],
        environment: {
          DB_USERNAME: "postgres",
          DB_PASSWORD: "changeme",
          DB_DATABASE_NAME: "immich",
        },
      },
    ],
    notes: "Immich needs Postgres, Redis and a machine-learning worker to function — all three are added automatically. Keep DB_USERNAME/DB_PASSWORD/DB_DATABASE_NAME identical between Immich and its PostgreSQL dependency, or they won't be able to authenticate with each other.",
  },

  eurooffice: {
    name: "Euro-Office",
    icon: "https://raw.githubusercontent.com/Euro-Office/documentation/main/docs/assets/favicon.svg",
    homepage: "https://euro-office.github.io/documentation/",
    image: "ghcr.io/euro-office/documentserver:latest",
    description: "Self-hosted document editing server — add it to Nextcloud via the Nextcloud Connector app for in-browser Office file editing.",
    tags: ["productivity", "documents", "nextcloud-addon"],
    ports: [{ container: 80, host: 8083, label: "Web UI" }],
    volumes: [
      "./eurooffice/documentserver:/var/lib/eurooffice/documentserver",
      "./eurooffice/data:/var/www/eurooffice/Data",
      "./eurooffice/logs:/var/log/eurooffice/documentserver",
      "./eurooffice/config:/etc/eurooffice/documentserver",
    ],
    environment: { JWT_ENABLED: "true", JWT_SECRET: "changeme-at-least-32-chars-long" },
    notes: "Pairs with Nextcloud: install the 'Nextcloud Connector' app from the Nextcloud app store, then point it at this server's URL with the matching JWT_SECRET.",
  },

  // ---- Arr Stack (see STACKS below) ----------------------------------

  "arr-dashboard": {
    name: "Arr Dashboard",
    icon: placeholderIcon("A"),
    homepage: "https://github.com/Kha-kis/arr-dashboard",
    image: "khak1s/arr-dashboard:latest",
    description: "Unified dashboard for your Sonarr, Radarr, Prowlarr, Lidarr and Readarr instances.",
    tags: ["arr-stack", "dashboard", "media"],
    ports: [{ container: 3000, host: 3000, label: "Web UI" }],
    volumes: ["./arr-dashboard/config:/config"],
    environment: { PUID: "1000", PGID: "1000" },
    notes: "",
  },

  lidarr: {
    name: "Lidarr",
    icon: `${ICON_BASE}/lidarr.svg`,
    homepage: "https://github.com/lidarr/Lidarr",
    image: "linuxserver/lidarr:latest",
    description: "Music collection manager that finds and organizes music via your indexers.",
    tags: ["arr-stack", "media", "music", "download"],
    ports: [{ container: 8686, host: 8686, label: "Web UI" }],
    volumes: ["./lidarr/config:/config", "./media/music:/music", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "",
  },

  prowlarr: {
    name: "Prowlarr",
    icon: `${ICON_BASE}/prowlarr.svg`,
    homepage: "https://github.com/Prowlarr/Prowlarr",
    image: "linuxserver/prowlarr:latest",
    description: "Indexer manager that feeds search results to the rest of the *arr apps.",
    tags: ["arr-stack", "indexer", "download"],
    ports: [{ container: 9696, host: 9696, label: "Web UI" }],
    volumes: ["./prowlarr/config:/config"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "",
  },

  qbittorrent: {
    name: "qBittorrent",
    icon: `${ICON_BASE}/qbittorrent.svg`,
    homepage: "https://www.qbittorrent.org/",
    image: "linuxserver/qbittorrent:latest",
    description: "BitTorrent client with a web UI, used by the *arr apps to fetch downloads.",
    tags: ["arr-stack", "download", "torrent"],
    ports: [
      { container: 8080, host: 8080, label: "Web UI" },
      { container: 6881, host: 6881, label: "Torrenting (TCP)", protocol: "tcp" },
      { container: 6881, host: 6881, label: "Torrenting (UDP)", protocol: "udp" },
    ],
    volumes: ["./qbittorrent/config:/config", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC", WEBUI_PORT: "8080" },
    notes: "",
  },

  radarr: {
    name: "Radarr",
    icon: `${ICON_BASE}/radarr.svg`,
    homepage: "https://github.com/Radarr/Radarr",
    image: "linuxserver/radarr:latest",
    description: "Movie collection manager that finds and organizes movies via your indexers.",
    tags: ["arr-stack", "media", "movies", "download"],
    ports: [{ container: 7878, host: 7878, label: "Web UI" }],
    volumes: ["./radarr/config:/config", "./media/movies:/movies", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "",
  },

  readarr: {
    name: "Readarr",
    icon: `${ICON_BASE}/readarr.svg`,
    homepage: "https://github.com/Readarr/Readarr",
    image: "linuxserver/readarr:develop",
    description: "Book collection manager that finds and organizes ebooks and audiobooks.",
    tags: ["arr-stack", "media", "books", "download"],
    ports: [{ container: 8787, host: 8787, label: "Web UI" }],
    volumes: ["./readarr/config:/config", "./media/books:/books", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "LinuxServer only ships a :develop tag for Readarr — there is no :latest.",
  },

  sabnzbd: {
    name: "SABnzbd",
    icon: `${ICON_BASE}/sabnzbd.svg`,
    homepage: "https://sabnzbd.org/",
    image: "linuxserver/sabnzbd:latest",
    description: "Usenet download client, used by the *arr apps to fetch downloads.",
    tags: ["arr-stack", "download", "usenet"],
    ports: [{ container: 8080, host: 8090, label: "Web UI" }],
    volumes: ["./sabnzbd/config:/config", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "",
  },

  sonarr: {
    name: "Sonarr",
    icon: `${ICON_BASE}/sonarr.svg`,
    homepage: "https://github.com/Sonarr/Sonarr",
    image: "linuxserver/sonarr:latest",
    description: "TV collection manager that finds and organizes episodes via your indexers.",
    tags: ["arr-stack", "media", "tv", "download"],
    ports: [{ container: 8989, host: 8989, label: "Web UI" }],
    volumes: ["./sonarr/config:/config", "./media/tv:/tv", "./downloads:/downloads"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "",
  },

  seerr: {
    name: "Seerr",
    icon: `${ICON_BASE}/seerr.svg`,
    homepage: "https://github.com/seerr-team/seerr",
    image: "ghcr.io/seerr-team/seerr:latest",
    description: "Media request manager for Jellyfin, Plex or Emby — the merged successor to Jellyseerr and Overseerr.",
    tags: ["arr-stack", "media", "requests"],
    ports: [{ container: 5055, host: 5055, label: "Web UI" }],
    volumes: ["./seerr/config:/app/config"],
    environment: { TZ: "Etc/UTC" },
    notes: "",
  },

  // ---- Networking / automation / management --------------------------

  gluetun: {
    name: "Gluetun",
    icon: `${ICON_BASE}/gluetun.svg`,
    homepage: "https://github.com/qdm12/gluetun",
    image: "qmcgaw/gluetun:latest",
    description: "VPN client container — routes other containers' traffic through your VPN provider.",
    tags: ["network", "vpn", "security"],
    capAdd: ["NET_ADMIN"],
    devices: ["/dev/net/tun:/dev/net/tun"],
    ports: [{ container: 8000, host: 8000, label: "Control server" }],
    volumes: ["./gluetun/config:/gluetun"],
    environment: {
      VPN_SERVICE_PROVIDER: "changeme-see-gluetun-wiki",
      VPN_TYPE: "wireguard",
      WIREGUARD_PRIVATE_KEY: "changeme",
      WIREGUARD_ADDRESSES: "changeme",
    },
    notes: "VPN_SERVICE_PROVIDER, WIREGUARD_PRIVATE_KEY and WIREGUARD_ADDRESSES come from your VPN provider — see Gluetun's wiki for provider-specific setup. Other containers route through this one with 'network_mode: service:gluetun', which this tool doesn't wire up automatically.",
  },

  "gluetun-webui": {
    name: "Gluetun WebUI",
    icon: `${ICON_BASE}/gluetun.svg`,
    homepage: "https://github.com/Sir-Scuzza/gluetun-webui",
    image: "scuzza/gluetun-webui:latest",
    description: "Web dashboard for monitoring and controlling a Gluetun VPN container.",
    tags: ["network", "vpn", "dashboard"],
    ports: [{ container: 3000, host: 3010, label: "Web UI" }],
    volumes: [],
    environment: { GLUETUN_CONTROL_URL: "http://gluetun:8000" },
    notes: "Expects a container named 'gluetun' on the same network — keep both in the combined compose file, or edit GLUETUN_CONTROL_URL if you split them into separate files.",
  },

  tailscale: {
    name: "Tailscale",
    icon: `${ICON_BASE}/tailscale.svg`,
    homepage: "https://tailscale.com/",
    image: "ghcr.io/tailscale/tailscale:v1.102.3",
    description: "Mesh VPN that puts this host on your private Tailnet.",
    tags: ["network", "vpn", "security"],
    capAdd: ["NET_ADMIN", "NET_RAW"],
    devices: ["/dev/net/tun:/dev/net/tun"],
    ports: [],
    volumes: ["./tailscale/state:/var/lib/tailscale"],
    environment: { TS_AUTHKEY: "changeme", TS_STATE_DIR: "/var/lib/tailscale" },
    notes: "TS_AUTHKEY is a one-time auth key from the Tailscale admin console. Subnet routing and exit-node use cases usually also want 'network_mode: host', which isn't added automatically.",
  },

  n8n: {
    name: "n8n",
    icon: `${ICON_BASE}/n8n.svg`,
    homepage: "https://n8n.io/",
    image: "n8nio/n8n:latest",
    description: "Workflow automation tool for connecting APIs and services without code.",
    tags: ["automation", "workflow"],
    ports: [{ container: 5678, host: 5678, label: "Web UI" }],
    volumes: ["./n8n/data:/home/node/.n8n"],
    environment: { TZ: "Etc/UTC", GENERIC_TIMEZONE: "Etc/UTC", N8N_SECURE_COOKIE: "false" },
    notes: "N8N_SECURE_COOKIE is set to false so login works over plain HTTP — set it back to true once this sits behind an HTTPS reverse proxy.",
  },

  portracker: {
    name: "Portracker",
    icon: `${ICON_BASE}/portracker.svg`,
    homepage: "https://github.com/mostafa-wahied/portracker",
    image: "mostafawahied/portracker:latest",
    description: "Scans this host and its containers to map every port in use.",
    tags: ["network", "monitoring"],
    extraLines: [`pid: "host"`, "cap_add:", "  - SYS_PTRACE", "  - SYS_ADMIN", "security_opt:", "  - apparmor:unconfined"],
    runExtraArgs: ["--pid=host", "--cap-add=SYS_PTRACE", "--cap-add=SYS_ADMIN", "--security-opt=apparmor:unconfined"],
    ports: [{ container: 4999, host: 4999, label: "Web UI" }],
    volumes: ["./portracker/data:/data", "/var/run/docker.sock:/var/run/docker.sock:ro"],
    environment: {},
    notes: "Mounts the Docker socket (read-only) and runs with pid: host + extra capabilities so it can see every process's ports — only run it on a trusted network.",
  },

  "lan-orangutan": {
    name: "LAN Orangutan",
    icon: placeholderIcon("L"),
    homepage: "https://github.com/291-Group/LAN-Orangutan",
    image: "ghcr.io/291-group/lan-orangutan:latest",
    description: "Network scanner that labels and tracks every device on your LAN.",
    tags: ["network", "monitoring", "security"],
    networkMode: "host",
    capAdd: ["NET_RAW", "NET_ADMIN", "NET_BIND_SERVICE"],
    ports: [],
    volumes: ["./lan-orangutan/data:/var/lib/lan-orangutan"],
    environment: { TZ: "Etc/UTC", ORANGUTAN_PORT: "291" },
    notes: "Needs host networking to see devices on your real LAN (Docker's bridge network only sees other containers) — Linux only. With network_mode: host, it opens its dashboard directly on host port 291, not through a published ports mapping.",
  },

  dockflare: {
    name: "DockFlare",
    icon: `${ICON_BASE}/cloudflared.svg`,
    homepage: "https://github.com/ChrispyBacon-dev/DockFlare",
    image: "alplat/dockflare:stable",
    description: "Automates Cloudflare Tunnel ingress and Zero Trust Access rules from Docker labels.",
    tags: ["network", "proxy", "automation"],
    ports: [{ container: 5000, host: 5000, label: "Web UI" }],
    volumes: ["./dockflare/data:/app/data", "/var/run/docker.sock:/var/run/docker.sock"],
    environment: { REDIS_URL: "redis://dockflare-redis:6379/0" },
    dependsOn: [
      {
        key: "dockflare-redis",
        name: "Redis (for DockFlare)",
        image: "redis:7-alpine",
        volumes: ["./dockflare/redis:/data"],
        environment: {},
      },
    ],
    notes: "Mounts the Docker socket directly — the project's own hardened stack instead proxies it through tecnativa/docker-socket-proxy, which is worth adding for production use. Log in with your Cloudflare account on first visit.",
  },

  "docker-sentinel": {
    name: "Docker Sentinel",
    icon: placeholderIcon("D"),
    homepage: "https://github.com/Will-Luck/Docker-Sentinel",
    image: "willluck/docker-sentinel:latest",
    description: "Update orchestrator for containers, with per-container policies and rollback on failed health checks.",
    tags: ["monitoring", "updates", "docker"],
    ports: [{ container: 8080, host: 8080, label: "Web UI" }],
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro", "./docker-sentinel/data:/data"],
    environment: { SENTINEL_POLL_INTERVAL: "6h" },
    notes: "This project is in maintenance mode (no active development) as of this writing — check its GitHub repo before relying on it long-term.",
  },

  navidrome: {
    name: "Navidrome",
    icon: `${ICON_BASE}/navidrome.svg`,
    homepage: "https://www.navidrome.org/",
    image: "deluan/navidrome:latest",
    description: "Self-hosted music streaming server with a modern web UI, compatible with Subsonic/Airsonic clients.",
    tags: ["media", "music"],
    ports: [{ container: 4533, host: 4533, label: "Web UI" }],
    volumes: ["./navidrome/data:/data", "./music:/music:ro"],
    environment: { ND_LOGLEVEL: "info", ND_SESSIONTIMEOUT: "24h" },
    notes: "Point the /music mount at your existing music library — Navidrome only reads it (read-only) and never writes to it.",
  },

  "code-server": {
    name: "Code Server",
    icon: `${ICON_BASE}/vscode.svg`,
    homepage: "https://github.com/coder/code-server",
    image: "lscr.io/linuxserver/code-server:latest",
    description: "VS Code running in the browser — a full dev environment reachable from any device.",
    tags: ["developer", "tools", "ide"],
    ports: [{ container: 8443, host: 8443, label: "Web UI" }],
    volumes: ["./code-server/config:/config"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC", PASSWORD: "changeme", SUDO_PASSWORD: "changeme" },
    notes: "Change PASSWORD before first run — it's required to log in to the web UI. SUDO_PASSWORD enables sudo inside the container's terminal.",
  },

  "nginx-proxy-manager": {
    name: "Nginx Proxy Manager",
    icon: `${ICON_BASE}/nginx-proxy-manager.svg`,
    homepage: "https://nginxproxymanager.com/",
    image: "jc21/nginx-proxy-manager:latest",
    description: "Reverse proxy with free SSL certificates, managed entirely through a web UI — no config files to hand-edit.",
    tags: ["network", "proxy", "ssl"],
    ports: [
      { container: 80, host: 80, label: "HTTP" },
      { container: 443, host: 443, label: "HTTPS" },
      { container: 81, host: 81, label: "Admin UI" },
    ],
    volumes: ["./nginx-proxy-manager/data:/data", "./nginx-proxy-manager/letsencrypt:/etc/letsencrypt"],
    environment: {},
    notes: "Default login is admin@example.com / changeme — the setup wizard forces a password change on first login, there's no environment variable for it.",
  },

  traefik: {
    name: "Traefik",
    icon: `${ICON_BASE}/traefik.svg`,
    homepage: "https://traefik.io/traefik/",
    image: "traefik:latest",
    description: "Config-driven reverse proxy that auto-discovers routes from Docker labels on your other containers.",
    tags: ["network", "proxy"],
    ports: [
      { container: 80, host: 80, label: "HTTP" },
      { container: 443, host: 443, label: "HTTPS" },
      { container: 8080, host: 8080, label: "Dashboard" },
    ],
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"],
    environment: {},
    extraLines: [
      "command:",
      '  - "--api.insecure=true"',
      '  - "--api.dashboard=true"',
      '  - "--providers.docker=true"',
      '  - "--providers.docker.exposedbydefault=false"',
      '  - "--entrypoints.web.address=:80"',
      '  - "--entrypoints.websecure.address=:443"',
    ],
    runCommandArgs: [
      "--api.insecure=true",
      "--api.dashboard=true",
      "--providers.docker=true",
      "--providers.docker.exposedbydefault=false",
      "--entrypoints.web.address=:80",
      "--entrypoints.websecure.address=:443",
    ],
    notes: "The dashboard runs unauthenticated (api.insecure=true) for simplicity — fine on a trusted LAN, not something to expose to the internet. Routing another container through Traefik needs traefik.* labels added to that container, which this tool doesn't generate automatically — see Traefik's Docker provider docs.",
  },

  "adguard-home": {
    name: "AdGuard Home",
    icon: `${ICON_BASE}/adguard-home.svg`,
    homepage: "https://adguard.com/en/adguard-home/overview.html",
    image: "adguard/adguardhome:latest",
    description: "Network-wide ad and tracker blocking via DNS, with a built-in DNS-over-HTTPS/TLS server.",
    tags: ["network", "dns", "adblock"],
    ports: [
      { container: 3000, host: 3000, label: "Web UI (setup)" },
      { container: 53, host: 53, label: "DNS (TCP)", protocol: "tcp" },
      { container: 53, host: 53, label: "DNS (UDP)", protocol: "udp" },
    ],
    volumes: ["./adguardhome/work:/opt/adguardhome/work", "./adguardhome/conf:/opt/adguardhome/conf"],
    environment: {},
    notes: "Port 53 must be free on the host, same as Pi-hole — don't run both at once without changing ports. Finish the setup wizard at :3000 on first run; that's also where you'll set the admin login, there's no environment variable for it.",
  },

  authentik: {
    name: "Authentik",
    icon: `${ICON_BASE}/authentik.svg`,
    homepage: "https://goauthentik.io/",
    image: "ghcr.io/goauthentik/server:latest",
    description: "Self-hosted SSO / identity provider — put a single login in front of your other services.",
    tags: ["security", "network", "passwords"],
    ports: [
      { container: 9000, host: 9000, label: "Web UI (HTTP)" },
      { container: 9443, host: 9443, label: "Web UI (HTTPS)" },
    ],
    volumes: ["./authentik/media:/data", "./authentik/custom-templates:/templates"],
    environment: {
      AUTHENTIK_SECRET_KEY: "changeme-generate-with-openssl-rand-base64-60",
      AUTHENTIK_POSTGRESQL__HOST: "authentik-db",
      AUTHENTIK_POSTGRESQL__NAME: "authentik",
      AUTHENTIK_POSTGRESQL__USER: "authentik",
      AUTHENTIK_POSTGRESQL__PASSWORD: "changeme",
    },
    extraLines: ["command: server", "shm_size: 512mb"],
    runExtraArgs: ["--shm-size=512m"],
    runCommandArgs: ["server"],
    dependsOn: [
      {
        key: "authentik-worker",
        name: "Authentik Worker (background jobs, for Authentik)",
        image: "ghcr.io/goauthentik/server:latest",
        volumes: [
          "./authentik/media:/data",
          "./authentik/custom-templates:/templates",
          "/var/run/docker.sock:/var/run/docker.sock",
        ],
        environment: {
          AUTHENTIK_SECRET_KEY: "changeme-generate-with-openssl-rand-base64-60",
          AUTHENTIK_POSTGRESQL__HOST: "authentik-db",
          AUTHENTIK_POSTGRESQL__NAME: "authentik",
          AUTHENTIK_POSTGRESQL__USER: "authentik",
          AUTHENTIK_POSTGRESQL__PASSWORD: "changeme",
        },
        extraLines: ["command: worker", "user: root", "shm_size: 512mb"],
        runExtraArgs: ["--user=root", "--shm-size=512m"],
        runCommandArgs: ["worker"],
      },
      {
        key: "authentik-db",
        name: "PostgreSQL (for Authentik)",
        image: "postgres:16-alpine",
        volumes: ["./authentik/database:/var/lib/postgresql/data"],
        environment: {
          POSTGRES_DB: "authentik",
          POSTGRES_USER: "authentik",
          POSTGRES_PASSWORD: "changeme",
        },
      },
    ],
    notes: "This is 3 containers (server, worker, database) — change every 'changeme' value, and make sure AUTHENTIK_POSTGRESQL__PASSWORD and AUTHENTIK_SECRET_KEY are identical between the server and worker sections, matching the database's POSTGRES_PASSWORD. The worker mounts the Docker socket for managing outposts — that grants it full Docker API access, same caution as Homarr/Portracker/DockFlare.",
  },

  grafana: {
    name: "Grafana",
    icon: `${ICON_BASE}/grafana.svg`,
    homepage: "https://grafana.com/",
    image: "grafana/grafana:latest",
    description: "Dashboards and visualization for metrics — pairs with Prometheus, included as a companion container below.",
    tags: ["monitoring"],
    ports: [{ container: 3000, host: 3000, label: "Web UI" }],
    volumes: ["./grafana/data:/var/lib/grafana"],
    environment: { GF_SECURITY_ADMIN_PASSWORD: "changeme" },
    dependsOn: [
      {
        key: "prometheus",
        name: "Prometheus (for Grafana)",
        image: "prom/prometheus:latest",
        volumes: ["./prometheus/data:/prometheus", "./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro"],
        environment: {},
      },
    ],
    notes: "Prometheus needs a prometheus.yml file at ./prometheus/prometheus.yml before it will start — even a minimal 'scrape_configs: []' works to get it running, then point it at exporters you add later. In Grafana, add Prometheus as a data source using http://prometheus:9090.",
  },

  syncthing: {
    name: "Syncthing",
    icon: `${ICON_BASE}/syncthing.svg`,
    homepage: "https://syncthing.net/",
    image: "syncthing/syncthing:latest",
    description: "Peer-to-peer file sync directly between your own devices — no cloud, no middleman server.",
    tags: ["files", "backup", "cloud"],
    ports: [
      { container: 8384, host: 8384, label: "Web UI" },
      { container: 22000, host: 22000, label: "Sync (TCP)", protocol: "tcp" },
      { container: 22000, host: 22000, label: "Sync (UDP)", protocol: "udp" },
      { container: 21027, host: 21027, label: "Discovery (UDP)", protocol: "udp" },
    ],
    volumes: ["./syncthing/config:/var/syncthing/config", "./syncthing/data:/var/syncthing/data"],
    environment: { PUID: "1000", PGID: "1000" },
    notes: "",
  },

  "speedtest-tracker": {
    name: "Speedtest Tracker",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/speedtest-tracker.png",
    homepage: "https://github.com/alexjustesen/speedtest-tracker",
    image: "lscr.io/linuxserver/speedtest-tracker:latest",
    description: "Runs periodic internet speed tests and charts the results over time.",
    tags: ["monitoring", "network"],
    ports: [{ container: 80, host: 8765, label: "Web UI" }],
    volumes: ["./speedtest-tracker/config:/config"],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC", APP_KEY: "changeme-generate-a-laravel-app-key" },
    notes: "Generate APP_KEY with `docker exec speedtest-tracker php artisan key:generate --show` after first start (or any base64 32-byte value) — the app won't run correctly with the placeholder left in place.",
  },

  traccar: {
    name: "Traccar",
    icon: `${ICON_BASE}/traccar.svg`,
    homepage: "https://www.traccar.org/",
    image: "traccar/traccar:latest",
    description: "Self-hosted GPS tracking server for fleet and personal device tracking, with a web dashboard and mobile app support.",
    tags: ["monitoring", "network"],
    ports: [{ container: 8082, host: 8082, label: "Web UI" }],
    volumes: ["./traccar/logs:/opt/traccar/logs", "./traccar/data:/opt/traccar/data"],
    environment: {},
    notes: "Only the web UI port is included by default — Traccar listens on a large range of additional ports, one per GPS protocol (see traccar.org's protocol list). Add whichever ones your actual trackers use with 'add a port' above.",
  },

  homepage: {
    name: "Homepage",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/homepage.png",
    homepage: "https://gethomepage.dev/",
    image: "ghcr.io/gethomepage/homepage:latest",
    description: "Fast, YAML-configured start page dashboard for links to all your other services.",
    tags: ["dashboard"],
    ports: [{ container: 3000, host: 3000, label: "Web UI" }],
    volumes: ["./homepage/config:/app/config"],
    environment: { HOMEPAGE_ALLOWED_HOSTS: "changeme-your-server-ip:3000" },
    notes: "HOMEPAGE_ALLOWED_HOSTS is required — Homepage refuses all requests whose Host header isn't on this comma-separated list (only localhost/127.0.0.1 are allowed by default). Set it to how you'll actually reach it, e.g. 192.168.1.50:3000 — and if the port above got auto-remapped due to a conflict, use that port here instead, not 3000. Configured entirely through YAML files inside ./homepage/config after first run, not through this tool. For Docker-based service widgets, also mount /var/run/docker.sock:/var/run/docker.sock (optional, grants host-level access).",
  },

  audiobookshelf: {
    name: "Audiobookshelf",
    icon: `${ICON_BASE}/audiobookshelf.svg`,
    homepage: "https://www.audiobookshelf.org/",
    image: "ghcr.io/advplyr/audiobookshelf:latest",
    description: "Self-hosted server for audiobooks and podcasts, with a companion mobile app.",
    tags: ["media", "books"],
    ports: [{ container: 80, host: 13378, label: "Web UI" }],
    volumes: [
      "./audiobookshelf/config:/config",
      "./audiobookshelf/metadata:/metadata",
      "./audiobooks:/audiobooks",
      "./podcasts:/podcasts",
    ],
    environment: { TZ: "Etc/UTC" },
    notes: "",
  },

  gitea: {
    name: "Gitea",
    icon: `${ICON_BASE}/gitea.svg`,
    homepage: "https://about.gitea.com/",
    image: "gitea/gitea:latest",
    description: "Lightweight self-hosted Git hosting — a personal GitHub, with issues, PRs and a package registry.",
    tags: ["developer", "tools"],
    ports: [
      { container: 3000, host: 3000, label: "Web UI" },
      { container: 22, host: 2222, label: "Git SSH" },
    ],
    volumes: ["./gitea/data:/data"],
    environment: { USER_UID: "1000", USER_GID: "1000" },
    notes: "SSH is mapped to host port 2222 instead of 22 to avoid clashing with the host's own SSH server — use that port when cloning over SSH (git clone ssh://git@host:2222/...).",
  },

  paperless: {
    name: "Paperless-ngx",
    icon: `${ICON_BASE}/paperless-ngx.svg`,
    homepage: "https://docs.paperless-ngx.com/",
    image: "ghcr.io/paperless-ngx/paperless-ngx:latest",
    description: "Scans, OCRs and indexes documents so they're searchable and archived — drop a file in a folder, it does the rest.",
    tags: ["productivity", "documents", "files"],
    ports: [{ container: 8000, host: 8000, label: "Web UI" }],
    volumes: [
      "./paperless/data:/usr/src/paperless/data",
      "./paperless/media:/usr/src/paperless/media",
      "./paperless/export:/usr/src/paperless/export",
      "./paperless/consume:/usr/src/paperless/consume",
    ],
    environment: {
      PAPERLESS_REDIS: "redis://paperless-redis:6379",
      PAPERLESS_TIME_ZONE: "Etc/UTC",
      PAPERLESS_ADMIN_USER: "admin",
      PAPERLESS_ADMIN_PASSWORD: "changeme",
    },
    dependsOn: [
      {
        key: "paperless-redis",
        name: "Redis (for Paperless-ngx)",
        image: "redis:7-alpine",
        volumes: [],
        environment: {},
      },
    ],
    notes: "Drop files into ./paperless/consume and Paperless-ngx automatically scans, OCRs and files them away.",
  },

  cloudflared: {
    name: "Cloudflare Tunnel",
    icon: `${ICON_BASE}/cloudflared.svg`,
    homepage: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/",
    image: "cloudflare/cloudflared:latest",
    description: "Exposes a service to the internet through Cloudflare without opening any inbound ports on your router.",
    tags: ["network", "proxy", "security"],
    ports: [],
    volumes: [],
    environment: { TUNNEL_TOKEN: "changeme-get-from-the-cloudflare-zero-trust-dashboard" },
    extraLines: ["command: tunnel --no-autoupdate run"],
    notes: "Create the tunnel first in the Cloudflare Zero Trust dashboard (Networks > Tunnels) and paste its token into TUNNEL_TOKEN — which hostname points at which local service is configured there too, not in this file.",
  },

  ollama: {
    name: "Ollama",
    icon: `${ICON_BASE}/ollama.svg`,
    homepage: "https://ollama.com/",
    image: "ollama/ollama:latest",
    description: "Runs open-weight LLMs locally and serves them over an API — the usual backend for a self-hosted ChatGPT-style UI.",
    tags: ["developer", "tools"],
    ports: [{ container: 11434, host: 11434, label: "API" }],
    volumes: ["./ollama:/root/.ollama"],
    environment: {},
    notes: "CPU-only by default. GPU acceleration (--gpus=all for NVIDIA, ROCm devices for AMD) needs flags a docker-compose environment/volumes section can't express — add them by hand.",
  },

  "open-webui": {
    name: "Open WebUI",
    icon: `${ICON_BASE}/open-webui.svg`,
    homepage: "https://openwebui.com/",
    image: "ghcr.io/open-webui/open-webui:main",
    description: "A ChatGPT-style web interface for locally-run LLMs — pairs with Ollama or any OpenAI-compatible API.",
    tags: ["developer", "tools"],
    ports: [{ container: 8080, host: 3000, label: "Web UI" }],
    volumes: ["./open-webui/data:/app/backend/data"],
    environment: { OLLAMA_BASE_URL: "http://ollama:11434" },
    notes: "OLLAMA_BASE_URL assumes you're also deploying Ollama alongside this in the same 'one combined file' — the hostname has to match Ollama's service name (ollama). Deploying separately, or pointing at a remote Ollama, change it to that host's real address.",
  },

  milvus: {
    name: "Milvus",
    icon: placeholderIcon("M"),
    homepage: "https://milvus.io/",
    image: "milvusdb/milvus:v3.0.1",
    description: "Open-source vector database for storing and searching embeddings at scale — the storage layer behind semantic search and RAG.",
    tags: ["developer", "tools"],
    ports: [
      { container: 19530, host: 19530, label: "API" },
      { container: 9091, host: 9091, label: "Web UI" },
    ],
    volumes: ["./milvus/data:/var/lib/milvus"],
    environment: {
      ETCD_ENDPOINTS: "milvus-etcd:2379",
      MINIO_ADDRESS: "milvus-minio:9000",
      MQ_TYPE: "woodpecker",
    },
    extraLines: ["security_opt:", "  - seccomp:unconfined"],
    dependsOn: [
      {
        key: "milvus-etcd",
        name: "etcd (for Milvus)",
        image: "quay.io/coreos/etcd:v3.5.25",
        volumes: ["./milvus/etcd:/etcd"],
        environment: {
          ETCD_AUTO_COMPACTION_MODE: "revision",
          ETCD_AUTO_COMPACTION_RETENTION: "1000",
          ETCD_QUOTA_BACKEND_BYTES: "4294967296",
          ETCD_SNAPSHOT_COUNT: "50000",
        },
        extraLines: [
          "command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd",
        ],
      },
      {
        key: "milvus-minio",
        name: "MinIO (for Milvus)",
        image: "minio/minio:RELEASE.2024-12-18T13-15-44Z",
        volumes: ["./milvus/minio:/minio_data"],
        environment: { MINIO_ACCESS_KEY: "minioadmin", MINIO_SECRET_KEY: "changeme-minioadmin" },
        extraLines: [`command: minio server /minio_data --console-address ":9001"`],
      },
    ],
    notes: "Standalone Milvus still needs etcd and MinIO as internal storage backends (bundled here as dependencies) — this is the official 3-container standalone layout, not the full distributed/clustered one. Slow to start; give it a minute after 'docker compose up' before the API or the Web UI (at :9091/webui/) responds.",
  },

  karakeep: {
    name: "Karakeep",
    icon: `${ICON_BASE}/karakeep.svg`,
    // The dashboard-icons asset is a plain white cutout with no
    // background — invisible on a light page. Karakeep's own site uses
    // this same purple (its favicon theme-color) behind it for the same
    // reason; iconBg reproduces that instead of just hiding the logo.
    iconBg: "#7c3aed",
    homepage: "https://karakeep.app/",
    image: "ghcr.io/karakeep-app/karakeep:release",
    description: "Self-hosted bookmark manager — saves links, images and notes, full-text indexes them, and can auto-tag with AI (formerly called Hoarder).",
    tags: ["bookmarks", "productivity"],
    ports: [{ container: 3000, host: 3020, label: "Web UI" }],
    volumes: ["./karakeep/data:/data"],
    environment: {
      NEXTAUTH_SECRET: "changeme-generate-with-openssl-rand-base64-36",
      NEXTAUTH_URL: "changeme-http://your-server-ip:3020",
      MEILI_ADDR: "http://karakeep-meilisearch:7700",
      MEILI_MASTER_KEY: "changeme-generate-with-openssl-rand-base64-36",
      DISABLE_SIGNUPS: "false",
    },
    dependsOn: [
      {
        key: "karakeep-meilisearch",
        name: "Meilisearch (for Karakeep)",
        image: "getmeili/meilisearch:v1.41.0",
        volumes: ["./karakeep/meilisearch:/meili_data"],
        environment: {
          MEILI_MASTER_KEY: "changeme-generate-with-openssl-rand-base64-36",
          MEILI_NO_ANALYTICS: "true",
        },
      },
    ],
    notes: "NEXTAUTH_URL must be the exact address you'll actually reach Karakeep at (update the port too if it got auto-remapped due to a conflict), or login breaks. MEILI_MASTER_KEY has to be identical in both this service and Meilisearch's own block below. AI auto-tagging/OCR are optional and left unconfigured — see Karakeep's docs for OPENAI_API_KEY / OLLAMA_BASE_URL if you want them.",
  },

  "music-assistant": {
    name: "Music Assistant",
    icon: `${ICON_BASE}/music-assistant.svg`,
    homepage: "https://music-assistant.io/",
    image: "ghcr.io/music-assistant/server:latest",
    description: "Pulls together your local music and streaming services into one library and plays it to Chromecast, Sonos, AirPlay and DLNA speakers.",
    tags: ["media", "music", "smart-home"],
    networkMode: "host",
    ports: [],
    volumes: ["./music-assistant/data:/data"],
    environment: {},
    notes: "Needs host networking for player discovery (mDNS/uPnP for Chromecast, Sonos, AirPlay) — Docker's bridge network can't see those broadcasts. With network_mode: host it opens its Web UI directly on host port 8095, not through a published ports mapping. Add a read-only volume to /media if you want your own music library indexed too.",
  },

  guacamole: {
    name: "Guacamole",
    icon: `${ICON_BASE}/guacamole.svg`,
    homepage: "https://guacamole.apache.org/",
    image: "jwetzell/guacamole:1.6.0",
    description: "Clientless remote desktop gateway — connect to RDP, VNC and SSH machines from nothing but a browser.",
    tags: ["network", "tools"],
    ports: [{ container: 8080, host: 8080, label: "Web UI" }],
    volumes: ["./guacamole/config:/config"],
    environment: {},
    notes: "This is a community all-in-one build (guacd + web app + its own bundled Postgres in one container) — no separate database to set up, unlike Apache's official multi-container layout. Default login is guacadmin / guacadmin — change it on first login.",
  },

  ntfy: {
    name: "ntfy",
    icon: `${ICON_BASE}/ntfy.svg`,
    homepage: "https://ntfy.sh/",
    image: "binwiederhier/ntfy:latest",
    description: "Simple pub-sub push notification service — send an HTTP request or curl command, get a phone/desktop notification.",
    tags: ["productivity", "tools"],
    ports: [{ container: 80, host: 8580, label: "Web UI" }],
    volumes: ["./ntfy/cache:/var/cache/ntfy", "./ntfy/etc:/etc/ntfy"],
    environment: { TZ: "Etc/UTC" },
    extraLines: ["command: serve"],
    notes: "Runs wide open by default — anyone who can reach it can publish and subscribe to any topic. Add an auth file / access-control rules under ./ntfy/etc if you want to lock it down — see ntfy's docs.",
  },

  pairdrop: {
    name: "PairDrop",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/pairdrop.png",
    homepage: "https://github.com/schlagmichdoch/PairDrop",
    image: "lscr.io/linuxserver/pairdrop:latest",
    description: "AirDrop-style file transfer between devices on the same network — no account or cloud storage in between.",
    tags: ["files", "productivity", "network"],
    ports: [{ container: 3000, host: 3010, label: "Web UI" }],
    volumes: [],
    environment: { PUID: "1000", PGID: "1000", TZ: "Etc/UTC" },
    notes: "Works over plain HTTP on a LAN, but the actual file transfer (WebRTC) needs HTTPS to work from outside your local network — put it behind a reverse proxy with a real certificate for remote use.",
  },

  filebrowser: {
    name: "Filebrowser",
    icon: `${ICON_BASE}/filebrowser.svg`,
    homepage: "https://github.com/filebrowser/filebrowser",
    image: "filebrowser/filebrowser:latest",
    description: "A lightweight web file manager — browse, upload, rename and share files from any folder on the host.",
    tags: ["files", "tools"],
    ports: [{ container: 80, host: 8082, label: "Web UI" }],
    volumes: ["./filebrowser/data:/srv"],
    environment: {},
    notes: "Default login is admin / admin — change it immediately after first login. Only the browsed folder is persisted here, so settings/users reset if the container is recreated — mount a file to /database.db yourself if you want those to survive too.",
  },

  "stirling-pdf": {
    name: "Stirling PDF",
    icon: `${ICON_BASE}/stirling-pdf.svg`,
    homepage: "https://www.stirlingpdf.com/",
    image: "stirlingtools/stirling-pdf:latest",
    description: "A Swiss-army-knife web UI for PDFs — merge, split, compress, convert, OCR, watermark, and dozens more operations.",
    tags: ["productivity", "documents", "tools"],
    ports: [{ container: 8080, host: 8083, label: "Web UI" }],
    volumes: ["./stirling-pdf/data:/configs"],
    environment: {},
    notes: "Wide open with no login by default — see the Docker Installation guide at docs.stirlingpdf.com if you want accounts/login (DOCKER_ENABLE_SECURITY and related settings).",
  },

  wud: {
    name: "What's up Docker",
    icon: `${ICON_BASE}/whats-up-docker.svg`,
    homepage: "https://getwud.github.io/wud/",
    image: "getwud/wud:latest",
    description: "Watches your running containers and tells you when a newer image is available — an update checker, not an auto-updater.",
    tags: ["docker", "monitoring", "updates"],
    ports: [{ container: 3000, host: 3030, label: "Web UI" }],
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"],
    environment: { WUD_AUTH_ADMIN_USER: "admin", WUD_AUTH_ADMIN_PASSWORD: "changeme" },
    notes: "Mounts the Docker socket (read-only) to see every container's current vs. latest image tag — only run it on a trusted host.",
  },

  "docker-socket-proxy": {
    name: "Docker Socket Proxy",
    icon: placeholderIcon("D"),
    homepage: "https://github.com/Tecnativa/docker-socket-proxy",
    image: "tecnativa/docker-socket-proxy:latest",
    description: "A hardened, read-only-by-default proxy in front of the Docker socket — lets other containers query Docker without giving them root on the host.",
    tags: ["security", "docker"],
    ports: [],
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"],
    environment: {
      CONTAINERS: "1",
      IMAGES: "1",
      NETWORKS: "1",
      VOLUMES: "1",
      INFO: "1",
      POST: "0",
      AUTH: "0",
      SECRETS: "0",
      EXEC: "0",
    },
    notes: "No host port is published on purpose — other containers reach it over the internal Docker network at docker-socket-proxy:2375 (set their DOCKER_HOST to that). Ships read-only; a tool that needs to start/stop containers through it additionally needs POST: 1 plus the specific ALLOW_START/ALLOW_STOP/ALLOW_RESTARTS variables — see the project's README for the full list.",
  },

  remotely: {
    name: "Remotely",
    icon: placeholderIcon("R"),
    homepage: "https://github.com/immense/Remotely",
    image: "immybot/remotely:latest",
    description: "Self-hosted remote support and remote access tool — screen sharing and unattended access to your own machines.",
    tags: ["network", "tools"],
    ports: [{ container: 5000, host: 5000, label: "Web UI" }],
    volumes: ["./remotely:/app/AppData"],
    environment: {},
    notes: "Uses SQLite by default, which is fine for a homelab — see the project's docs for PostgreSQL/SQL Server connection strings if you'd rather use one of those. For real remote-access use (not just LAN testing), it needs a reverse proxy with HTTPS and forwarded headers in front — Caddy is the only one the project explicitly supports.",
  },

  filestash: {
    name: "Filestash",
    icon: `${ICON_BASE}/filestash.svg`,
    homepage: "https://www.filestash.app/",
    image: "machines/filestash:latest",
    description: "A web file manager that connects to almost anything — S3, FTP/SFTP, WebDAV, SMB, Google Drive, and your local filesystem alike.",
    tags: ["files", "cloud", "tools"],
    ports: [{ container: 8334, host: 8334, label: "Web UI" }],
    volumes: ["./filestash/data:/app/data/state"],
    environment: {},
    notes: "First visit asks you to set an admin password, then you connect storage backends from the web UI — nothing to configure here. For in-browser document editing, add a Collabora or OnlyOffice container separately and point Filestash at it from Settings.",
  },

  nocodb: {
    name: "NocoDB",
    icon: `${ICON_BASE}/nocodb.svg`,
    homepage: "https://nocodb.com/",
    image: "nocodb/nocodb:latest",
    description: "Turns any database into a smart spreadsheet — an open-source Airtable alternative with its own REST API.",
    tags: ["productivity", "developer"],
    ports: [{ container: 8080, host: 8234, label: "Web UI" }],
    volumes: ["./nocodb/data:/usr/app/data"],
    environment: {},
    notes: "Uses its own embedded SQLite by default — set NC_DB to a Postgres/MySQL connection string if you'd rather point it at an external database.",
  },

  baserow: {
    name: "Baserow",
    icon: `${ICON_BASE}/baserow.svg`,
    homepage: "https://baserow.io/",
    image: "baserow/baserow:latest",
    description: "Another open-source Airtable alternative — a no-code database with a spreadsheet-style UI, its own REST API, and a plugin system.",
    tags: ["productivity", "developer"],
    ports: [{ container: 80, host: 8085, label: "Web UI" }],
    volumes: ["./baserow/data:/baserow/data"],
    environment: { BASEROW_PUBLIC_URL: "changeme-http://your-server-ip:8085" },
    notes: "This is the all-in-one image — it bundles its own Postgres, Redis and Caddy, so there's nothing else to deploy alongside it. BASEROW_PUBLIC_URL must match how you'll actually reach it (update the port too if it got auto-remapped due to a conflict), or logins and file uploads break.",
  },

  glance: {
    name: "Glance",
    icon: `${ICON_BASE}/glance.svg`,
    homepage: "https://github.com/glanceapp/glance",
    image: "glanceapp/glance:latest",
    description: "A fast, no-nonsense dashboard for widgets — RSS, weather, bookmarks, container status and more, all defined in one YAML file.",
    tags: ["dashboard", "productivity"],
    ports: [{ container: 8080, host: 8086, label: "Web UI" }],
    volumes: ["./glance/config:/app/config"],
    environment: {},
    notes: "Needs a glance.yml in ./glance/config before it'll start — copy the example from the project's GitHub repo into that folder first, same idea as Homepage's YAML-based config.",
  },

  grist: {
    name: "Grist",
    icon: `${ICON_BASE}/grist.svg`,
    homepage: "https://www.getgrist.com/",
    image: "gristlabs/grist:latest",
    description: "A spreadsheet that's also a relational database — formulas and a UI like a spreadsheet, but with real data types and linked tables underneath.",
    tags: ["productivity", "developer"],
    ports: [{ container: 8484, host: 8484, label: "Web UI" }],
    volumes: ["./grist:/persist"],
    environment: {
      GRIST_SESSION_SECRET: "changeme-generate-a-random-string",
      GRIST_DEFAULT_EMAIL: "changeme-your-email@example.com",
      GRIST_SINGLE_ORG: "personal",
    },
    notes: "GRIST_DEFAULT_EMAIL becomes the first admin account — sign in with that address on first visit. GRIST_SINGLE_ORG skips Grist's multi-team picker, which isn't useful for a single-user homelab install.",
  },

  "cloudflare-ddns": {
    name: "Cloudflare DDNS",
    icon: `${ICON_BASE}/cloudflare.svg`,
    homepage: "https://github.com/oznu/docker-cloudflare-ddns",
    image: "oznu/cloudflare-ddns:latest",
    description: "Keeps a Cloudflare DNS record pointed at your host's current public IP — handy when your ISP doesn't give you a static one.",
    tags: ["network", "dns", "automation"],
    ports: [],
    volumes: [],
    environment: {
      API_KEY: "changeme-a-cloudflare-scoped-api-token",
      ZONE: "changeme-example.com",
      SUBDOMAIN: "",
      PROXIED: "true",
    },
    notes: "API_KEY needs a scoped Cloudflare API token (DNS edit permission on the zone), not your global API key. Leave SUBDOMAIN blank to update the root domain itself instead of a subdomain.",
  },
};

// Bundles of related services the picker can toggle as one unit — see
// the "Arr Stack" checkbox rendering in app.js. Members stay individually
// toggleable afterward; the bundle checkbox reflects a mixed/indeterminate
// state when only some members are selected.
const STACKS = {
  "arr-stack": {
    name: "Arr Stack",
    description: "All 9 *arr apps, download clients and a unified dashboard — uncheck any you don't want below.",
    tags: ["arr-stack"],
    members: [
      "arr-dashboard",
      "lidarr",
      "prowlarr",
      "qbittorrent",
      "radarr",
      "readarr",
      "sabnzbd",
      "sonarr",
      "seerr",
    ],
  },
};

// Services in alphabetical order by display name — used by the UI so
// the checklist doesn't just reflect object insertion order.
function alphabeticalServiceKeys() {
  return Object.entries(SERVICES)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([key]) => key);
}

// Every unique tag across services and stacks, alphabetically — powers
// the tag filter bar in the UI.
function allTags() {
  const set = new Set();
  for (const def of Object.values(SERVICES)) (def.tags || []).forEach((t) => set.add(t));
  for (const stack of Object.values(STACKS)) (stack.tags || []).forEach((t) => set.add(t));
  return [...set].sort();
}

// Also builds portEntries — one per base port (host editable, default
// tracked for the "still default" highlight) plus one per complete added
// port — for the Settings panel, mirroring how volumeEntries works. These
// reflect the final, post-remap host value, matching what actually lands
// in the compose file/run script; the warnings banner explains *why* a
// value differs from what was typed or from the service's default.
//
// hostPortsInUse (optional) is [{ host, protocol, container }] for ports
// already published by currently-running containers — see live-ports.json
// in app.js. Seeding `used` with these means a selected service's port
// gets flagged and reassigned exactly like an inter-service conflict would,
// just with a message naming the running container instead.
function resolvePortConflicts(selectedKeys, extraPorts, portOverrides, hostPortsInUse) {
  const used = new Set();
  const hostOwners = {}; // portId -> running container name, for a clearer message
  for (const p of hostPortsInUse || []) {
    const portId = `${p.host}/${p.protocol || "tcp"}`;
    used.add(portId);
    hostOwners[portId] = p.container;
  }

  const assignments = {};
  const portEntries = [];
  const warnings = [];

  for (const key of selectedKeys) {
    const svc = SERVICES[key];
    const prefix = key.toUpperCase().replace(/-/g, "_");
    const resolvedPorts = [];
    const entryRefs = []; // portEntries objects, parallel to resolvedPorts, so a
    // remap below can update the same host value the Settings panel reads.

    svc.ports.forEach((p, i) => {
      const portKey = `${prefix}_PORT_${i}`;
      const host = Number(portOverrides?.[portKey] ?? p.host);
      const entry = {
        portKey,
        host,
        container: p.container,
        protocol: p.protocol,
        defaultHost: p.host,
        isExtra: false,
        key,
        owner: svc.name,
      };
      portEntries.push(entry);
      entryRefs.push(entry);
      resolvedPorts.push({ ...p, host });
    });

    (extraPorts?.[key] || [])
      .filter((p) => p.host && p.container)
      .forEach((p, i) => {
        const host = Number(p.host);
        const container = Number(p.container);
        const entry = {
          portKey: `${prefix}_EXTRA_PORT_${i}`,
          host,
          container,
          isExtra: true,
          extraIndex: i,
          key,
          owner: svc.name,
        };
        portEntries.push(entry);
        entryRefs.push(entry);
        resolvedPorts.push({ host, container, label: "Added port" });
      });

    resolvedPorts.forEach((port, i) => {
      const portId = `${port.host}/${port.protocol || "tcp"}`;
      if (used.has(portId)) {
        let candidate = 8000;
        while (used.has(`${candidate}/${port.protocol || "tcp"}`)) candidate++;
        const runningContainer = hostOwners[portId];
        const reason = runningContainer
          ? `is already in use on this host by the running container "${runningContainer}"`
          : `was already taken`;
        warnings.push(`${svc.name}: host port ${port.host} ${reason}, moved ${port.label} to ${candidate}.`);
        port.host = candidate;
        entryRefs[i].host = candidate;
      }
      used.add(`${port.host}/${port.protocol || "tcp"}`);
    });

    assignments[key] = resolvedPorts;
  }

  return { assignments, warnings, portEntries };
}

// Splits "./host/path:/container/path[:mode]" into its parts. Paths
// themselves are assumed colon-free, which holds for every volume string
// in this file.
function parseVolume(volumeStr) {
  const [host, container, mode] = volumeStr.split(":");
  return { host, container, mode };
}

// Builds the YAML lines for one compose service block, plus the list
// of env vars and volume mounts it needs. Used for both top-level
// services and their injected dependencies (e.g. nextcloud-db).
function buildServiceBlock(key, def, ports, ownerName, volumeOverrides, extraVolumes) {
  const lines = [`  ${key}:`, `    image: ${def.image}`, `    container_name: ${key}`, `    restart: unless-stopped`];

  // network_mode is incompatible with a ports: section in compose, so
  // callers that set this also pass an empty ports array.
  if (def.networkMode) lines.push(`    network_mode: ${def.networkMode}`);

  if (def.capAdd && def.capAdd.length) {
    lines.push(`    cap_add:`);
    for (const c of def.capAdd) lines.push(`      - ${c}`);
  }

  if (def.devices && def.devices.length) {
    lines.push(`    devices:`);
    for (const d of def.devices) lines.push(`      - ${d}`);
  }

  // Escape hatch for one-off compose keys (pid, security_opt, ...) that
  // don't warrant a dedicated structured field.
  if (def.extraLines && def.extraLines.length) {
    for (const line of def.extraLines) lines.push(`    ${line}`);
  }

  if (ports && ports.length) {
    lines.push(`    ports:`);
    for (const p of ports) {
      const proto = p.protocol ? `/${p.protocol}` : "";
      lines.push(`      - "${p.host}:${p.container}${proto}"`);
    }
  }

  const volumeEntries = [];
  const volumeLines = [];
  const volPrefix = key.toUpperCase().replace(/-/g, "_");

  for (const [i, v] of (def.volumes || []).entries()) {
    const { host: defaultHost, container, mode } = parseVolume(v);
    const volKey = `${volPrefix}_VOLUME_${i}`;
    const host = volumeOverrides?.[volKey] ?? defaultHost;
    const modeSuffix = mode ? `:${mode}` : "";
    volumeLines.push(`      - ${host}:${container}${modeSuffix}`);
    volumeEntries.push({ volKey, host, container, mode, defaultHost, key, owner: ownerName || def.name });
  }

  // User-added mounts, entirely client-side state — only worth a compose
  // line once both sides are filled in, but always listed for the UI so a
  // half-filled row can still be edited.
  for (const [i, extra] of (extraVolumes?.[key] || []).entries()) {
    if (extra.host && extra.container) {
      volumeLines.push(`      - ${extra.host}:${extra.container}`);
    }
    volumeEntries.push({
      volKey: `${volPrefix}_EXTRA_VOLUME_${i}`,
      host: extra.host,
      container: extra.container,
      isExtra: true,
      extraIndex: i,
      key,
      owner: ownerName || def.name,
    });
  }

  if (volumeLines.length) lines.push(`    volumes:`, ...volumeLines);

  const envEntries = [];
  if (def.environment && Object.keys(def.environment).length) {
    lines.push(`    environment:`);
    const prefix = key.toUpperCase().replace(/-/g, "_");
    for (const [envKey, defaultValue] of Object.entries(def.environment)) {
      const varName = `${prefix}_${envKey}`;
      lines.push(`      - ${envKey}=\${${varName}}`);
      envEntries.push({
        varName,
        key: envKey,
        defaultValue,
        isTimezone: envKey === "TZ",
        needsChange: /^changeme/i.test(String(defaultValue)),
        owner: ownerName || def.name,
      });
    }
  }

  return { lines, envEntries, volumeEntries };
}

// The docker-run equivalent of buildServiceBlock, sharing the same
// networkName across a file's containers the way compose's default
// per-project network would.
function buildRunCommand(key, def, ports, networkName, volumeOverrides, extraVolumes) {
  const args = [`docker run -d`, `--name ${key}`, `--restart unless-stopped`];

  if (def.networkMode) {
    args.push(`--network ${def.networkMode}`);
  } else if (networkName) {
    args.push(`--network ${networkName}`);
  }

  for (const c of def.capAdd || []) args.push(`--cap-add=${c}`);
  for (const d of def.devices || []) args.push(`--device=${d}`);
  for (const a of def.runExtraArgs || []) args.push(a);

  // network_mode is incompatible with -p, same as with compose's ports:.
  if (!def.networkMode) {
    for (const p of ports || []) {
      const proto = p.protocol ? `/${p.protocol}` : "";
      args.push(`-p ${p.host}:${p.container}${proto}`);
    }
  }

  const volPrefix = key.toUpperCase().replace(/-/g, "_");
  (def.volumes || []).forEach((v, i) => {
    const { host: defaultHost, container, mode } = parseVolume(v);
    const host = volumeOverrides?.[`${volPrefix}_VOLUME_${i}`] ?? defaultHost;
    const modeSuffix = mode ? `:${mode}` : "";
    args.push(`-v ${host}:${container}${modeSuffix}`);
  });
  for (const extra of extraVolumes?.[key] || []) {
    if (extra.host && extra.container) args.push(`-v ${extra.host}:${extra.container}`);
  }

  const prefix = key.toUpperCase().replace(/-/g, "_");
  for (const envKey of Object.keys(def.environment || {})) {
    args.push(`-e ${envKey}="\${${prefix}_${envKey}}"`);
  }

  args.push(def.image);

  // Trailing args after the image — a command override (e.g. authentik's
  // "server"/"worker", or Traefik's static-config flags), unlike
  // runExtraArgs above which are docker run *flags* and must come first.
  for (const a of def.runCommandArgs || []) args.push(a);

  return args.map((a, i) => (i === 0 ? a : `  ${a}`)).join(" \\\n");
}

// Wraps a list of `docker run` / `docker network create` lines into a
// runnable script that sources the matching .env file first, so the
// same values the compose version reads from it are available here too.
function wrapRunScript(bodyLines, envFilename) {
  const header = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    `# Reuses ${envFilename}, the same file the docker-compose version generates.`,
    "set -a",
    `source ./${envFilename}`,
    "set +a",
    "",
  ];
  return (
    header
      .concat(bodyLines)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

// One compose file covering every selected service (+ their
// dependencies). This is the original v1 behavior.
function generateCombined(selectedKeys, volumeOverrides, extraVolumes, extraPorts, portOverrides, hostPortsInUse) {
  const { assignments, warnings, portEntries } = resolvePortConflicts(
    selectedKeys,
    extraPorts,
    portOverrides,
    hostPortsInUse
  );
  const lines = ["services:"];
  const networkName = "homelab-net";
  const runLines = [`docker network create ${networkName} 2>/dev/null || true`, ""];
  const envEntries = [];
  const volumeEntries = [];
  const notes = [];

  for (const key of selectedKeys) {
    const def = SERVICES[key];
    const block = buildServiceBlock(key, def, assignments[key], def.name, volumeOverrides, extraVolumes);
    lines.push(...block.lines);
    envEntries.push(...block.envEntries);
    volumeEntries.push(...block.volumeEntries);
    runLines.push(buildRunCommand(key, def, assignments[key], networkName, volumeOverrides, extraVolumes), "");

    for (const dep of def.dependsOn || []) {
      const depBlock = buildServiceBlock(dep.key, dep, [], dep.name, volumeOverrides, extraVolumes);
      lines.push(...depBlock.lines);
      envEntries.push(...depBlock.envEntries);
      volumeEntries.push(...depBlock.volumeEntries);
      runLines.push(buildRunCommand(dep.key, dep, [], networkName, volumeOverrides, extraVolumes), "");
    }

    if (def.notes) notes.push(def.notes);
  }

  return {
    compose: lines.join("\n") + "\n",
    run: wrapRunScript(runLines, ".env"),
    envEntries,
    volumeEntries,
    portEntries,
    warnings,
    notes,
  };
}

// One compose file per top-level selected service. A service's
// injected dependency (e.g. nextcloud-db) stays bundled with it in
// the same file, since they need to share a default network to find
// each other by container name.
function generateSeparate(selectedKeys, volumeOverrides, extraVolumes, extraPorts, portOverrides, hostPortsInUse) {
  const { assignments, warnings, portEntries } = resolvePortConflicts(
    selectedKeys,
    extraPorts,
    portOverrides,
    hostPortsInUse
  );
  const files = selectedKeys.map((key) => {
    const def = SERVICES[key];
    const lines = ["services:"];
    const networkName = `${key}-net`;
    const runLines = [`docker network create ${networkName} 2>/dev/null || true`, ""];
    const envEntries = [];
    const volumeEntries = [];

    const block = buildServiceBlock(key, def, assignments[key], def.name, volumeOverrides, extraVolumes);
    lines.push(...block.lines);
    envEntries.push(...block.envEntries);
    volumeEntries.push(...block.volumeEntries);
    runLines.push(buildRunCommand(key, def, assignments[key], networkName, volumeOverrides, extraVolumes), "");

    for (const dep of def.dependsOn || []) {
      const depBlock = buildServiceBlock(dep.key, dep, [], dep.name, volumeOverrides, extraVolumes);
      lines.push(...depBlock.lines);
      envEntries.push(...depBlock.envEntries);
      volumeEntries.push(...depBlock.volumeEntries);
      runLines.push(buildRunCommand(dep.key, dep, [], networkName, volumeOverrides, extraVolumes), "");
    }

    return {
      filename: `docker-compose.${key}.yml`,
      key,
      name: def.name,
      compose: lines.join("\n") + "\n",
      run: wrapRunScript(runLines, `.env.${key}`),
      envEntries,
      volumeEntries,
      portEntries: portEntries.filter((e) => e.key === key),
      notes: def.notes ? [def.notes] : [],
    };
  });

  return { files, warnings };
}

// Turns a list of {varName, defaultValue} plus a map of user-edited
// overrides into the final .env text.
function renderEnvFile(envEntries, overrides) {
  return envEntries.map((e) => `${e.varName}=${overrides[e.varName] ?? e.defaultValue}`).join("\n") + "\n";
}
