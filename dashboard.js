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
  rowsEl.innerHTML = `<tr><td colspan="6" class="dashboard-empty-row">Loading…</td></tr>`;
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
    rowsEl.innerHTML = `<tr><td colspan="6" class="dashboard-empty-row">Couldn't reach the server.</td></tr>`;
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
    .replace(/:[^/:]+$/, ""); // strip a trailing :tag, but not a registry host's :port
}

function buildServiceKeyIndex() {
  serviceKeyIndex = {};
  if (typeof SERVICES !== "object") return;
  for (const key of Object.keys(SERVICES)) {
    const norm = normalizeImage(SERVICES[key].image);
    if (norm) serviceKeyIndex[norm] = key;
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
  if (key === "ports") return c.ports.join(",");
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
    rowsEl.innerHTML = `<tr><td colspan="6" class="dashboard-empty-row">No containers match.</td></tr>`;
    return;
  }

  rowsEl.innerHTML = filtered.map(rowHTML).join("");
  attachRowHandlers();
}

function parsePort(portStr) {
  const m = portStr.match(/^(\d+):(\d+)\/(\w+)$/);
  return m ? { host: m[1], container: Number(m[2]), protocol: m[3] } : null;
}

// The host port to open the running app at, if any. A container can
// publish several (Gitea: SSH on 2222 *and* its web UI on 8001) — Docker
// doesn't say which one a browser wants, so this prefers whichever port
// this tool's own service definition labels as a web UI/dashboard/admin
// page, matched by container-side port number, and only falls back to
// "just the first one" when the image isn't recognized or has no such
// label. Reuses the browser's own address-bar host (same one it's using
// to reach DoComposer) rather than guessing the LAN IP.
function hostPortToOpen(c) {
  const ports = (c.ports || []).map(parsePort).filter(Boolean);
  if (!ports.length) return null;

  const key = serviceKeyFor(c.image);
  const webPortDef = key && (SERVICES[key].ports || []).find((p) => /web ui|dashboard|admin/i.test(p.label || ""));
  if (webPortDef) {
    const match = ports.find(
      (p) => p.container === webPortDef.container && p.protocol === (webPortDef.protocol || "tcp")
    );
    if (match) return match.host;
  }

  return ports[0].host;
}

function rowHTML(c) {
  const running = c.state === "running";
  const ports = c.ports.length ? c.ports.join(", ") : "—";
  const icon = iconFor(c.image);
  const iconBg = iconBgFor(c.image);
  const iconHTML = icon
    ? `<img class="dashboard-table__icon" src="${icon}" alt="" loading="lazy"${iconBg ? ` style="background:${iconBg}; padding:2px; box-sizing:border-box;"` : ""} />`
    : `<span class="dashboard-table__icon dashboard-table__icon--placeholder"><i class="ti ti-box" aria-hidden="true"></i></span>`;
  const hostPort = hostPortToOpen(c);
  const nameHTML = hostPort
    ? `<a class="dashboard-table__name-link" href="http://${location.hostname}:${hostPort}" target="_blank" rel="noopener" title="Open in a new tab">${escapeHtml(c.name)}</a>`
    : `<span>${escapeHtml(c.name)}</span>`;
  return `
    <tr data-name="${escapeHtml(c.name)}">
      <td class="dashboard-table__name">${iconHTML}${nameHTML}</td>
      <td><span class="state-badge state-badge--${escapeHtml(c.state)}">${escapeHtml(c.state)}</span></td>
      <td class="dashboard-table__image" title="${escapeHtml(c.image)}">${escapeHtml(c.image)}</td>
      <td class="dashboard-table__ports">${escapeHtml(ports)}</td>
      <td class="dashboard-table__project">${escapeHtml(c.project || "—")}</td>
      <td class="dashboard-table__actions">
        <div class="dashboard-table__actions-inner">
          <button type="button" class="dashboard-action-btn dashboard-action-btn--start" data-action="start" ${running ? "disabled" : ""} title="Start">
            <i class="ti ti-player-play" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--stop" data-action="stop" ${!running ? "disabled" : ""} title="Stop">
            <i class="ti ti-player-stop" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--restart" data-action="restart" title="Restart">
            <i class="ti ti-refresh" aria-hidden="true"></i>
          </button>
          <button type="button" class="dashboard-action-btn dashboard-action-btn--logs" data-action="logs" title="Logs">
            <i class="ti ti-file-text" aria-hidden="true"></i>
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
  if (action === "remove" && !confirm(`Remove "${name}"? This deletes the container (not its volumes).`)) {
    return;
  }

  const method = action === "remove" ? "DELETE" : "POST";
  const path =
    action === "remove"
      ? `api/containers/${encodeURIComponent(name)}`
      : `api/containers/${encodeURIComponent(name)}/${action}`;

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

boot();
