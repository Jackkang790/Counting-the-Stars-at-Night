// 05 건물 이야기 — 역사 + 이 스팟의 별 2개(house.missions — 스팟마다 다름: 역할극 · 단서 얻기 · 전시 보기 중 2개). 어둡게 한 카메라 위로 올라온 시트.
import { useApp } from '../store.jsx';
import { missionsOf, screenOf } from '../lib/missions.js';
import Camera from '../ui/Camera.jsx';
import Star from '../ui/Star.jsx';
import useDragY from '../ui/useDragY.js';
import { MenuButton } from '../ui/PauseMenu.jsx';
import Sculpture from '../ui/Sculpture.jsx';

export default function Sheet() {
  const { house: h, go, back, has } = useApp();
  // 시트를 아래로 끌어 내리면 04-B 로 돌아감
  const drag = useDragY({ onDown: back });
  const exhibit = h.missions.includes('view'); // 헤레디움: 건물 대신 전시 건축물

  return (
    <div className="ar">
      {/* 관사: 03 · 04-B 와 같은 크기 · 같은 자리의 건물(카메라 화면 그대로, 어둡게) 위로 시트가 올라옴 */}
      <Camera dim scene={exhibit ? 'street' : 'building'} />
      {/* 오른쪽 위 메뉴(☰) — 모든 화면 공통 */}
      <div className="home-menu"><MenuButton dark /></div>
      {/* 시트 위 빈 곳을 누르면 닫힘 */}
      <div className="sheet-bg" onClick={back} />
      {/* 헤레디움: 위에서부터 전시 건축물 → 시트(남는 높이만큼만 커짐). 닫기는 시트 안 오른쪽 위(건물을 가리지 않게) */}
      <div className={'sheet-dock' + (exhibit ? ' full' : '')} style={drag.style}>
      {exhibit && (
        <div className="sheet-house exhibit" onClick={back}>
          <Sculpture form={h.artworks[0].form} title={h.artworks[0].title} />
        </div>
      )}
      <section className="sheet" {...drag.handlers}>
        <div className="row top-row">
          <div>
            <div className="cap">스팟 {h.no} · {h.era}</div>
            <h2>{h.name}</h2>
          </div>
          <button type="button" className="sheet-x" onClick={back}>닫기</button>
        </div>
        <p className="story">{h.story}</p>

        {/* 별 모으기: 스팟마다 역할극 별 하나 · 단서 얻기 별 하나 → 별 6개 → 쿠폰 */}
        <h3>{`이 스팟의 별 ${h.missions.length}개`}</h3>
        {missionsOf(h).map((m, k) => (
          <button key={m.id} type="button" className={'mission' + (k === 0 ? ' dark' : '')} onClick={() => go(screenOf(m, h))}>
            <Star on={has(h.id, m.id)} label={m.name} className="md" />
            <span><b>{m.title}</b><small>{m.desc}</small></span>
          </button>
        ))}

      </section>
      </div>
    </div>
  );
}
