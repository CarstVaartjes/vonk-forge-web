// Sets the theme before first paint so there is no flash. Same key and rule as src/theme.ts.
(function () {
  var stored = null;
  try { stored = localStorage.getItem("vonk-theme"); } catch (e) { /* storage blocked: follow the system */ }
  var light = stored === "light" || (stored !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
})();
