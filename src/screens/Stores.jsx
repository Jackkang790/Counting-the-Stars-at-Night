// 07 사용 가능 카페 — 원도심 소상공인 카페(대기업·체인점 제외). 약도 + 목록.
// 매장 목록은 서버(GET /stores)에서. 거리는 내 위치 기준으로 화면에서 계산(표시용).
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store.jsx';
import { api } from '../lib/api.js';
import { distanceM } from '../lib/geo.js';
import { SPOTS } from '../lib/spots.js';
import { Screen, TopBar } from '../ui/Screen.jsx';

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

export default function Stores() {
  const { pos } = useApp();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [night, setNight] = useState(false);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    api.stores({ lat: pos?.lat, lng: pos?.lng }).then(setList).catch(() => setErr(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (list || [])
    .filter((s) => (!openNow || s.open_now) && (!night || s.night))
    .map((s) => ({ ...s, d: pos ? distanceM(pos, s) : null }))
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0)), [list, openNow, night, pos]);

  // 약도: 카페 + 세 스팟이 다 들어오게 위경도를 화면 % 로
  const box = useMemo(() => {
    const all = [...(list || []), ...SPOTS.map((s) => s.points[0])];
    if (!all.length) return null;
    const lats = all.map((a) => a.lat), lngs = all.map((a) => a.lng);
    return { a: Math.min(...lats), b: Math.max(...lats), c: Math.min(...lngs), d: Math.max(...lngs) };
  }, [list]);
  const at = (o) => ({
    left: 8 + ((o.lng - box.c) / (box.d - box.c || 1)) * 84 + '%',
    top: 10 + ((box.b - o.lat) / (box.b - box.a || 1)) * 80 + '%',
  });

  return (
    <Screen>
      <TopBar back title="사용 가능 카페" />

      <div className="map">
        {box && SPOTS.map((s) => <span key={s.id} className="spot-mark" style={at(s.points[0])}>{s.name}</span>)}
        {box && shown.map((s) => (
          <button key={s.id} type="button" className={'store-pin' + (sel === s.id ? ' on' : '')} style={at(s)} onClick={() => setSel(s.id)} aria-label={s.name}>☕</button>
        ))}
        {box && pos && <span className="me" style={at(pos)} aria-label="내 위치" />}
      </div>

      <main className="map-list">
        <div className="seg">
          <button type="button" className={openNow ? 'on' : ''} onClick={() => setOpenNow((v) => !v)}>지금 영업 중</button>
          <button type="button" className={night ? 'on' : ''} onClick={() => setNight((v) => !v)}>야간 영업</button>
        </div>
        {err && <div className="notice">카페 목록을 불러오지 못했어요</div>}
        {!list && !err && <div className="notice">카페를 찾는 중…</div>}
        {list && !shown.length && <div className="notice">조건에 맞는 카페가 없어요</div>}
        {shown.map((s) => (
          <div key={s.id} className={'store' + (sel === s.id ? ' on' : '')} onClick={() => setSel(s.id)}>
            <div className="row">
              <b>{s.name}</b>
              <span className="muted small">{s.d != null ? km(s.d) : s.area}</span>
            </div>
            <div className="store-tags">
              <span className={'badge ' + (s.open_now ? 'issued' : 'expired')}>{s.open_now ? '영업 중' : '영업 전·후'}</span>
              {s.night && <span className="badge night">야간 영업</span>}
              <span className="muted small">{s.hours}</span>
            </div>
            <div className="row">
              <span className="small">{s.benefit}</span>
              <a className="link" href={`https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lng}`} target="_blank" rel="noreferrer">길찾기</a>
            </div>
          </div>
        ))}
      </main>
    </Screen>
  );
}
