// 02 투어 지도 — 세 스팟 · 별 포인트 6곳. 스팟 반경 안에 들어온 포인트만 열림(기능 1.1 ① GPS).
// 데모 모드(행사장 시연): 포인트를 누르면 가상 위치가 그 포인트 위로 옮겨가서 바로 열림.
import { useApp } from '../store.jsx';
import { CONFIG, SPOTS, TOTAL_STARS } from '../lib/spots.js';
import { gpsCheck } from '../lib/geo.js';
import { Screen, TopBar } from '../ui/Screen.jsx';

const KIND = { musical: 'AR 뮤지컬', artwork: '별길 작품' };
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

export default function MapScreen() {
  const { go, stars, pos, geoError, demo, setDemo } = useApp();
  const here = demo.on ? SPOTS.find((s) => s.points.some((p) => p.id === demo.pt)) : null;

  return (
    <Screen>
      <TopBar back title="투어 지도" right={<span className="muted">★ {stars.length}/{TOTAL_STARS}</span>} />

      <div className="map" aria-label="소제동 · 인동 투어 지도">
        {/* TODO(현장): 대전역 동광장 뒤 소제동 → 인동 약도 이미지로 교체 */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 18 Q50 26 100 12" fill="none" stroke="#c9ccd3" strokeWidth="3" />
          <path d="M30 30 Q44 40 52 44 T70 74" fill="none" stroke="#9aa0ad" strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
        <span className="map-tag" style={{ left: '6%', top: '6%' }}>대전역 동광장</span>
        {SPOTS.map((s) => {
          const done = s.points.every((p) => stars.includes(p.id));
          return (
            <span key={s.id} className={'pin' + (here?.id === s.id ? ' open' : '') + (done ? ' done' : '')} style={{ left: s.map.x + '%', top: s.map.y + '%' }}>
              {s.id.toUpperCase()}
            </span>
          );
        })}
        {here && <span className="me" style={{ left: here.map.x + 3 + '%', top: here.map.y + 10 + '%' }} aria-label="내 위치" />}
      </div>

      <main className="map-list">
        {!pos && !demo.on && <div className="notice">{geoError || '위치를 찾는 중…'}</div>}
        {SPOTS.map((s) => (
          <section key={s.id} className="spot">
            <div className="spot-head">
              <b>{s.act} · {s.name}</b>
              <span className="muted small">{s.area}</span>
            </div>
            {s.points.map((p) => {
              const got = stars.includes(p.id);
              const gps = gpsCheck(pos, p, CONFIG.spotRadius);
              const open = !got && gps.ok;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={'pt-row' + (open ? ' open' : '') + (got ? ' got' : '')}
                  onClick={() => (open || got ? go('point', p.id) : demo.on && setDemo({ ...demo, pt: p.id }))}
                >
                  <span className={'pt-star' + (got ? ' on' : '')}>★</span>
                  <span className="pt-text">
                    <span className="cap">{KIND[p.kind]} · {p.label}</span>
                    <b>{p.title}</b>
                  </span>
                  <span className="pt-state">
                    {got ? '받음' : open ? '도착' : gps.dist != null ? km(gps.dist) : '—'}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        <p className="muted small">스팟 근처({CONFIG.spotRadius}m 안)에 가면 별 포인트가 열려요.</p>
      </main>
    </Screen>
  );
}
