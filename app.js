const listEl = document.getElementById("service-list");
const serviceSearchEl = document.getElementById("service-search");
const tagFilterEl = document.getElementById("tag-filter");
const showSelectedBtn = document.getElementById("show-selected-btn");
let showSelectedOnly = false; // when true, the list shows only checked services
const warningsEl = document.getElementById("warnings");
const notesEl = document.getElementById("notes");
const settingsBlock = document.getElementById("settings-block");
const settingsList = document.getElementById("settings-list");
const tooltipEl = document.getElementById("custom-tooltip");
const outputFiles = document.getElementById("output-files");
const modeCombinedBtn = document.getElementById("mode-combined");
const modeSeparateBtn = document.getElementById("mode-separate");
const actionsCombined = document.getElementById("actions-combined");
const actionsSeparate = document.getElementById("actions-separate");

let mode = "combined"; // "combined" | "separate"
let currentResult = null; // whatever computeOutputs() last returned
const envOverrides = {}; // varName -> user-edited value, persists across re-renders
const volumeOverrides = {}; // volKey -> user-edited host path, persists across re-renders
const extraVolumes = {}; // serviceKey -> [{ host, container }] user-added mounts
const extraPorts = {}; // serviceKey -> [{ host, container }] user-added port mappings
const portOverrides = {}; // portKey -> user-edited host port for a built-in port, persists across re-renders
let hostPortsInUse = []; // [{ host, protocol, container }] from live-ports.json, refreshed periodically
const hostPortStatusEl = document.getElementById("host-port-status");

// ---- timezone list for the TZ dropdown --------------------------------

function getTimezoneList() {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch (e) {
      // fall through to the fallback list below
    }
  }
  // Fallback for older browsers that don't support Intl.supportedValuesOf.
  return [
    "Etc/UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
    "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
    "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
  ];
}
const TIMEZONES = getTimezoneList();

// ---- checklist (stacks first, then services alphabetically) -------------

function tagsHTML(tags) {
  return `<span class="service-item__tags">${(tags || [])
    .map((t) => `<span class="tag">${t}</span>`)
    .join("")}</span>`;
}

function searchText(name, description, tags) {
  return `${name} ${description} ${(tags || []).join(" ")}`.toLowerCase();
}

for (const stackKey of Object.keys(STACKS)) {
  const stack = STACKS[stackKey];
  const li = document.createElement("li");
  li.className = "service-item service-item--stack";
  li.dataset.searchText = searchText(stack.name, stack.description, stack.tags);
  li.dataset.tags = (stack.tags || []).join(",");
  li.innerHTML = `
    <input type="checkbox" id="stack-${stackKey}" data-stack="${stackKey}" />
    <i class="ti ti-stack-2 icon icon--stack" aria-hidden="true"></i>
    <label class="service-item__body" for="stack-${stackKey}">
      <span class="service-item__name">${stack.name}</span>
      <span class="service-item__desc">${stack.description}</span>
      ${tagsHTML(stack.tags)}
    </label>
  `;
  listEl.appendChild(li);
}

for (const key of alphabeticalServiceKeys()) {
  const def = SERVICES[key];
  const li = document.createElement("li");
  li.className = "service-item";
  li.dataset.searchText = searchText(def.name, def.description, def.tags);
  li.dataset.tags = (def.tags || []).join(",");
  li.innerHTML = `
    <input type="checkbox" id="svc-${key}" data-key="${key}" />
    <img class="icon" src="${def.icon}" alt="" aria-hidden="true" />
    <label class="service-item__body" for="svc-${key}">
      <span class="service-item__name">${def.name}</span>
      <span class="service-item__desc">${def.description}</span>
      ${tagsHTML(def.tags)}
    </label>
    <a class="service-item__link" href="${def.homepage}" target="_blank" rel="noopener noreferrer" title="More info about ${def.name}">
      <i class="ti ti-external-link" aria-hidden="true"></i>
    </a>
  `;
  listEl.appendChild(li);
}

const noResultsEl = document.createElement("li");
noResultsEl.className = "service-list__empty";
noResultsEl.textContent = "No services match your search.";
noResultsEl.hidden = true;
listEl.appendChild(noResultsEl);

// ---- tag filter bar (click a tag to narrow the list; click again to clear) --

const activeTags = new Set();

for (const tag of allTags()) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tag tag--filterable";
  btn.textContent = tag;
  btn.addEventListener("click", () => {
    if (activeTags.has(tag)) {
      activeTags.delete(tag);
      btn.classList.remove("tag--active");
    } else {
      activeTags.add(tag);
      btn.classList.add("tag--active");
    }
    exitShowSelectedOnly();
    applyFilters();
  });
  tagFilterEl.appendChild(btn);
}

// Leaves "show selected" mode (without touching search/tag state) — used
// whenever the user starts filtering again, since combining a fresh filter
// with the review view would be ambiguous.
function exitShowSelectedOnly() {
  if (!showSelectedOnly) return;
  showSelectedOnly = false;
  showSelectedBtn.textContent = "Show selected";
  showSelectedBtn.classList.remove("tag--active");
}

