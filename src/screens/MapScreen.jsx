// 02 밤 마실 걷기 지도 — 도착한 스팟만 열림 · 스팟별 별 2개
// 지도 사진은 스팟마다 하나(스팟 파일의 map.img, 팀이 표시한 자리에 핀). 목록에서 스팟을 고르면 그 사진으로 바뀜.
// 데모 모드(발표용): 스팟을 누르면 가상 위치가 그 스팟 앞으로 옮겨가서 바로 열림.
// 지도는 지도 앱처럼 도착한 스팟 쪽으로 부드럽게 옮겨가며 확대(처음 들어올 때 전체 → 확대).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { CONFIG, HOUSES, TOTAL_STAMPS, houseById, missionsOf } from '../lib/spots.js';
import { missionById } from '../lib/missions.js';
import { gpsCheck } from '../lib/geo.js';
import { Screen, TopBar } from '../ui/Screen.jsx';
import Star from '../ui/Star.jsx';

const ZOOM = CONFIG.mapZoom; // 도착한 스팟으로 옮겨갈 때 확대 배율(spots.js CONFIG)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// 지도 칸(w×h)은 화면에 맞는 높이로 고정, 지도 그림은 비율 그대로 칸을 덮음(잘리는 부분은 옮겨서 봄).
// 초점(지도 %)이 칸 가운데 오도록 이동 + 확대. 그림 가장자리 밖이 보이지 않게 이동량을 제한.
const view = (box, f, s, ratio) => {
  const W = Math.max(box.w, box.h * ratio), H = W / ratio;
  const fx = f ? f.x / 100 : 0.5, fy = f ? f.y / 100 : 0.5;
  const tx = clamp(box.w / 2 - fx * W * s, box.w - W * s, 0), ty = clamp(box.h / 2 - fy * H * s, box.h - H * s, 0);
  return { width: W, height: H, transform: `translate(${tx}px, ${ty}px) scale(${s})`, '--s': s };
};

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

// 스팟별 별 2개(글자 없이 별만)
function Pair({ h, has }) {
  return (
    <span className="pair">
      {missionsOf(h).map((m) => <Star key={m.id} on={has(h.id, m.id)} className="sm" />)}
    </span>
  );
}

