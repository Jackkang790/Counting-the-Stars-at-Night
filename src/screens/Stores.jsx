// 11 쿠폰 사용 가능 카페 — 중앙로역 주변 지도 캡처 위에 쿠폰을 쓸 수 있는 카페 3곳(키코 · 우시아 · 오시우커피) 표시 + 목록 + 카카오맵 길찾기.
// 지도 그림은 원래 비율(890 × 648)을 늘 지켜서(늘이거나 자르지 않음) 표시 위치가 화면 크기와 상관없이 카페 아이콘 위에 정확히 겹침.
// 표시(동그라미 · 이름표)도 지도 크기에 맞춰 같이 커지고 작아짐(container query 단위 cqw).
// 카페 목록 · 지도 위치는 src/lib/cafes.js. 지도 표시나 목록을 누르면 서로 같이 선택됨.
import { useState } from 'react';
import { useApp } from '../store.jsx';
import { distanceM } from '../lib/geo.js';
import { CAFES } from '../lib/cafes.js';
import { Screen, TopBar } from '../ui/Screen.jsx';
import mapImg from '../assets/map.webp'; // 중앙로역 주변 지도 캡처(쿠폰 카페 3곳이 있는 곳)

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

function Cup({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 9h1.5a2.5 2.5 0 0 1 0 5H17" /></svg>;
}

export default function Stores() {
  const { pos } = useApp();
  const [sel, setSel] = useState(CAFES[0].id);
  const list = CAFES.map((c) => ({ ...c, d: pos ? distanceM(pos, c) : null })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0));

  return (
    <Screen className="cafe-screen">
      <TopBar back title="쿠폰 사용 가능 카페" right={<span className="muted">{CAFES.length}곳</span>} />

      <div className="cafe-body">
        <div className="cafe-map-wrap">
          <div className="cafe-map" style={{ backgroundImage: `url(${mapImg})` }} role="group" aria-label="쿠폰 사용 가능 카페 지도 · 중앙로역 주변">
            {CAFES.map((c) => (
              <button key={c.id} type="button" className={'cafe-mark' + (sel === c.id ? ' on' : '')} style={{ left: c.map.x + '%', top: c.map.y + '%' }}
                onClick={() => setSel(c.id)} aria-label={c.name} aria-pressed={sel === c.id}>
                <span className="cafe-ring" aria-hidden="true" />
                <span className={'cafe-tag to-' + (c.tag || 'top')}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <main className="cafe-list">
          <p className="cafe-legend"><span className="cafe-legend-ring" aria-hidden="true" />쿠폰 사용 가능 카페 · 중앙로역 주변</p>
          {list.map((s) => (
            <article key={s.id} className={'cafe-card' + (sel === s.id ? ' on' : '')} onClick={() => setSel(s.id)}>
              <div className="cafe-card-head">
                <span className="cafe-card-ico"><Cup /></span>
                <span className="cafe-card-title">
                  <b>{s.name}</b>
                  <span className="muted small">{s.area}</span>
                </span>
                {s.d != null && <span className="cafe-card-dist">{km(s.d)}</span>}
              </div>
              <div className="cafe-card-tags">
                <span className="badge issued">쿠폰 사용 가능</span>
                <span className="muted small">영업 시간 {s.hours}</span>
              </div>
              <div className="cafe-card-foot">
                <span className="small">{s.benefit}</span>
                <a className="link" href={`https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>길찾기</a>
              </div>
            </article>
          ))}
        </main>
      </div>
    </Screen>
  );
}
