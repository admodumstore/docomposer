const disabledEl = document.getElementById("dashboard-disabled");
const contentEl = document.getElementById("dashboard-content");
const rowsEl = document.getElementById("dashboard-rows");
const countEl = document.getElementById("dashboard-count");
const searchEl = document.getElementById("dashboard-search");

let allContainers = [];
let sortKey = "name";
let sortDir = "asc";

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showState(state) {
  disabledEl.hidden = state !== "disabled";
  contentEl.hidden = state !== "content";
}

async function boot() {
  let enabled = false;
  try {
    const res = await fetch("api/status", { cache: "no-store" });
    if (res.ok) enabled = !!(await res.json()).deployEnabled;
  } catch (e) {
    // no backend reachable — treated the same as "not enabled"
  }

  if (!enabled) {
    showState("disabled");
    return;
  }
  showState("content");
  await loadContainers();
}

async function loadContainers() {
  rowsEl.innerHTML = `<tr><td colspan="7" class="dashboard-empty-row">Loading…</td></tr>`;
  try {
    const res = await fetch("api/containers", { cache: "no-store" });
    if (!res.ok) {
      showState("disabled");
      return;
    }
    const data = await res.json();
    allContainers = data.containers || [];
    renderRows();
  } catch (e) {
    rowsEl.innerHTML = `<tr><td colspan="7" class="dashboard-empty-row">Couldn't reach the server.</td></tr>`;
  }
}

// ---- matching a container's image back to a known service -------------

let serviceKeyIndex = null;

