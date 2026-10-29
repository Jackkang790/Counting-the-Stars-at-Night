// Additive route: the original engine/UI is loaded unchanged for every existing URL.
if (new URLSearchParams(location.search).get("studio") === "1") {
  void import("./studio/app").then(m=>m.mountStudio()).catch(error=>{console.error(error);document.body.textContent="제작실을 열지 못했습니다. 서버 연결을 확인하세요.";});
} else if (new URLSearchParams(location.search).get("musical") === "1") {
  void import("./musical/app").then(m => m.mountMusical()).catch(error => {
    const el = document.getElementById("diag-banner");
    if (el) { el.textContent = `공연 화면을 열 수 없습니다: ${String(error)}`; el.style.display = "block"; }
  });
} else {
  void import("./main").then(async () => {
    if (new URLSearchParams(location.search).get('tourHost') === '1') {
      document.querySelector('h1')!.textContent = '별의 새싹';
      document.querySelector('#app > .sub')!.textContent = '바닥에 작품을 놓고 가까이에서 감상해 보세요';
      document.getElementById('start-star')!.textContent = '작품 AR 시작';
      for (const id of ['start-align', 'ios-align', 'diag', 'env-info']) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
      }
      const alignHint = document.getElementById('start-align')?.nextElementSibling as HTMLElement | null;
      if (alignHint) alignHint.style.display = 'none';
      document.querySelectorAll<HTMLElement>('#app > details').forEach(el => { el.hidden = true; });
    } else (await import('./musical/launcher')).installMusicalLauncher();
  });
}
