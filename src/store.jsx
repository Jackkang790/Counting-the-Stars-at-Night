// 앱 상태 + 화면 이동. 로보독 PWA 구조(core.js 의 render, screens/*)를 React 로 옮긴 것.
// 라우터 없이 go(name) 으로 이동하고, back() 은 지나온 화면으로 돌아감(보호자 앱 TopBar 의 navigate(-1) 과 같은 역할).
// 별은 화면 진행 상태로 여기서 들고(기기에 저장), 서버에도 보냄. 서버가 별 목록을 돌려주면 그걸 따름.
// 쿠폰은 서버가 발급(별자리 완성 판정)한 것을 받아옴. 서버가 없을 땐 예시 쿠폰을 별 6개일 때만 보여줌.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { POINTS, TOTAL_STARS, pointById } from './lib/spots.js';
import { Geo } from './lib/geo.js';
import { api, usingSample } from './lib/api.js';

const KEY = 'byeol-night:v2';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const save = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 못 해도 진행 */ }
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const saved = useRef(load()).current;
  const [stack, setStack] = useState([{ name: 'home', pt: null }]);
  const [stars, setStars] = useState(saved.stars || []); // 별 받은 포인트 id
  const [coupons, setCoupons] = useState([]);
  const [demo, setDemo] = useState(saved.demo || { on: false, pt: POINTS[0].id });
  const [fresh, setFresh] = useState(null); // 방금 받은 별 point id → 별자리 화면 "새 별!"
  const [, tick] = useState(0);
  const geo = useRef(null);

  if (!geo.current) geo.current = new Geo(() => tick((n) => n + 1));
  useEffect(() => { geo.current.start(); }, []);
  useEffect(() => { geo.current.setDemo(demo.on ? pointById(demo.pt) : null); }, [demo]);
  useEffect(() => { save({ demo, stars }); }, [demo, stars]);

  const complete = stars.length >= TOTAL_STARS;

  // 쿠폰 상태는 카페 리더기가 바꾸므로(사용 완료) 쿠폰 화면에선 주기적으로 다시 받아옴
  const refresh = useCallback(async () => {
    try {
      const c = await api.myCoupons();
      setCoupons(usingSample && !complete ? [] : c);
    } catch { /* 연결 안 되면 지난 값 유지 */ }
  }, [complete]);
  useEffect(() => { refresh(); }, [refresh]);

  const screen = stack[stack.length - 1];

  // replace: 지금 화면을 대신함(영상·작품을 다 보고 별자리로 갈 때 → 뒤로 가면 지도)
  const go = useCallback((name, pt, { replace = false } = {}) => {
    setStack((st) => {
      const top = st[st.length - 1];
      const next = { name, pt: pt ?? top.pt };
      const base = replace ? st.slice(0, -1) : st;
      // 이미 지나온 화면으로 가면 그 지점까지 되감아서 뒤로 가기가 빙빙 돌지 않게 함
      const i = base.findIndex((s) => s.name === name);
      return i >= 0 ? [...base.slice(0, i), next] : [...base, next];
    });
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
    window.scrollTo(0, 0);
  }, []);

  // 영상 80% 이상 / 작품 감상 → 별. 같은 포인트 별은 1번만
  const earn = useCallback(async (pointId, watched_ratio = 1) => {
    if (stars.includes(pointId)) return;
    let next = [...stars, pointId];
    try {
      const r = await api.star({ point_id: pointId, watched_ratio });
      if (Array.isArray(r.stars)) next = r.stars; // 서버 판정이 우선
    } catch { /* 연결 안 돼도 화면 진행은 유지, 다음에 다시 보냄 */ }
    setStars(next);
    if (next.includes(pointId)) setFresh(pointId);
  }, [stars]);

  const pos = geo.current.current();

  const value = useMemo(
    () => ({
      screen, go, back, point: pointById(screen.pt) || POINTS[0],
      stars, complete, earn, fresh, clearFresh: () => setFresh(null), coupons, refresh,
      demo, setDemo, pos, geoError: geo.current.error,
    }),
    [screen, go, back, stars, complete, earn, fresh, coupons, refresh, demo, pos],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