function normalizeImage(img) {
  if (!img || img.indexOf("sha256:") === 0) return null;
  return img
    .replace(/^docker\.io\/library\//, "")
    .replace(/^docker\.io\//, "")
    .replace(/^library\//, "")
    .replace(/^lscr\.io\//, "") // linuxserver's own registry mirror of the same docker.io/linuxserver/* images
    .replace(/:[^/:]+$/, ""); // strip a trailing :tag, but not a registry host's :port
}

// Some catalog entries have well-known alternate images that are the same
// service in practice (most often a LinuxServer build of something whose
// catalog entry uses the vendor's own image) — see imageAliases below.
// Without this, a container running one of those doesn't just lose its
// icon: for a service with more than one published port, failing to match
// at all means the "open in browser" link falls back to whichever port
// Docker happens to list first, which isn't necessarily the web UI (this
// is exactly how Plex's link ended up pointing at its DLNA port instead).
function buildServiceKeyIndex() {
  serviceKeyIndex = {};
  if (typeof SERVICES !== "object") return;
  for (const key of Object.keys(SERVICES)) {
    const norm = normalizeImage(SERVICES[key].image);
    if (norm) serviceKeyIndex[norm] = key;
    for (const alias of SERVICES[key].imageAliases || []) {
      const aliasNorm = normalizeImage(alias);
      if (aliasNorm) serviceKeyIndex[aliasNorm] = key;
    }
  }
}

function serviceKeyFor(image) {
  if (!serviceKeyIndex) buildServiceKeyIndex();
  const norm = normalizeImage(image);
  return (norm && serviceKeyIndex[norm]) || null;
}

function iconFor(image) {
  const key = serviceKeyFor(image);
  return (key && SERVICES[key].icon) || null;
}

function iconBgFor(image) {
  const key = serviceKeyFor(image);
  return (key && SERVICES[key].iconBg) || null;
}

// ---- sorting + rendering ------------------------------------------------

function sortValue(c, key) {
  if (key === "ports") return c.ports.map((p) => `${p.host}:${p.container}/${p.protocol}`).join(",");
  if (key === "ip") return [...new Set(c.ports.map((p) => p.ip))].join(",");
  return (c[key] || "").toString().toLowerCase();
}

function renderRows() {
  const term = searchEl.value.trim().toLowerCase();
  let filtered = term
    ? allContainers.filter((c) =>
        [c.name, c.image, c.project].some((f) => (f || "").toLowerCase().includes(term))
      )
    : allContainers.slice();

  filtered.sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  countEl.textContent = `${filtered.length} of ${allContainers.length} container${allContainers.length === 1 ? "" : "s"}`;

  document.querySelectorAll(".dashboard-table th[data-sort]").forEach((th) => {
    th.classList.toggle("is-sorted", th.dataset.sort === sortKey);
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.textContent = th.dataset.sort === sortKey ? (sortDir === "asc" ? "▲" : "▼") : "";
  });

  if (filtered.length === 0) {
    rowsEl.innerHTML = `<tr><td colspan="7" class="dashboard-empty-row">No containers match.</td></tr>`;
    return;
  }

  rowsEl.innerHTML = filtered.map(rowHTML).join("");
  attachRowHandlers();
}

// This tool's own service definition, if it has a port labeled as a web
// UI/dashboard/admin page — used to both pick which port the Name column
// links to and to know when a specific port needs https:// rather than
// http:// (a label containing "https", e.g. Portainer's "Web UI (HTTPS)",
// means the port only serves TLS — plain http:// to it just times out or
// resets).
function webUiPortDef(c) {
  const key = serviceKeyFor(c.image);
  const def = key && (SERVICES[key].ports || []).find((p) => /web ui|dashboard|admin/i.test(p.label || ""));
  if (!def) return null;
  return {
    container: def.container,
    protocol: def.protocol || "tcp",
    scheme: /https/i.test(def.label || "") ? "https" : "http",
  };
}

// The host port (and scheme) to open the running app at, if any. A manual
// override (set via the link action button, stored server-side for
// containers Docker's API gives no usable signal for at all — Sabnzbd
// behind a shared-namespace VPN gateway, say) always wins when present.
// Otherwise: a container can publish several ports (Gitea: SSH on 2222
// *and* its web UI on 8001) — Docker doesn't say which one a browser
// wants, so this prefers whichever port webUiPortDef identifies, matched
// by container-side port number, and only falls back to "just the first
// one" when the image isn't recognized or has no such label. Reuses the
// browser's own address-bar host (same one it's using to reach
// DoComposer) rather than guessing the LAN IP.
function linkFor(c) {
  if (c.linkOverride) return { host: c.linkOverride.port, scheme: c.linkOverride.scheme };

  const ports = c.ports || [];
  if (!ports.length) return null;

  const webPortDef = webUiPortDef(c);
  const scheme = webPortDef ? webPortDef.scheme : "http";
  if (webPortDef) {
    const match = ports.find((p) => p.container === webPortDef.container && p.protocol === webPortDef.protocol);
    // Falls through to "just the first published port" below when someone
    // remapped the container-side port too (not just the host side) — that
    // makes the number itself a guess, but the catalog's own scheme for
    // this service (e.g. Portainer's UI being HTTPS-only) is still known
    // and worth keeping rather than silently reverting to http://.
    if (match) return { host: match.host, scheme };
  }

  return { host: ports[0].host, scheme };
}

// Every TCP host port becomes its own clickable link (opening the same
// way the Name column's link does), so a port number is directly usable
// instead of purely informational — handy for a service's secondary ports
// (e.g. Gitea's SSH port won't open anything useful in a browser, but this
// makes that obvious rather than hiding it). UDP ports aren't linked:
// there's nothing a browser can meaningfully open at one.
function portsHTML(c) {
  if (!c.ports.length) {
    return c.sharedNetworkWith ? `Shares network with ${escapeHtml(c.sharedNetworkWith)}` : "—";
  }

  const webPortDef = webUiPortDef(c);
  const exactMatch = webPortDef && c.ports.find((p) => p.container === webPortDef.container && p.protocol === webPortDef.protocol);
  // No live port matches the catalog's declared web-UI port number — the
  // container side got remapped too, not just the host side (Portainer's
  // real ports are neither 9443 nor 8000, say). Best guess is still the
  // first published port, same as the Name column's own fallback, so it
  // gets the catalog's scheme too rather than every port here silently
  // reverting to http://.
  const fallbackHttpsHost = webPortDef && webPortDef.scheme === "https" && !exactMatch ? c.ports[0].host : null;

  return c.ports
    .map((p) => {
      const hostText = escapeHtml(String(p.host));
      const suffix = `:${escapeHtml(String(p.container))}/${escapeHtml(p.protocol)}`;
      if (p.protocol !== "tcp") return `${hostText}${suffix}`;
      const isDeclaredWebPort = webPortDef && p.container === webPortDef.container && p.protocol === webPortDef.protocol;
      const scheme = isDeclaredWebPort ? webPortDef.scheme : p.host === fallbackHttpsHost ? "https" : "http";
      const href = `${scheme}://${location.hostname}:${p.host}`;
      return `<a class="dashboard-table__port-link" href="${href}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(href)}">${hostText}</a>${suffix}`;
    })
    .join(", ");
}

function rowHTML(c) {
  const running = c.state === "running";
  const portsText = c.ports.length
    ? c.ports.map((p) => `${p.host}:${p.container}/${p.protocol}`).join(", ")
    : c.sharedNetworkWith
    ? `Shares network with ${c.sharedNetworkWith}`
    : "—";
  // Also covers the truncated-with-ellipsis case (see .dashboard-table__ports)
  // for containers publishing a lot of ports — Traccar alone has 100+.
  const portsTitle =
    !c.ports.length && c.sharedNetworkWith
      ? ` title="This container has no ports of its own — it shares ${escapeHtml(c.sharedNetworkWith)}'s network, so any ports it publishes show up on that container instead."`
      : c.ports.length
      ? ` title="${escapeHtml(portsText)}"`
      : "";
  const ips = [...new Set(c.ports.map((p) => p.ip))];
  const ipText = ips.length ? ips.map((ip) => ip || "All interfaces").join(", ") : "—";
  const icon = iconFor(c.image);
  const iconBg = iconBgFor(c.image);
  const iconHTML = icon
    ? `<img class="dashboard-table__icon" src="${icon}" alt="" loading="lazy"${iconBg ? ` style="background:${iconBg}; padding:2px; box-sizing:border-box;"` : ""} />`
    : `<span class="dashboard-table__icon dashboard-table__icon--placeholder"><i class="ti ti-box" aria-hidden="true"></i></span>`;
  const link = linkFor(c);
  // noreferrer (not just noopener): some apps' WebUIs — qBittorrent among
  // them — reject the first request with 401 when it arrives carrying a
  // Referer header pointing back at a different origin (this dashboard),
  // then work fine on a reload once the browser stops sending one.
  const nameHTML = link
    ? `<a class="dashboard-table__name-link" href="${link.scheme}://${location.hostname}:${link.host}" target="_blank" rel="noopener noreferrer" title="Open in a new tab">${escapeHtml(c.name)}</a>`
    : `<span>${escapeHtml(c.name)}</span>`;
  // Health only means anything while a container is actually running —
  // Docker keeps reporting the last-known health for a bit after it stops,
  // which would just be stale/confusing here. "N/A" (not "—") specifically
  // means no healthcheck is configured at all, as distinct from one that's
  // configured and passing.
  const healthHTML = !running
    ? ""
    : c.health
    ? ` <span class="health-badge health-badge--${escapeHtml(c.health)}">${escapeHtml(c.health)}</span>`
    : ` <span class="health-badge health-badge--none">N/A</span>`;
  return `
    <tr data-name="${escapeHtml(c.name)}">
      <td class="dashboard-table__name">${iconHTML}${nameHTML}</td>
      <td class="dashboard-table__ip">${escapeHtml(ipText)}</td>
      <td class="dashboard-table__ports"${portsTitle}>${portsHTML(c)}</td>
      <td class="dashboard-table__image" title="${escapeHtml(c.image)}">${escapeHtml(c.image)}</td>
      <td><span class="state-badge state-badge--${escapeHtml(c.state)}">${escapeHtml(c.state)}</span>${healthHTML}</td>
      <td class="dashboard-table__project">${escapeHtml(c.project || "—")}</td>
      <td class="dashboard-table__actions">
        <div class="dashboard-table__actions-inner">
          <button type="button" class="dashboard-action-btn dashboard-action-btn--start" data-action="start" data-state="${escapeHtml(c.state)}" ${running ? "disabled" : ""} title="Start">
            <i class="ti ti-player-play" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--stop" data-action="stop" data-state="${escapeHtml(c.state)}" ${!running ? "disabled" : ""} title="Stop">
            <i class="ti ti-player-stop" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--restart" data-action="restart" title="Restart">
            <i class="ti ti-refresh" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--logs" data-action="logs" title="Logs">
            <i class="ti ti-file-text" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--link${c.linkOverride ? " is-set" : ""}" data-action="link-override" title="${c.linkOverride ? "Edit manual link" : "Set a manual link (for when DoComposer can't work out the port itself)"}">
            <i class="ti ti-link" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--remove" data-action="remove" title="Remove">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function attachRowHandlers() {
  rowsEl.querySelectorAll("tr[data-name]").forEach((tr) => {
    const name = tr.dataset.name;
    tr.querySelectorAll("[data-action]").forEach((btn) => {
      btn.onclick = () => handleAction(name, btn.dataset.action, btn);
    });
  });
}

async function handleAction(name, action, btn) {
  btn.classList.remove("is-firing");
  // Re-trigger the animation even if it just played (e.g. two quick clicks).
  void btn.offsetWidth;
  btn.classList.add("is-firing");
  setTimeout(() => btn.classList.remove("is-firing"), 350);

  if (action === "logs") {
    openLogs(name);
    return;
  }
  if (action === "link-override") {
    openLinkOverride(name);
    return;
  }
  if (action === "remove" && !confirm(`Remove "${name}"? This deletes the container (not its volumes).`)) {
    return;
  }

  const method = action === "remove" ? "DELETE" : "POST";
  const path =
    action === "remove"
      ? `api/containers/${encodeURIComponent(name)}`
      : `api/containers/${encodeURIComponent(name)}/${action}`;

  // Colored (not just faded) while the request is in flight, so "working
  // on it" reads differently from "not applicable right now" (e.g. Start
  // on an already-running container) — both set `disabled`, but only one
  // of them means something is actually happening.
  btn.classList.add("is-loading");
  btn.disabled = true;
  try {
    const res = await fetch(path, { method });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`${action} failed: ${data.error || "unknown error"}`);
    }
  } catch (e) {
    alert(`${action} failed: couldn't reach the server.`);
  }
  await loadContainers();
}

document.getElementById("dashboard-refresh").addEventListener("click", loadContainers);
searchEl.addEventListener("input", renderRows);

document.querySelectorAll(".dashboard-table th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    if (sortKey === th.dataset.sort) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = th.dataset.sort;
      sortDir = "asc";
    }
    renderRows();
  });
});

