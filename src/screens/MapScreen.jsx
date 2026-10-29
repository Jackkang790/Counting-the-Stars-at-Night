// 02 도장깨기 지도 — 도착한 관사만 열림 · 관사별 도장 2개
// 데모 모드(행사장 시연): 핀이나 관사 카드를 누르면 가상 위치가 그 관사로 옮겨가서 바로 열림.
import { useApp } from '../store.jsx';
import { EPISODES, TOTAL_STAMPS } from '../lib/episodes.js';
import { distanceM } from '../lib/geo.js';
import { Screen, TopBar } from '../ui/Screen.jsx';
import { StampPair } from '../ui/chrome.jsx';

export default function MapScreen() {
  const { go, stamps, count, here, pos, geoError, demo, setDemo } = useApp();
  const arrived = here?.ep;
  const pick = (ep) => { if (demo.on) setDemo({ ...demo, ep: ep.id }); };
  const got = (ep) => (stamps[ep.id]?.role ? 1 : 0) + (stamps[ep.id]?.escape ? 1 : 0);

  return (
    <Screen>
      <TopBar back title="도장깨기 지도" right={<span className="muted">{count}/{TOTAL_STAMPS}</span>} />

      <div className="map" aria-label="테미오래 관사촌 지도">
        {/* TODO(현장): 관사촌 약도 이미지로 교체 */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 Q40 30 100 18 M8 100 Q20 60 52 40 T100 70" fill="none" stroke="#c9ccd3" strokeWidth="3" />
        </svg>
        {EPISODES.map((ep) => {
          const open = arrived?.id === ep.id;
          return (
            <button
              key={ep.id}
              type="button"
              className={'pin' + (open ? ' open' : '')}
              style={{ left: ep.map.x + '%', top: ep.map.y + '%' }}
              onClick={() => (open ? go('scan', ep.id) : pick(ep))}
              aria-label={`관사 ${ep.order} ${ep.title}` + (open ? ' · 도착' : ' · 잠김')}
            >
              {ep.order}
            </button>
          );
        })}
        {arrived && <span className="me" style={{ left: arrived.map.x + 2 + '%', top: arrived.map.y + 12 + '%' }} aria-label="내 위치" />}
      </div>

      <main className="map-list">
        {!pos && !demo.on && <div className="notice">{geoError || '위치를 찾는 중…'}</div>}
        {EPISODES.map((ep) => {
          const open = arrived?.id === ep.id;
          const d = pos ? `${Math.round(distanceM(pos, ep))}m` : '거리 확인 중';
          if (open) {
            return (
              <div key={ep.id} className="ep-card open">
                <div className="row">
                  <div>
                    <div className="cap">관사 {ep.order} · 도착 {d}</div>
                    <b className="nm">{ep.title}</b>
                  </div>
                  <StampPair s={stamps[ep.id]} />
                </div>
                <button type="button" className="btn" onClick={() => go('scan', ep.id)}>AR로 옛 모습 깨우기</button>
              </div>
            );
          }
          return (
            <button key={ep.id} type="button" className="ep-card" onClick={() => pick(ep)} disabled={!demo.on}>
              <div className="row">
                <div>
                  <div className="cap">관사 {ep.order} · {d}</div>
                  <b className="nm">{ep.title}</b>
                </div>
                <span className="muted small">도장 {got(ep)}/2 · 잠김</span>
              </div>
            </button>
          );
        })}
      </main>
    </Screen>
  );
}
