export function installMusicalLauncher(): void {
  const app = document.getElementById("app");
  if (!app || document.getElementById("musical-launcher")) return;
  const card = document.createElement("div"); card.className = "card"; card.id = "musical-launcher";
  const link = document.createElement("a"), url = new URL(location.href); url.searchParams.set("musical", "1");
  link.href = url.href; link.textContent = "③ 실사 AR 뮤지컬 MVP";
  link.style.cssText = "display:block;padding:14px;border-radius:8px;background:#9a6a2c;color:white;text-align:center;text-decoration:none;font-weight:700";
  const note = document.createElement("div"); note.className = "hintline"; note.textContent = "별도 공연 화면 · 이미지 추적(iPhone/Android) · 실사 영상 직접 선택";
  card.append(link, note); app.appendChild(card);
}