// A row must match the free-text search AND carry at least one active tag —
// unless "show selected" is on, in which case only checked services show,
// regardless of search/tags (it's a full review of everything picked so far).
function applyFilters() {
  const term = serviceSearchEl.value.trim().toLowerCase();
  let anyVisible = false;
  listEl.querySelectorAll("li[data-search-text]").forEach((li) => {
    let match;
    if (showSelectedOnly) {
      const checkbox = li.querySelector("input[data-key]");
      match = !!checkbox && checkbox.checked;
    } else {
      const matchesTerm = !term || li.dataset.searchText.includes(term);
      const tags = li.dataset.tags.split(",").filter(Boolean);
      const matchesTags = activeTags.size === 0 || [...activeTags].some((t) => tags.includes(t));
      match = matchesTerm && matchesTags;
    }
    li.hidden = !match;
    if (match) anyVisible = true;
  });
  noResultsEl.hidden = anyVisible;
  noResultsEl.textContent = showSelectedOnly ? "Nothing selected yet." : "No services match your search.";
}

serviceSearchEl.addEventListener("input", () => {
  exitShowSelectedOnly();
  applyFilters();
});

showSelectedBtn.addEventListener("click", () => {
  showSelectedOnly = !showSelectedOnly;
  showSelectedBtn.textContent = showSelectedOnly ? "Show all" : "Show selected";
  showSelectedBtn.classList.toggle("tag--active", showSelectedOnly);
  if (showSelectedOnly) {
    // Clear other filters so this is a clean review of everything checked,
    // not just whatever happened to match the last search/tag filter.
    serviceSearchEl.value = "";
    activeTags.clear();
    tagFilterEl.querySelectorAll(".tag--active").forEach((b) => b.classList.remove("tag--active"));
  }
  applyFilters();
});

function clearActiveTags() {
  activeTags.clear();
  tagFilterEl.querySelectorAll(".tag--active").forEach((btn) => btn.classList.remove("tag--active"));
  applyFilters();
}

// Only touches actual service checkboxes (not stack meta-checkboxes) and
// only ones currently visible under the search filter.
function setAllVisible(checked) {
  listEl.querySelectorAll("li[data-search-text]:not([hidden]) input[data-key]").forEach((cb) => {
    cb.checked = checked;
  });
  syncStackCheckboxes();
  if (showSelectedOnly) applyFilters(); // e.g. "Deselect all" while reviewing should empty the view
  rebuildAll();
}

// One pill that flips between "Select all" and "Deselect all" on every
// click, instead of two separate buttons.
const selectToggleBtn = document.getElementById("select-toggle-btn");
let selectToggleChecked = true; // what the *next* click will do

selectToggleBtn.addEventListener("click", () => {
  if (!selectToggleChecked) {
    // Deselecting: clear tag filters first so every row is visible again,
    // then the "visible only" scoping in setAllVisible unchecks everything.
    clearActiveTags();
  }
  setAllVisible(selectToggleChecked);
  selectToggleBtn.textContent = selectToggleChecked ? "Deselect all" : "Select all";
  selectToggleBtn.classList.toggle("tag--active", selectToggleChecked);
  selectToggleChecked = !selectToggleChecked;
});

function getSelectedKeys() {
  // Keep alphabetical order regardless of click order, so output order is stable.
  return alphabeticalServiceKeys().filter(
    (key) => document.getElementById(`svc-${key}`).checked
  );
}

// A stack checkbox mirrors its members: checked when all are selected,
// indeterminate when only some are, unchecked when none are.
function syncStackCheckboxes() {
  for (const [stackKey, stack] of Object.entries(STACKS)) {
    const stackBox = document.getElementById(`stack-${stackKey}`);
    if (!stackBox) continue;
    const memberBoxes = stack.members.map((k) => document.getElementById(`svc-${k}`));
    const checkedCount = memberBoxes.filter((b) => b.checked).length;
    stackBox.checked = checkedCount === memberBoxes.length;
    stackBox.indeterminate = checkedCount > 0 && checkedCount < memberBoxes.length;
  }
}

// ---- mode toggle ---------------------------------------------------------

function setMode(newMode) {
  mode = newMode;
  modeCombinedBtn.classList.toggle("is-active", mode === "combined");
  modeCombinedBtn.setAttribute("aria-checked", mode === "combined");
  modeSeparateBtn.classList.toggle("is-active", mode === "separate");
  modeSeparateBtn.setAttribute("aria-checked", mode === "separate");
  actionsCombined.hidden = mode !== "combined";
  actionsSeparate.hidden = mode !== "separate";
  rebuildAll();
}

modeCombinedBtn.addEventListener("click", () => setMode("combined"));
modeSeparateBtn.addEventListener("click", () => setMode("separate"));

// ---- settings panel (editable env vars, TZ gets a dropdown) --------------

