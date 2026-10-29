// 앱 상태 + 화면 이동. 로보독 PWA 구조(core.js 의 render, screens/*)를 React 로 옮긴 것.
// 라우터 없이 go(name) 으로 이동하고, back() 은 지나온 화면으로 돌아감.
// 도장은 기기에 저장하고 서버에도 보냄(서버가 목록을 돌려주면 그걸 따름).
// 쿠폰은 서버가 발급(별 6개 판정)한 것을 받아옴. 서버가 없을 땐 예시 쿠폰을 별을 다 모았을 때만 보여줌.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HOUSES, STAR_IDS, TOTAL_STAMPS, houseById, stampId } from './lib/spots.js';
import { Geo, gpsCheck } from './lib/geo.js';
import { api, nextSession, resetSession } from './lib/api.js';
import { CONFIG } from './lib/spots.js';

const KEY = 'byeol-night:v5'; // 저장 모양을 바꾸거나 모두 처음부터 시작하게 할 때 숫자를 올림

// 주소 #reset 으로 열면 진행(별 · 회차 · 쿠폰 세션)을 모두 지우고 처음 화면으로 — 발표 전 · 시연 반복용
if (location.hash === '#reset') {
  try { Object.keys(localStorage).filter((k) => k.startsWith('byeol-night')).forEach((k) => localStorage.removeItem(k)); } catch { /* 저장 불가 */ }
  history.replaceState(null, '', location.pathname);
}
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const save = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 못 해도 진행 */ }
};

