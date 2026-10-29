export function installMusicalLauncher(): void {
  const app = document.getElementById("app");
  if (!app || document.getElementById("musical-launcher")) return;
  const card = document.createElement("div"); card.className = "card"; card.id = "musical-launcher";
  const link = document.createElement("a"), url = new URL(location.href); url.searchParams.set("musical", "1");
  link.href = url.href; link.textContent = "③ 실사 AR 뮤지컬 MVP";
  link.style.cssText = "display:block;padding:14px;border-radius:8px;background:#9a6a2c;color:white;text-align:center;text-decoration:none;font-weight:700";
  const note = document.createElement("div"); note.className = "hintline"; note.textContent = "사진 없는 웹 공간 추적 · 바닥 탭 배치 · 실사 배우 2명";
  card.append(link, note); app.appendChild(card);
  const quartet=document.createElement("div");quartet.className="card";quartet.id="quartet-launcher";
  const quartetLink=document.createElement("a"),quartetUrl=new URL(url);quartetUrl.searchParams.set("show","quartet");quartetLink.href=quartetUrl.href;quartetLink.textContent="④ 검정 교복 · 4인 3D AR 뮤지컬";quartetLink.style.cssText=link.style.cssText;
  const quartetNote=document.createElement("div");quartetNote.className="hintline";quartetNote.textContent="독립 3D 배우 4명 · 영상 추정 동작 · 10초 공연 · 원본 얼굴 복원 아님";quartet.append(quartetLink,quartetNote);app.appendChild(quartet);
  const lab=document.createElement("div");lab.className="card";lab.id="tracking-lab-launcher";
  const labLink=document.createElement("a");labLink.href="?trackingLab=1&engine=mindar";labLink.textContent="⑤ 건물 사진 추적 비교 · NFT / MindAR";labLink.style.cssText=link.style.cssText;lab.appendChild(labLink);app.appendChild(lab);
}