const ENV_KEY_HINTS = {
  PUID: "User ID the container runs as. Match it to a real user on your host (run `id -u`) so files it creates come out with the right owner.",
  PGID: "Group ID the container runs as. Match it to a real group on your host (run `id -g`) so files it creates come out with the right group.",
  TZ: "Timezone in IANA format (e.g. Etc/UTC, America/New_York) — used for logs and any scheduled tasks inside the container.",
};

// PUID/PGID/TZ get one shared control across every selected Arr Stack
// member instead of a separate row per service, since these apps usually
// read/write the same folders and should agree on host UID/GID/timezone.
const ARR_GROUPABLE_KEYS = ["PUID", "PGID", "TZ"];

// key -> tooltip HTML, rebuilt on every settings render (and refreshed live
// for changeme fields as the user types). Kept out of the DOM/attributes
// entirely, since the changeme hint needs a <strong> tag and stuffing raw
// HTML into a title="..." attribute both can't render it and is a quoting
// hazard (see the earlier truncation bug).
const tooltipContent = new Map();

function tooltipAttr(key, html) {
  if (!html) return "";
  tooltipContent.set(key, html);
  return ` data-tooltip-key="${key}" tabindex="0"`;
}

function showTooltip(target) {
  const html = tooltipContent.get(target.dataset.tooltipKey);
  if (!html) return;

  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;

  const margin = 8;
  const rect = target.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();

  let left = Math.min(rect.left, window.innerWidth - tipRect.width - margin);
  left = Math.max(margin, left);

  let top = rect.bottom + 6;
  if (top + tipRect.height > window.innerHeight - margin) {
    top = rect.top - tipRect.height - 6; // flip above if there's no room below
  }

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

settingsList.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-tooltip-key]");
  if (el) showTooltip(el);
});
settingsList.addEventListener("mouseout", (e) => {
  if (e.target.closest("[data-tooltip-key]")) hideTooltip();
});
settingsList.addEventListener("focusin", (e) => {
  const el = e.target.closest("[data-tooltip-key]");
  if (el) showTooltip(el);
});
settingsList.addEventListener("focusout", (e) => {
  if (e.target.closest("[data-tooltip-key]")) hideTooltip();
});

function changemeHint(currentValue) {
  return `This is a placeholder — you need to change it to a real value before running docker compose up. Leaving <strong>${escapeHtml(currentValue)}</strong> here is not secure.`;
}

function settingsRowHTML(entry) {
  const current = envOverrides[entry.varName] ?? entry.defaultValue;
  const stillNeedsChange = entry.needsChange && /^changeme/i.test(current);
  const field = entry.isTimezone
    ? `<select data-varname="${entry.varName}">
         ${TIMEZONES.map(
           (tz) => `<option value="${tz}" ${tz === current ? "selected" : ""}>${tz}</option>`
         ).join("")}
       </select>`
    : `<input type="text" data-varname="${entry.varName}" data-needs-change="${entry.needsChange}" value="${current.replace(/"/g, "&quot;")}" />`;

  const hint = entry.needsChange ? changemeHint(current) : ENV_KEY_HINTS[entry.key];

  return `
    <div class="settings-row${stillNeedsChange ? " settings-row--warn" : ""}">
      <label for="field-${entry.varName}"${tooltipAttr(entry.varName, hint)}>${entry.key}</label>
      ${field}
    </div>
  `;
}

// entries is every PUID/PGID/TZ row belonging to a currently-selected Arr
// Stack member; all members share the same defaults, so the first entry
// found for a given key stands in as the group's starting value.
function arrStackGroupHTML(entries) {
  const rows = ARR_GROUPABLE_KEYS.map((key) => {
    const sample = entries.find((e) => e.key === key);
    if (!sample) return "";
    const current = envOverrides[sample.varName] ?? sample.defaultValue;
    const field = sample.isTimezone
      ? `<select data-group-key="${key}">
           ${TIMEZONES.map(
             (tz) => `<option value="${tz}" ${tz === current ? "selected" : ""}>${tz}</option>`
           ).join("")}
         </select>`
      : `<input type="text" data-group-key="${key}" value="${current.replace(/"/g, "&quot;")}" />`;

    return `
      <div class="settings-row">
        <label${tooltipAttr(`group-${key}`, ENV_KEY_HINTS[key])}>${key}</label>
        ${field}
      </div>
    `;
  }).join("");

  return `<div class="settings-group"><div class="settings-group__label">Arr Stack (all selected *arr apps)</div>${rows}</div>`;
}

function getAllEnvEntries() {
  if (!currentResult) return [];
  return currentResult.type === "combined"
    ? currentResult.envEntries
    : currentResult.files.flatMap((f) => f.envEntries);
}

function getAllVolumeEntries() {
  if (!currentResult) return [];
  return currentResult.type === "combined"
    ? currentResult.volumeEntries
    : currentResult.files.flatMap((f) => f.volumeEntries);
}

function getAllPortEntries() {
  if (!currentResult) return [];
  return currentResult.type === "combined"
    ? currentResult.portEntries
    : currentResult.files.flatMap((f) => f.portEntries);
}