// 주소(#화면/건물)로 화면을 기억 → 새로고침해도 그 화면, 발표 중 원하는 화면으로 바로 이동 (#stamps, #escape/h2 …)
const SCREEN_NAMES = ['home', 'map', 'scan', 'artwork', 'stage', 'sheet', 'roleplay', 'escape', 'stamps', 'couponbox', 'coupons', 'stores'];
const fromHash = () => {
  const [name, h] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!SCREEN_NAMES.includes(name) || name === 'home') return [{ name: 'home', h: null, arg: null }];
  return [{ name: 'home', h: null, arg: null }, { name, h: houseById(h) ? h : null, arg: null }];
};
const toHash = (s) => (s.name === 'home' ? '#' : `#${s.name}${s.h ? '/' + s.h : ''}`);

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const saved = useRef(load()).current;
  const [stack, setStack] = useState(fromHash);
  const [menu, setMenu] = useState(false); // 보관함(일시정지 메뉴, 어느 화면에서나) — 열려 있으면 타이머 등 멈춤
  const [stamps, setStamps] = useState(saved.stamps || []); // 지금 회차의 별 ['h1:role', ...]
  const [round, setRound] = useState(saved.round || 1); // 회차(1~CONFIG.rounds). 회차마다 쿠폰 1장 · 별자리 배정이 바뀜
  const [coupons, setCoupons] = useState([]);
  const [syncError, setSyncError] = useState('');
  const stampsRef = useRef(stamps);
  const progressEpoch = useRef(0);
  const roundTransition = useRef(false);
  // 해커톤 시연용: 데모 모드(가상 위치 = 건물 1 앞)가 기본으로 켜져 있음 → 와이어프레임처럼 02 에서 바로 "도착".
  // 현장에서 실제 GPS 로 쓰려면 첫 화면 "데모 모드 켜짐 · 끄기".
  const [demo, setDemo] = useState(saved.demo || { on: true, h: HOUSES[0].id });
  const [fresh, setFresh] = useState(null); // 방금 받은 도장 id → 08 "새 도장 획득!"
  const [, tick] = useState(0);
  const geo = useRef(null);

  // 주소로 바로 들어온 경우(#stamps 등): 브라우저 기록을 [홈, 그 화면] 두 칸으로 맞춤 → 뒤로 가기가 앱 밖으로 나가지 않게
  useEffect(() => {
    if (stack.length > 1) {
      try { history.replaceState({ bn: 1 }, '', '#'); history.pushState({ bn: 1 }, '', toHash(stack[1])); } catch { /* 무시 */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!geo.current) geo.current = new Geo(() => tick((n) => n + 1));
  useEffect(() => { geo.current.start(); }, []);
  // 위치 권한이 없거나 GPS 가 안 잡히면(강당·실내) 데모 모드가 꺼져 있어도 지도에서 고른 건물 앞에 있는 걸로 → 막히지 않게
  const noGps = !geo.current.pos && !!geo.current.error;
  const virtual = demo.on || noGps;
  useEffect(() => { geo.current.setDemo(virtual ? houseById(demo.h) : null); }, [demo, virtual]);
  useEffect(() => { save({ demo, stamps, round }); }, [demo, stamps, round]);

  // 스팟마다 그 스팟 미션(house.missions) 별만 셈
  const count = stamps.filter((s) => STAR_IDS.includes(s)).length;
  const complete = count >= TOTAL_STAMPS;
  const roundsDone = round - 1 + (complete ? 1 : 0); // 쿠폰을 받은 회차 수
  const canReplay = complete && round < CONFIG.rounds;

  // 쿠폰 상태는 카페 리더기가 바꾸므로(사용 완료) 쿠폰 화면에선 주기적으로 다시 받아옴
  const refresh = useCallback(async (pending = stampsRef.current) => {
    const epoch = progressEpoch.current;
    try {
      const result = await api.syncProgress(pending, roundsDone);
      if (epoch !== progressEpoch.current) return false;
      const merged = [...new Set([...stampsRef.current, ...result.stamps])].filter((id) => STAR_IDS.includes(id));
      stampsRef.current = merged;
      setStamps(merged);
      setCoupons(result.coupons);
      setSyncError('');
      return true;
    } catch (error) {
      if (epoch === progressEpoch.current && !error.cancelled) setSyncError('별 저장 대기 중 · 연결 후 다시 시도해 주세요');
      return false;
    }
  }, [roundsDone]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const retry = () => { void refresh(); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [refresh]);

  const screen = stack[stack.length - 1];
  const screenRef = useRef(screen);
  screenRef.current = screen;
  // 주소(#화면/건물)를 지금 화면에 맞춤(go 에서 건물 id 를 생략한 경우까지 채움)
  useEffect(() => {
    const url = toHash(screen);
    if (location.hash !== url && !(url === '#' && !location.hash)) {
      try { history.replaceState(history.state, '', url); } catch { /* 무시 */ }
    }
  }, [screen]);

  // replace: 지금 화면을 대신함 / arg: 화면에 넘길 값(쿠폰 id 등)
  const go = useCallback((name, h, { replace = false, arg = null } = {}) => {
    if (screenRef.current.name === 'stamps' && name !== 'stamps') setFresh(null); // "새 별 획득!" 은 받은 직후 한 번만(08 을 떠날 때 지움)
    setStack((st) => {
      const top = st[st.length - 1];
      const next = { name, h: h ?? top.h, arg };
      const base = replace ? st.slice(0, -1) : st;
      // 이미 지나온 화면으로 가면 그 지점까지 되감아서 뒤로 가기가 빙빙 돌지 않게 함
      const i = base.findIndex((s) => s.name === name);
      return i >= 0 ? [...base.slice(0, i), next] : [...base, next];
    });
    // 폰 뒤로 가기(안드로이드 뒤로 버튼·제스처)도 앱 안에서 한 화면 뒤로 가게 브라우저 기록에 한 칸씩 쌓음
    const url = toHash({ name, h: h ?? null });
    try { if (replace) history.replaceState({ bn: 1 }, '', url); else history.pushState({ bn: 1 }, '', url); } catch { /* 무시 */ }
    setMenu(false);
    window.scrollTo(0, 0);
  }, []);

  const pop = useCallback(() => {
    // 뒤로 가기면 한 칸 되감고, 주소(#)를 직접 바꿔 들어온 거면 그 화면으로
    const now = location.hash || '#';
    if (screenRef.current.name === 'stamps') setFresh(null);
    setStack((st) => (st.length > 1 && toHash(st[st.length - 2]) === now ? st.slice(0, -1) : fromHash()));
    setMenu(false);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [pop]);
  // 화면의 ‹ 버튼 = 폰 뒤로 가기와 같은 길(브라우저 기록 한 칸 뒤로 → popstate → pop)
  const back = useCallback(() => {
    if (stack.length > 1) history.back();
  }, [stack.length]);

  // 역할극 장면 완료 / 단서 얻기 퍼즐 완료 / 전시 보기 → 별. 같은 별은 1번만, 그 스팟 미션(house.missions)만.
  // 받았으면 받은 뒤 별 개수(이미 받았거나 이 스팟 미션이 아니면 false → "새 별" 안내 없음)
  const stamp = useCallback(async (houseId, kind) => {
    const id = stampId(houseId, kind);
    if (stampsRef.current.includes(id) || !STAR_IDS.includes(id)) return false;
    const next = [...stampsRef.current, id];
    stampsRef.current = next;
    setStamps(next);
    setFresh(id);
    // 미션별 별을 저장한다. 연결이 끊겨도 로컬 별을 보관해 다음 연결에 복구한다.
    await refresh(next);
    return next.filter((s) => STAR_IDS.includes(s)).length;
  }, [refresh]);

  // 미션을 끝냈을 때: 별 받고 → 02 지도로(지도 위에 "★ 별 획득" 안내). 별 6개를 다 모은 순간만 08 나의 별자리(완성 · 쿠폰).
  const finish = useCallback(async (houseId, kind) => {
    const epoch = progressEpoch.current;
    const startedAt = screenRef.current;
    const n = await stamp(houseId, kind);
    if (epoch !== progressEpoch.current || screenRef.current !== startedAt) return;
    go((n === false ? count : n) >= TOTAL_STAMPS ? 'stamps' : 'map', null, { replace: true });
  }, [stamp, go, count]);

  // 다음 회차: 새 서버 세션(새 쿠폰) · 별 0개 · 별자리 배정이 바뀜 · 지도로
  const nextRound = useCallback(async () => {
    if (!canReplay || roundTransition.current) return;
    roundTransition.current = true;
    try {
      if (!await refresh()) return;
      progressEpoch.current++;
      nextSession();
      stampsRef.current = [];
      setStamps([]);
      setFresh(null);
      setRound((r) => r + 1);
      go('map', null, { replace: true });
      // roundsDone는 이전 회차 완료 직후와 같으므로 효과에 의존하지 않고 새 세션을 연다.
      await refresh([]);
    } finally { roundTransition.current = false; }
  }, [canReplay, go, refresh]);

  // 데모 진행 초기화: 별 · 회차 · 서버 세션(쿠폰) · 가상 위치를 처음으로
  const resetProgress = useCallback(() => {
    progressEpoch.current++;
    resetSession();
    stampsRef.current = [];
    setStamps([]);
    setRound(1);
    setCoupons([]);
    setSyncError('');
    setFresh(null);
    setDemo((d) => ({ ...d, h: HOUSES[0].id }));
    setStack([{ name: 'home', h: null, arg: null }]);
    setMenu(false);
    try { history.replaceState({ bn: 1 }, '', '#'); } catch { /* 무시 */ }
  }, []);

  const pos = geo.current.current();
  // 반경 안의 가장 가까운 관사(도착)
  const here = HOUSES.map((h) => ({ h, ...gpsCheck(pos, h, CONFIG.radius) }))
    .filter((x) => x.ok)
    .sort((a, b) => a.dist - b.dist)[0]?.h || null;

  const value = useMemo(
    () => ({
      screen, go, back, house: houseById(screen.h) || here || HOUSES[0],
      stamps, has: (h, k) => stamps.includes(stampId(h, k)), count, complete, stamp, finish,
      fresh, clearFresh: () => setFresh(null), coupons, refresh, syncError,
      demo, setDemo, pos, here, geoError: geo.current.error, virtual,
      menu, setMenu, paused: menu, resetProgress,
      round, rounds: CONFIG.rounds, canReplay, nextRound,
    }),
    [screen, go, back, stamps, count, complete, stamp, finish, fresh, coupons, refresh, syncError, demo, pos, here, virtual, menu, resetProgress, round, canReplay, nextRound],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
