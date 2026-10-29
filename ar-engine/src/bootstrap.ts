// Additive route: the original engine/UI is loaded unchanged for every existing URL.
if (new URLSearchParams(location.search).get("musical") === "1") {
  void import("./musical/app").then(m => m.mountMusical()).catch(error => {
    const el = document.getElementById("diag-banner");
    if (el) { el.textContent = `공연 화면을 열 수 없습니다: ${String(error)}`; el.style.display = "block"; }
  });
} else {
  void import("./main").then(() => import("./musical/launcher")).then(m => m.installMusicalLauncher());
}
