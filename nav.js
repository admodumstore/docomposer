// Shared across all three pages: the Dashboard tab is grayed out until
// the backend confirms DEPLOY_BASE_DIR is actually configured (or, on a
// backend-less deploy like the GitHub Pages demo, stays grayed out
// permanently — a failed fetch is treated the same as "not enabled").
document.addEventListener("DOMContentLoaded", async function () {
  const tab = document.getElementById("dashboard-tab");
  if (!tab) return;

  let enabled = false;
  try {
    const res = await fetch("api/status", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      enabled = !!data.deployEnabled;
    }
  } catch (e) {
    // no backend reachable — stays disabled
  }

  if (!enabled) {
    tab.classList.add("app-tab--disabled");
    tab.setAttribute("aria-disabled", "true");
    tab.title = "Set DEPLOY_BASE_DIR in docker-compose.yml to enable the Dashboard — see the Guide.";
    tab.addEventListener("click", (e) => e.preventDefault());
  }
});