// A committed extra mount renders exactly like a built-in volume row (one
// editable host path, fixed container path) plus a Remove link — the
// container path is only ever chosen once, in the add form below.
// A two-column (plus a trailing action column) grid: a header row of plain
// labels, then one grid row per mount/port. Row wrappers use display:contents
// so their cells align under the shared header instead of nesting a table
// inside every entry — see .mount-table in style.css.
function mountTableHTML(leftHeader, rightHeader, rowsHtml) {
  if (!rowsHtml) return "";
  return `
    <div class="mount-table">
      <div class="mount-table__header"><span>${leftHeader}</span><span>${rightHeader}</span><span></span></div>
      ${rowsHtml}
    </div>
  `;
}

function volumeRowHTML(entry) {
  const modeSuffix = entry.mode ? ` (${entry.mode})` : "";

  if (entry.isExtra) {
    const host = entry.host || "";
    return `
      <div class="mount-table__row">
        <input
          type="text"
          data-extra-key="${entry.key}"
          data-extra-index="${entry.extraIndex}"
          data-field="host"
          value="${host.replace(/"/g, "&quot;")}"
        />
        <span class="mount-table__value">${entry.container}</span>
        <button type="button" class="text-link mount-table__remove" data-remove-volume="${entry.key}" data-remove-index="${entry.extraIndex}">Remove</button>
      </div>
    `;
  }

  const current = volumeOverrides[entry.volKey] ?? entry.defaultHost;
  const hint = `The prefilled path (<strong>${escapeHtml(entry.defaultHost)}</strong>) is just a default — change it to any folder on your machine.`;
  const isDefault = current === entry.defaultHost;
  return `
    <div class="mount-table__row">
      <input
        type="text"
        id="field-${entry.volKey}"
        class="${isDefault ? "is-default" : ""}"
        data-volkey="${entry.volKey}"
        data-default-host="${entry.defaultHost.replace(/"/g, "&quot;")}"
        value="${current.replace(/"/g, "&quot;")}"
        ${tooltipAttr(entry.volKey, hint)}
      />
      <span class="mount-table__value">${entry.container}${modeSuffix}</span>
      <span></span>
    </div>
  `;
}

// key -> whether that service's "add a mount" form is currently expanded.
const openAddVolumeForms = new Set();

function addVolumeFormHTML(key) {
  return `
    <div class="inline-add-form">
      <div class="inline-add-form__fields">
        <div class="inline-add-form__field">
          <label>Host folder mount path</label>
          <input type="text" placeholder="./my-service/data" data-new-host="${key}" />
        </div>
        <div class="inline-add-form__field">
          <label>Container mount path</label>
          <input type="text" placeholder="/data" data-new-container="${key}" />
        </div>
      </div>
      <button type="button" class="btn btn--primary btn--sm" data-confirm-add-volume="${key}">Add</button>
      <button type="button" class="text-link" data-cancel-add-volume="${key}">Cancel</button>
    </div>
  `;
}

function addVolumeButtonHTML(key) {
  if (openAddVolumeForms.has(key)) return addVolumeFormHTML(key);
  return `<div class="settings-add-row"><button type="button" class="text-link" data-add-volume="${key}">+ Add volume</button></div>`;
}

// ---- ports (base ports get an editable host value + "still default"
// highlight, same as volumes; added ports lock their container side once
// created, same add-then-lock-one-side pattern) ---------------------------

function portRowHTML(entry) {
  if (entry.isExtra) {
    return `
      <div class="mount-table__row">
        <input
          type="text"
          data-extra-port-key="${entry.key}"
          data-extra-port-index="${entry.extraIndex}"
          value="${String(entry.host).replace(/"/g, "&quot;")}"
        />
        <span class="mount-table__value">${entry.container}</span>
        <button type="button" class="text-link mount-table__remove" data-remove-port="${entry.key}" data-remove-port-index="${entry.extraIndex}">Remove</button>
      </div>
    `;
  }

  const current = entry.host;
  const isDefault = String(current) === String(entry.defaultHost);
  const hint = `The prefilled port (<strong>${entry.defaultHost}</strong>) is just a default — change it if you'd rather reach this service on a different host port.`;
  const protoSuffix = entry.protocol ? ` (${entry.protocol})` : "";
  return `
    <div class="mount-table__row">
      <input
        type="text"
        class="${isDefault ? "is-default" : ""}"
        data-portkey="${entry.portKey}"
        data-default-host="${entry.defaultHost}"
        value="${String(current).replace(/"/g, "&quot;")}"
        ${tooltipAttr(entry.portKey, hint)}
      />
      <span class="mount-table__value">${entry.container}${protoSuffix}</span>
      <span></span>
    </div>
  `;
}

// key -> whether that service's "add a port" form is currently expanded.
const openAddPortForms = new Set();

