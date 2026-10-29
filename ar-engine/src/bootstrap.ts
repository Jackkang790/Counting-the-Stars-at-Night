// Additive route: the original engine/UI is loaded unchanged for every existing URL.
if (new URLSearchParams(location.search).get("trackingLab") === "1") {
  void import("./tracking-lab/app").then(m=>m.mountTrackingLab()).catch(error=>{console.error(error);const el=document.getElementById("lab-status")??document.getElementById("diag-banner");if(el){el.textContent=`추적 비교 화면 오류: ${String(error)}`;el.style.display="block";}});
} else if (new URLSearchParams(location.search).get("studio") === "1") {
  void import("./studio/app").then(m=>m.mountStudio()).catch(error=>{console.error(error);document.body.textContent="제작실을 열지 못했습니다. 서버 연결을 확인하세요.";});
} else if (new URLSearchParams(location.search).get("musical") === "1") {
  void import("./musical/app").then(m => m.mountMusical()).catch(error => {
    const el = document.getElementById("diag-banner");
    if (el) { el.textContent = `공연 화면을 열 수 없습니다: ${String(error)}`; el.style.display = "block"; }
  });
} else {
  void import("./main").then(() => import("./musical/launcher")).then(m => m.installMusicalLauncher());
}
