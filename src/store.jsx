// 앱 상태 + 화면 이동. 로보독 PWA 구조(core.js 의 render, screens/*)를 React 로 옮긴 것.
// 라우터 없이 go(name) 으로 이동하고, back() 은 지나온 화면으로 돌아감(보호자 앱 TopBar 의 navigate(-1) 과 같은 역할).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EPISODES, byId } from './lib/episodes.js';
import { Geo, nearestEpisode } from './lib/geo.js';

const KEY = 'byeol-night:v1';
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
  const [stack, setStack] = useState([{ name: 'home', ep: null }]);
  const [stamps, setStamps] = useState(saved.stamps || {}); // { ep1: { role: true, escape: false } }
  const [demo, setDemo] = useState(saved.demo || { on: false, ep: 'ep1' });
  const [fresh, setFresh] = useState(null); // 방금 받은 도장 { ep, kind } → 08 상단 "새 도장 획득!"
  const [, tick] = useState(0);
  const geo = useRef(null);

  if (!geo.current) geo.current = new Geo(() => tick((n) => n + 1));
  useEffect(() => { geo.current.start(); }, []);
  useEffect(() => { geo.current.setDemo(demo.on ? byId(demo.ep) : null); }, [demo]);
  useEffect(() => { save({ stamps, demo }); }, [stamps, demo]);

  const screen = stack[stack.length - 1];

  // replace: 지금 화면을 대신함(역할극·방탈출을 끝내고 08 로 갈 때 → 뒤로 가면 05 건물 이야기)
  const go = useCallback((name, ep, { replace = false } = {}) => {
    setStack((st) => {
      const top = st[st.length - 1];
      const next = { name, ep: ep ?? top.ep };
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

  const stamp = useCallback((epId, kind) => {
    setStamps((s) => ({ ...s, [epId]: { ...s[epId], [kind]: true } }));
    setFresh({ ep: epId, kind });
  }, []);

  const pos = geo.current.current();
  const here = nearestEpisode(pos, EPISODES); // { ep, dist } | null
  const count = Object.values(stamps).reduce((n, s) => n + (s.role ? 1 : 0) + (s.escape ? 1 : 0), 0);

  const value = useMemo(
    () => ({
      screen, go, back, ep: byId(screen.ep) || here?.ep || EPISODES[0],
      stamps, stamp, count, fresh, clearFresh: () => setFresh(null),
      demo, setDemo, pos, geoError: geo.current.error, here,
    }),
    [screen, go, back, stamps, stamp, count, fresh, demo, pos, here],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