// Every host port currently in play across selected services (built-in +
// already-added), so the add-port form can refuse a duplicate outright
// instead of silently remapping it like base-port conflicts do.
function usedHostPorts() {
  const ports = new Set();
  for (const key of getSelectedKeys()) {
    const def = SERVICES[key];
    for (const p of def.ports) ports.add(String(p.host));
    for (const dep of def.dependsOn || []) {
      for (const p of dep.ports || []) ports.add(String(p.host));
    }
    for (const extra of extraPorts[key] || []) ports.add(String(extra.host));
  }
  return ports;
}

// key -> error message currently shown in that service's add-port form.
const addPortErrors = {};

function addPortFormHTML(key) {
  const error = addPortErrors[key];
  return `
    <div class="inline-add-form">
      <div class="inline-add-form__fields">
        <div class="inline-add-form__field">
          <label>Host port</label>
          <input type="text" placeholder="8081" data-new-port-host="${key}" />
        </div>
        <div class="inline-add-form__field">
          <label>Container port</label>
          <input type="text" placeholder="80" data-new-port-container="${key}" />
        </div>
      </div>
      ${error ? `<div class="inline-add-form__error">${escapeHtml(error)}</div>` : ""}
      <button type="button" class="btn btn--primary btn--sm" data-confirm-add-port="${key}">Add</button>
      <button type="button" class="text-link" data-cancel-add-port="${key}">Cancel</button>
    </div>
  `;
}

function addPortButtonHTML(key) {
  if (openAddPortForms.has(key)) return addPortFormHTML(key);
  return `<div class="settings-add-row"><button type="button" class="text-link" data-add-port="${key}">+ Add port</button></div>`;
}

function renderSettingsPanel(allEnvEntries, allVolumeEntries, allPortEntries) {
  tooltipContent.clear();
  hideTooltip();

  // Every selected top-level service can always accept an added mount, even
  // one with no env vars or volumes of its own (e.g. IT Tools) — so it needs
  // a settings-group entry regardless of what else it has.
  const topLevelKeys = getSelectedKeys();

  if (
    allEnvEntries.length === 0 &&
    allVolumeEntries.length === 0 &&
    allPortEntries.length === 0 &&
    topLevelKeys.length === 0
  ) {
    settingsBlock.hidden = true;
    settingsList.innerHTML = "";
    return;
  }

  settingsBlock.hidden = false;

  const arrMemberNames = new Set(STACKS["arr-stack"].members.map((k) => SERVICES[k].name));
  const arrGroupEntries = allEnvEntries.filter(
    (e) => arrMemberNames.has(e.owner) && ARR_GROUPABLE_KEYS.includes(e.key)
  );
  // Only worth a shared control once 2+ selected services would actually share it.
  const useArrGroup = new Set(arrGroupEntries.map((e) => e.owner)).size >= 2;

  let html = useArrGroup ? arrStackGroupHTML(arrGroupEntries) : "";

  // Group the remaining env rows and every volume row by owning service so
  // related fields sit together, env rows first then volume rows.
  const byOwnerEnv = {};
  for (const entry of allEnvEntries) {
    if (useArrGroup && arrGroupEntries.includes(entry)) continue;
    (byOwnerEnv[entry.owner] ||= []).push(entry);
  }

  const byOwnerVolumes = {};
  for (const entry of allVolumeEntries) {
    (byOwnerVolumes[entry.owner] ||= []).push(entry);
  }

  const byOwnerPorts = {};
  for (const entry of allPortEntries) {
    (byOwnerPorts[entry.owner] ||= []).push(entry);
  }

  // Only top-level selections get an "add a mount"/"add a port" button —
  // their hidden dependencies (e.g. nextcloud-db) aren't something the user
  // picked directly.
  const ownerToKey = {};
  for (const key of topLevelKeys) ownerToKey[SERVICES[key].name] = key;

  const owners = [
    ...new Set([...Object.keys(byOwnerEnv), ...Object.keys(byOwnerVolumes), ...Object.keys(byOwnerPorts), ...Object.keys(ownerToKey)]),
  ];

  html += owners
    .map((owner) => {
      const envRows = (byOwnerEnv[owner] || []).map(settingsRowHTML).join("");
      const key = ownerToKey[owner];

      const volumeRows = (byOwnerVolumes[owner] || []).map(volumeRowHTML).join("");
      const volumeSection = mountTableHTML("Host folder mount path", "Container path", volumeRows);
      const addVolBtn = key ? addVolumeButtonHTML(key) : "";

      const portRows = (byOwnerPorts[owner] || []).map(portRowHTML).join("");
      const portSection = mountTableHTML("Host port", "Container port", portRows);
      const addPortBtn = key ? addPortButtonHTML(key) : "";

      return `<div class="settings-group"><div class="settings-group__label">${owner}</div>${envRows}${volumeSection}${addVolBtn}${portSection}${addPortBtn}</div>`;
    })
    .join("");

  settingsList.innerHTML = html;
}

