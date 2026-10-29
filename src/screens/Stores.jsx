// 11 쿠폰 사용 가능 카페 — 중앙로역 주변 지도 캡처 위에 쿠폰을 쓸 수 있는 카페 3곳(키코 · 우시아 · 오시우커피) 표시 + 목록 + 카카오맵 길찾기.
// 지도 그림은 원래 비율(890 × 648)을 늘 지켜서(늘이거나 자르지 않음) 표시 위치가 화면 크기와 상관없이 카페 아이콘 위에 정확히 겹침.
// 표시(동그라미 · 이름표)도 지도 크기에 맞춰 같이 커지고 작아짐(container query 단위 cqw).
// 카페 목록 · 지도 위치는 src/lib/cafes.js. 지도 표시나 목록을 누르면 서로 같이 선택됨.
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { distanceM } from '../lib/geo.js';
import { CAFES } from '../lib/cafes.js';
import { api } from '../lib/api.js';
import { Screen, TopBar } from '../ui/Screen.jsx';
import mapImg from '../assets/map.webp'; // 중앙로역 주변 지도 캡처(쿠폰 카페 3곳이 있는 곳)

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

function Cup({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 9h1.5a2.5 2.5 0 0 1 0 5H17" /></svg>;
}

export default function Stores() {
  const { pos } = useApp();
  const [sel, setSel] = useState(CAFES[0].id);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    api.stores().then((rows) => {
      if (alive) { setStores(rows); setError(''); }
    }).catch(() => { if (alive) setError('매장 정보를 불러오지 못했어요'); });
    return () => { alive = false; };
  }, [attempt]);
  const cafes = CAFES.flatMap((c) => {
    const store = stores.find((s) => s.id === c.id);
    return store ? [{ ...c, ...store, map: c.map, tag: c.tag }] : [];
  });
  const list = cafes.map((c) => ({ ...c, d: pos && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? distanceM(pos, c) : null })).sort((a, b) => (a.d ?? 0) - (b.d ?? 0));

  return (
    <Screen className="cafe-screen">
      <TopBar back title="쿠폰 사용 가능 카페" right={<span className="muted">{cafes.filter((s) => s.accepts_coupon).length}곳</span>} />

      <div className="cafe-body">
        <div className="cafe-map-wrap">
          <div className="cafe-map" style={{ backgroundImage: `url(${mapImg})` }} role="group" aria-label="쿠폰 사용 가능 카페 지도 · 중앙로역 주변">
            {cafes.map((c) => (
              <button key={c.id} type="button" className={'cafe-mark' + (sel === c.id ? ' on' : '')} style={{ left: c.map.x + '%', top: c.map.y + '%' }}
                onClick={() => setSel(c.id)} aria-label={c.name} aria-pressed={sel === c.id}>
                <span className="cafe-ring" aria-hidden="true" />
                <span className={'cafe-tag to-' + (c.tag || 'top')}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <main className="cafe-list">
          {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt((n) => n + 1)}>다시 시도</button></p>}
          {!error && cafes.length === 0 && <p className="muted">매장 정보를 확인하고 있어요</p>}
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
                <span className="badge issued">{s.accepts_coupon ? '쿠폰 사용 가능' : '쿠폰 사용 불가'}</span>
                <span className="muted small">{s.hours ? `영업 시간 ${s.hours}` : '영업시간 확인 필요'}</span>
              </div>
              <div className="cafe-card-foot">
                <span className="small">{s.benefit}</span>
                {Number.isFinite(s.lat) && Number.isFinite(s.lng) && <a className="link" href={`https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>길찾기</a>}
              </div>
              {s.demo && <p className="muted small">시연용 · 실제 제휴와 혜택은 확정 전입니다</p>}
            </article>
          ))}
        </main>
      </div>
    </Screen>
  );
}
