// Applied as early as possible (loaded synchronously in <head>) so the
// saved theme takes effect before first paint — avoids a light/dark flash.
(function () {
  var KEY = "docomposer-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
})();

document.addEventListener("DOMContentLoaded", function () {
  var KEY = "docomposer-theme";
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function render() {
    btn.innerHTML = isDark()
      ? '<i class="ti ti-sun" aria-hidden="true"></i> Light mode'
      : '<i class="ti ti-moon" aria-hidden="true"></i> Dark mode';
    btn.setAttribute("aria-pressed", String(isDark()));
  }

  btn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    render();
  });

  render();
});

// ---- guide page: highlight the anchor for whatever section is in view ----
document.addEventListener("DOMContentLoaded", function () {
  var scrollArea = document.querySelector(".guide-scroll");
  var toc = document.querySelector(".guide-toc");
  if (!scrollArea || !toc || typeof IntersectionObserver === "undefined") return;

  var linkFor = {};
  var sections = [];
  toc.querySelectorAll("a[href^='#']").forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    var section = document.getElementById(id);
    if (!section) return;
    linkFor[id] = a;
    sections.push(section);
  });

  // A thin band near the top of the scroll frame — whichever section's top
  // crosses into it is treated as "currently being read".
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var link = linkFor[entry.target.id];
        if (link) link.classList.toggle("is-active", entry.isIntersecting);
      });
    },
    { root: scrollArea, rootMargin: "0px 0px -70% 0px", threshold: 0 }
  );

  sections.forEach(function (s) { observer.observe(s); });
});