settingsList.addEventListener("click", (e) => {
  const addKey = e.target.closest("[data-add-volume]")?.dataset.addVolume;
  if (addKey) {
    openAddVolumeForms.add(addKey);
    rebuildAll(); // structural change (a new form appears), fine to fully re-render
    return;
  }

  const cancelKey = e.target.closest("[data-cancel-add-volume]")?.dataset.cancelAddVolume;
  if (cancelKey) {
    openAddVolumeForms.delete(cancelKey);
    rebuildAll();
    return;
  }

  const confirmBtn = e.target.closest("[data-confirm-add-volume]");
  if (confirmBtn) {
    const confirmKey = confirmBtn.dataset.confirmAddVolume;
    const form = confirmBtn.closest(".inline-add-form");
    const host = form.querySelector("[data-new-host]").value.trim();
    const container = form.querySelector("[data-new-container]").value.trim();
    if (!host || !container) return; // both required before it's worth adding
    (extraVolumes[confirmKey] ||= []).push({ host, container });
    openAddVolumeForms.delete(confirmKey);
    rebuildAll();
    return;
  }

  const removeBtn = e.target.closest("[data-remove-volume]");
  if (removeBtn) {
    const removeKey = removeBtn.dataset.removeVolume;
    const removeIndex = Number(removeBtn.dataset.removeIndex);
    extraVolumes[removeKey]?.splice(removeIndex, 1);
    rebuildAll();
    return;
  }

  const addPortKey = e.target.closest("[data-add-port]")?.dataset.addPort;
  if (addPortKey) {
    openAddPortForms.add(addPortKey);
    delete addPortErrors[addPortKey];
    rebuildAll();
    return;
  }

  const cancelPortKey = e.target.closest("[data-cancel-add-port]")?.dataset.cancelAddPort;
  if (cancelPortKey) {
    openAddPortForms.delete(cancelPortKey);
    delete addPortErrors[cancelPortKey];
    rebuildAll();
    return;
  }

  const confirmPortBtn = e.target.closest("[data-confirm-add-port]");
  if (confirmPortBtn) {
    const confirmPortKey = confirmPortBtn.dataset.confirmAddPort;
    const form = confirmPortBtn.closest(".inline-add-form");
    const host = form.querySelector("[data-new-port-host]").value.trim();
    const container = form.querySelector("[data-new-port-container]").value.trim();

    if (!/^\d+$/.test(host) || !/^\d+$/.test(container)) {
      addPortErrors[confirmPortKey] = "Enter a numeric host port and container port.";
      rebuildAll();
      return;
    }

    if (usedHostPorts().has(host)) {
      addPortErrors[confirmPortKey] = `Host port ${host} is already used by another selected service or port — choose a different one.`;
      rebuildAll();
      return;
    }

    delete addPortErrors[confirmPortKey];
    (extraPorts[confirmPortKey] ||= []).push({ host, container });
    openAddPortForms.delete(confirmPortKey);
    rebuildAll();
    return;
  }

  const removePortBtn = e.target.closest("[data-remove-port]");
  if (removePortBtn) {
    const removePortKey = removePortBtn.dataset.removePort;
    const removePortIndex = Number(removePortBtn.dataset.removePortIndex);
    extraPorts[removePortKey]?.splice(removePortIndex, 1);
    rebuildAll();
  }
});

settingsList.addEventListener("input", (e) => {
  const extraKey = e.target.dataset.extraKey;
  if (extraKey) {
    // Only the host side is ever editable post-commit — the container path
    // is fixed at add time (see the add-volume form above).
    const idx = Number(e.target.dataset.extraIndex);
    const list = (extraVolumes[extraKey] ||= []);
    (list[idx] ||= { host: "", container: "" }).host = e.target.value;
    currentResult = computeOutputs(getSelectedKeys());
    renderOutputPanels(currentResult); // settings DOM untouched, keeps focus
    return;
  }

  const extraPortKey = e.target.dataset.extraPortKey;
  if (extraPortKey) {
    const idx = Number(e.target.dataset.extraPortIndex);
    const list = (extraPorts[extraPortKey] ||= []);
    (list[idx] ||= { host: "", container: "" }).host = e.target.value;
    currentResult = computeOutputs(getSelectedKeys());
    renderOutputPanels(currentResult);
    return;
  }

  const volKey = e.target.dataset.volkey;
  if (volKey) {
    volumeOverrides[volKey] = e.target.value;
    e.target.classList.toggle("is-default", e.target.value === e.target.dataset.defaultHost);

    // Unlike env vars (which are ${VAR} placeholders resolved only in the
    // .env text), volume paths are baked directly into the compose/run
    // output, so that output has to be regenerated — but the settings DOM
    // itself is left alone so the input keeps focus while typing.
    currentResult = computeOutputs(getSelectedKeys());
    renderOutputPanels(currentResult);
    return;
  }

  const portKey = e.target.dataset.portkey;
  if (portKey) {
    portOverrides[portKey] = e.target.value;
    e.target.classList.toggle("is-default", e.target.value === e.target.dataset.defaultHost);
    // Same reasoning as volume paths — the port is baked directly into the
    // compose/run output (and feeds conflict detection), so it needs a
    // full regenerate, but the settings DOM itself stays untouched.
    currentResult = computeOutputs(getSelectedKeys());
    renderOutputPanels(currentResult);
    renderWarnings(currentResult.warnings);
    return;
  }

  const groupKey = e.target.dataset.groupKey;
  if (groupKey) {
    const arrMemberNames = new Set(STACKS["arr-stack"].members.map((k) => SERVICES[k].name));
    for (const entry of getAllEnvEntries()) {
      if (arrMemberNames.has(entry.owner) && entry.key === groupKey) {
        envOverrides[entry.varName] = e.target.value;
      }
    }
    renderOutputPanels(currentResult);
    return;
  }

  const varName = e.target.dataset.varname;
  if (!varName) return;
  envOverrides[varName] = e.target.value;

  if (e.target.dataset.needsChange === "true") {
    const row = e.target.closest(".settings-row");
    const stillPlaceholder = /^changeme/i.test(e.target.value);
    row.classList.toggle("settings-row--warn", stillPlaceholder);
    // Once it's a real value, the "don't leave this as changeme" hint would
    // be misleading (it'd quote back whatever they just typed), so drop it.
    if (stillPlaceholder) {
      tooltipContent.set(varName, changemeHint(e.target.value));
    } else {
      tooltipContent.delete(varName);
    }
  }

  renderOutputPanels(currentResult); // re-render text only, settings DOM untouched
});