// ---- logs modal ------------------------------------------------------

const logsModal = document.getElementById("logs-modal");
const logsTitle = document.getElementById("logs-modal-title");
const logsContent = document.getElementById("logs-modal-content");
const logsTailSelect = document.getElementById("logs-tail-select");
let logsTarget = null;

function openLogs(name) {
  logsTarget = name;
  logsTitle.textContent = `Logs: ${name}`;
  logsContent.textContent = "Loading…";
  logsModal.hidden = false;
  fetchLogs();
}

async function fetchLogs() {
  if (!logsTarget) return;
  logsContent.textContent = "Loading…";
  try {
    const tail = logsTailSelect.value;
    const res = await fetch(`api/containers/${encodeURIComponent(logsTarget)}/logs?tail=${tail}`, { cache: "no-store" });
    const data = await res.json();
    logsContent.textContent = data.logs || "(no output)";
  } catch (e) {
    logsContent.textContent = "Couldn't reach the server.";
  }
}

document.getElementById("logs-modal-close").addEventListener("click", () => {
  logsModal.hidden = true;
  logsTarget = null;
});
document.getElementById("logs-refresh").addEventListener("click", fetchLogs);
logsTailSelect.addEventListener("change", fetchLogs);

// ---- link override modal -----------------------------------------------
// Lets someone manually tell the Dashboard which port/scheme to open a
// container at, for the cases nothing short of reading the app's own
// internal config could resolve automatically (see linkFor's docs above).