export default function MapScreen() {
  const { go, count, has, fresh, clearFresh, here, pos, geoError, demo, setDemo, virtual } = useApp();
  // 보고 있는 스팟 사진: 도착한 스팟 > 고른 스팟 > 스팟 1
  const [sel, setSel] = useState(null);
  const focus = here || houseById(sel) || HOUSES[0];
  // 스팟 고르기: 그 사진으로 바꾸고, 데모 모드 또는 위치를 못 쓸 때는 그 앞에 도착한 걸로
  const pick = (h) => { setSel(h.id); if (virtual) setDemo({ ...demo, h: h.id }); };
  // 처음엔 전체 지도 → 잠깐 뒤 도착한 건물로 옮겨가며 확대
  const [ready, setReady] = useState(false);
  // 지도 앱처럼 날아가듯 이동(카카오맵 flyTo): ① 보던 지도가 축소되며 전체로 빠짐 → ② 새 스팟 지도로 겹쳐 바뀜 → ③ 그 스팟으로 확대
  // 처음 들어올 때는 ③만(전체 → 확대)
  const [prev, setPrev] = useState(null); // { h, v } 떠나는 지도(축소 중)
  const lastRef = useRef({ h: focus, v: null, ratio: 1 });
  useEffect(() => {
    const last = lastRef.current;
    const switching = last.h.id !== focus.id && last.v;
    setReady(false);
    const zoomIn = setTimeout(() => setReady(true), switching ? 900 : 350);
    if (!switching) return () => clearTimeout(zoomIn);
    setPrev(last); // 지금 확대 상태로 시작
    const out = setTimeout(() => setPrev((p) => p && { ...p, v: view(boxRef.current ? { w: boxRef.current.clientWidth, h: boxRef.current.clientHeight } : { w: 0, h: 0 }, null, 1, last.ratio), out: true }), 30);
    const gone = setTimeout(() => setPrev(null), 900);
    return () => { clearTimeout(zoomIn); clearTimeout(out); clearTimeout(gone); };
  }, [focus.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 지도 칸 크기 재기(화면 크기 바뀌면 다시)
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 미션을 끝내고 돌아오면 "★ 별 획득" 안내를 잠깐(방금 받은 별 fresh)
  const got = fresh && fresh.split(':');
  const gotHouse = got && houseById(got[0]);
  const gotMission = got && missionById(got[1]);
  useEffect(() => { if (!fresh) return undefined; const t = setTimeout(clearFresh, 2800); return () => clearTimeout(t); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const ratio = focus.map.w / focus.map.h;
  const v = ready && here?.id === focus.id ? view(box, focus.map, ZOOM, ratio) : view(box, null, 1, ratio);
  // 지금 보이는 지도 상태를 기억(렌더가 끝난 뒤 — 다음에 스팟을 바꿀 때 이 상태에서 축소 시작)
  useEffect(() => { lastRef.current = { h: focus, v, ratio }; });

  return (
    <Screen>
      <TopBar back title="밤 마실 걷기 지도" right={<span className="muted">{count}/{TOTAL_STAMPS}</span>} />
      {gotHouse && gotMission && <div className="rp-toast map-toast" role="status">★ 스팟 {gotHouse.no} {gotMission.name} 별 획득 · {count}/{TOTAL_STAMPS}</div>}

      {/* 폰: 지도 위 · 목록 아래 / 넓은 화면(900px~): 지도 왼쪽 · 목록 오른쪽 */}
      <div className="split-body">
      <div className="map live" ref={boxRef} aria-label={`스팟 ${focus.no} ${focus.name} 지도`}>
        {prev && <div key={'leave-' + prev.h.id} className={'map-layer leave' + (prev.out ? ' out' : '')} style={{ ...prev.v, backgroundImage: `url(${prev.h.map.img})` }} aria-hidden="true" />}
        <div key={focus.id} className="map-layer enter" style={{ ...v, backgroundImage: `url(${focus.map.img})` }}>
          <button type="button" className={'pin' + (here?.id === focus.id ? ' open' : '')} style={{ left: focus.map.x + '%', top: focus.map.y + '%' }}
            onClick={() => (here?.id === focus.id ? go('scan', focus.id) : pick(focus))} aria-label={`스팟 ${focus.no} ${focus.name}`}>
            {focus.no}
          </button>
          {pos && here?.id === focus.id && <span className="me" style={{ left: focus.map.x + '%', top: focus.map.y + '%' }} aria-label="내 위치" />}
        </div>
      </div>

      <main className="map-list">
        {!demo.on && (geoError ? <div className="notice">{geoError} · 스팟을 눌러 골라 주세요</div> : !pos && <div className="notice">위치를 찾는 중…</div>)}
        {HOUSES.map((h) => {
          const gps = gpsCheck(pos, h, CONFIG.radius);
          const open = here?.id === h.id;
          const n = h.missions.filter((k) => has(h.id, k)).length;
          const dist = gps.dist != null ? km(gps.dist) : '—';
          return open ? (
            <div key={h.id} className="ep-card open">
              <div className="row">
                <span>
                  <span className="cap">스팟 {h.no} · 도착 {dist}</span>
                  <b className="nm">{h.name}</b>
                </span>
                <Pair h={h} has={has} />
              </div>
              <button type="button" className="btn" onClick={() => go('scan', h.id)}>AR로 옛 모습 깨우기</button>
            </div>
          ) : (
            <button key={h.id} type="button" className="ep-card" onClick={() => pick(h)}>
              <span className="row">
                <span>
                  <span className="cap">스팟 {h.no} · {h.area} · {dist}</span>
                  <b className="nm">{h.name}</b>
                </span>
                <span className="muted small">별 {n}{`/${h.missions.length} · `}{n === h.missions.length ? '완료' : '잠김'}</span>
              </span>
            </button>
          );
        })}
      </main>
      </div>
    </Screen>
  );
}