// ---- output panels (compose + env previews) ------------------------------

// idBase -> { compose, run } — lets the tab buttons swap a <pre>'s content
// without re-rendering the whole block (and losing scroll position, etc).
const fileBlockContents = new Map();

function fileBlockHTML(id, title, content) {
  return `
    <div class="file-block">
      <div class="file-block__head">
        <div class="file-tabs">
          <span class="file-tab is-active">${title}</span>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-copy="${id}">
          <i class="ti ti-copy" aria-hidden="true"></i> Copy
        </button>
      </div>
      <pre id="${id}">${content}</pre>
    </div>
  `;
}

// Like fileBlockHTML, but for a compose file: the title becomes a
// "docker-compose.yml" / "docker run" tab pair over the same <pre>.
function composeBlockHTML(idBase, composeLabel, composeContent, runContent) {
  fileBlockContents.set(idBase, { compose: composeContent, run: runContent });
  return `
    <div class="file-block">
      <div class="file-block__head">
        <div class="file-tabs" role="tablist">
          <button type="button" class="file-tab is-active" data-tab-target="${idBase}" data-tab="compose" role="tab" aria-selected="true">${composeLabel}</button>
          <button type="button" class="file-tab" data-tab-target="${idBase}" data-tab="run" role="tab" aria-selected="false">docker run</button>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-copy="${idBase}">
          <i class="ti ti-copy" aria-hidden="true"></i> Copy
        </button>
      </div>
      <pre id="${idBase}">${composeContent}</pre>
    </div>
  `;
}

function renderOutputPanels(result) {
  if (!result) {
    outputFiles.innerHTML = "";
    return;
  }

  fileBlockContents.clear();

  if (result.type === "combined") {
    const envText = renderEnvFile(result.envEntries, envOverrides);
    outputFiles.innerHTML =
      composeBlockHTML("compose-output", "docker-compose.yml", escapeHtml(result.compose), escapeHtml(result.run)) +
      fileBlockHTML("env-output", ".env", escapeHtml(envText));
  } else {
    outputFiles.innerHTML = result.files
      .map((f) => {
        const envText = renderEnvFile(f.envEntries, envOverrides);
        return (
          composeBlockHTML(`compose-${f.key}`, f.filename, escapeHtml(f.compose), escapeHtml(f.run)) +
          fileBlockHTML(`env-${f.key}`, `.env.${f.key}`, escapeHtml(envText))
        );
      })
      .join("");
  }

  attachCopyHandlers();
  attachTabHandlers();
}

function attachCopyHandlers() {
  outputFiles.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.onclick = () => {
      const pre = document.getElementById(btn.dataset.copy);
      navigator.clipboard.writeText(pre.textContent);
    };
  });
}

function attachTabHandlers() {
  outputFiles.querySelectorAll(".file-tab").forEach((btn) => {
    btn.onclick = () => {
      const idBase = btn.dataset.tabTarget;
      const stored = fileBlockContents.get(idBase);
      const pre = document.getElementById(idBase);
      pre.innerHTML = btn.dataset.tab === "run" ? stored.run : stored.compose;

      btn.parentElement.querySelectorAll(".file-tab").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active);
      });
    };
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- warnings / notes ------------------------------------------------------

function renderWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    warningsEl.hidden = true;
    return;
  }
  warningsEl.hidden = false;
  warningsEl.innerHTML = warnings
    .map((w) => `<span><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${w}</span>`)
    .join("");
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    notesEl.hidden = true;
    return;
  }
  notesEl.hidden = false;
  notesEl.innerHTML = `<strong>Before you run this:</strong><ol>${notes
    .map((n) => `<li>${n}</li>`)
    .join("")}</ol>`;
}

// ---- top-level orchestration -----------------------------------------------