const linkOverrideModal = document.getElementById("link-override-modal");
const linkOverrideTitle = document.getElementById("link-override-modal-title");
const linkOverrideScheme = document.getElementById("link-override-scheme");
const linkOverridePort = document.getElementById("link-override-port");
const linkOverrideError = document.getElementById("link-override-error");
let linkOverrideTarget = null;

function openLinkOverride(name) {
  linkOverrideTarget = name;
  linkOverrideTitle.textContent = `Link: ${name}`;
  linkOverrideError.hidden = true;
  const container = allContainers.find((c) => c.name === name);
  const existing = container && container.linkOverride;
  linkOverrideScheme.value = existing ? existing.scheme : "http";
  linkOverridePort.value = existing ? existing.port : "";
  linkOverrideModal.hidden = false;
  linkOverridePort.focus();
}

function closeLinkOverride() {
  linkOverrideModal.hidden = true;
  linkOverrideTarget = null;
}

document.getElementById("link-override-modal-close").addEventListener("click", closeLinkOverride);

document.getElementById("link-override-save").addEventListener("click", async () => {
  if (!linkOverrideTarget) return;
  const port = Number(linkOverridePort.value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    linkOverrideError.textContent = "Enter a port between 1 and 65535.";
    linkOverrideError.hidden = false;
    return;
  }
  try {
    const res = await fetch(`api/containers/${encodeURIComponent(linkOverrideTarget)}/link-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port, scheme: linkOverrideScheme.value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      linkOverrideError.textContent = data.error || "Couldn't save.";
      linkOverrideError.hidden = false;
      return;
    }
  } catch (e) {
    linkOverrideError.textContent = "Couldn't reach the server.";
    linkOverrideError.hidden = false;
    return;
  }
  closeLinkOverride();
  await loadContainers();
});

document.getElementById("link-override-clear").addEventListener("click", async () => {
  if (!linkOverrideTarget) return;
  try {
    await fetch(`api/containers/${encodeURIComponent(linkOverrideTarget)}/link-override`, { method: "DELETE" });
  } catch (e) {
    // best-effort — a failed clear just leaves the previous override in
    // place, which loadContainers() below will reflect either way
  }
  closeLinkOverride();
  await loadContainers();
});

boot();