function computeOutputs(selectedKeys) {
  if (mode === "combined") {
    const { compose, run, envEntries, volumeEntries, portEntries, warnings, notes } = generateCombined(
      selectedKeys,
      volumeOverrides,
      extraVolumes,
      extraPorts,
      portOverrides,
      hostPortsInUse
    );
    return { type: "combined", compose, run, envEntries, volumeEntries, portEntries, warnings, notes };
  }
  const { files, warnings } = generateSeparate(
    selectedKeys,
    volumeOverrides,
    extraVolumes,
    extraPorts,
    portOverrides,
    hostPortsInUse
  );
  const notes = files.flatMap((f) => f.notes);
  return { type: "separate", files, warnings, notes };
}

function rebuildAll() {
  const selected = getSelectedKeys();

  if (selected.length === 0) {
    currentResult = null;
    outputFiles.innerHTML = `<div class="file-block"><div class="file-block__head"><div class="file-tabs"><span class="file-tab is-active">docker-compose.yml</span></div></div><pre>services: {}</pre></div>`;
    settingsBlock.hidden = true;
    warningsEl.hidden = true;
    notesEl.hidden = true;
    return;
  }

  currentResult = computeOutputs(selected);

  renderSettingsPanel(getAllEnvEntries(), getAllVolumeEntries(), getAllPortEntries());
  renderOutputPanels(currentResult);
  renderWarnings(currentResult.warnings);
  renderNotes(currentResult.notes);
}

listEl.addEventListener("change", (e) => {
  const stackKey = e.target.dataset.stack;
  if (stackKey) {
    for (const key of STACKS[stackKey].members) {
      document.getElementById(`svc-${key}`).checked = e.target.checked;
    }
  }
  syncStackCheckboxes();
  if (showSelectedOnly) applyFilters(); // keep the review view in sync as boxes change
  rebuildAll();
});

// ---- downloads ---------------------------------------------------------

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("download-compose").addEventListener("click", () => {
  if (currentResult?.type === "combined") download("docker-compose.yml", currentResult.compose);
});

document.getElementById("download-env").addEventListener("click", () => {
  if (currentResult?.type === "combined") download(".env", renderEnvFile(currentResult.envEntries, envOverrides));
});

document.getElementById("download-zip").addEventListener("click", async () => {
  if (currentResult?.type !== "separate") return;
  const zip = new JSZip();
  for (const f of currentResult.files) {
    zip.file(f.filename, f.compose);
    zip.file(`.env.${f.key}`, renderEnvFile(f.envEntries, envOverrides));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "homelab-compose-files.zip";
  a.click();
  URL.revokeObjectURL(url);
});


// Lets a link like index.html?select=dockge (or a comma-separated list)
// arrive with that service already checked and scrolled into view — used
// by the guide's "add this service in the builder" links.
function applySelectionFromQuery() {
  const keys = new URLSearchParams(window.location.search)
    .get("select")
    ?.split(",")
    .map((k) => k.trim())
    .filter((k) => SERVICES[k]);
  if (!keys || keys.length === 0) return;

  keys.forEach((key) => {
    const checkbox = document.getElementById(`svc-${key}`);
    if (checkbox) checkbox.checked = true;
  });
  syncStackCheckboxes();

  // Jump straight into "Show selected" so a guide link lands on a focused
  // view of just what it asked for, not the full alphabetical list.
  if (!showSelectedOnly) showSelectedBtn.click();

  document.getElementById(`svc-${keys[0]}`)?.closest(".service-item")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

applySelectionFromQuery();
rebuildAll();

// ---- live host port checking (see poll-ports.sh) --------------------------

// Polls the JSON file the container's background script writes from the
// Docker Engine API (only works if the socket is mounted in — see
// docker-compose.yml). A missing/unreachable file is treated as "not
// available" rather than an error, since plenty of deployments won't have
// the socket mounted.
async function refreshHostPortsInUse() {
  try {
    const res = await fetch("live-ports.json", { cache: "no-store" });
    if (!res.ok) throw new Error("not available");
    const data = await res.json();
    const changed = JSON.stringify(data) !== JSON.stringify(hostPortsInUse);
    hostPortsInUse = Array.isArray(data) ? data : [];

    hostPortStatusEl.hidden = false;
    hostPortStatusEl.classList.remove("host-port-status--unavailable");
    hostPortStatusEl.textContent =
      hostPortsInUse.length === 0
        ? "Checking against 0 ports currently in use on this host."
        : `Checking against ${hostPortsInUse.length} port${hostPortsInUse.length === 1 ? "" : "s"} currently in use on this host.`;

    if (changed && currentResult) rebuildAll();
  } catch (e) {
    hostPortsInUse = [];
    hostPortStatusEl.hidden = false;
    hostPortStatusEl.classList.add("host-port-status--unavailable");
    hostPortStatusEl.textContent = "Host port checking unavailable — see the guide for how to enable it.";
  }
}

refreshHostPortsInUse();
setInterval(refreshHostPortsInUse, 5000);
