// 기본은 같은 origin의 REST 서버. 샘플 모드는 VITE_SAMPLE_MODE=1로 명시한다.
import { CONFIG, HOUSES, STAR_IDS } from './spots.js';
import { CAFES } from './cafes.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1';
const SKEY = 'byeol-night:session:v5';
const PKEY = 'byeol-night:past-sessions:v5';
export const usingSample = import.meta.env.VITE_SAMPLE_MODE === '1';
let sessionP = null;
let memorySession = null;
let sessionEpoch = 0;
let mutations = Promise.resolve();
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const currentSession = () => { try { return localStorage.getItem(SKEY) || memorySession; } catch { return memorySession; } };
const pastSessions = () => { const saved = read(PKEY, []); return Array.isArray(saved) ? saved.filter((sid) => typeof sid === 'string') : []; };

async function http(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(BASE + path, {
      method, signal: controller.signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const detail = await response.json().then((j) => j.detail).catch(() => '');
      throw Object.assign(new Error(`${response.status} ${typeof detail === 'string' ? detail : 'validation_error'}`), { status: response.status, detail });
    }
    return await response.json();
  } finally { clearTimeout(timer); }
}

function session(renew = false) {
  const saved = currentSession();
  if (!renew && saved) return Promise.resolve(saved);
  if (!sessionP) {
    const epoch = sessionEpoch;
    const pending = http('/sessions', { method: 'POST' }).then(({ session_id }) => {
      if (epoch === sessionEpoch) {
        memorySession = session_id;
        try { localStorage.setItem(SKEY, session_id); } catch { /* 저장 불가 */ }
      }
      return session_id;
    }).finally(() => { if (sessionP === pending) sessionP = null; });
    sessionP = pending;
  }
  return sessionP;
}

async function withSession(fn) {
  try { return await fn(await session()); } catch (error) {
    if (error.detail === 'session_not_found') return fn(await session(true));
    throw error;
  }
}

export function nextSession() {
  sessionEpoch++;
  sessionP = null;
  try {
    const sid = currentSession();
    if (sid) localStorage.setItem(PKEY, JSON.stringify([...new Set([...pastSessions(), sid])]));
    localStorage.removeItem(SKEY);
  } catch { /* 저장 불가 */ }
  memorySession = null;
}

export function resetSession() {
  sessionEpoch++;
  sessionP = null;
  memorySession = null;
  try { localStorage.removeItem(SKEY); localStorage.removeItem(PKEY); } catch { /* 저장 불가 */ }
}

const toCoupon = (c) => ({ ...c, expires_at: c.expires_at ?? null, store_id: c.store_id ?? null });
const toStore = (s) => ({
  ...s, area: s.display_location, about: s.description, demo: s.is_demo,
  benefit: s.accepts_coupon ? CONFIG.couponTitle : '쿠폰 사용 불가',
});
// 기존 서버의 c/role 기록은 헤레디움의 전시 보기 별이다.
const stampFromServer = ({ spot_id, kind }) => {
  const house = HOUSES.find((h) => h.server === spot_id);
  if (!house) return null;
  return `${house.id}:${kind === 'role' && house.missions.includes('view') ? 'view' : kind}`;
};
const sampleCoupons = (n) => Array.from({ length: n }, (_, i) => ({
  id: `cp_sample_${i + 1}`, title: CONFIG.couponTitle, benefit: '[시연용] 음료 할인',
  code: String(482915730264 + i * 7919), status: 'issued',
  issued_at: new Date().toISOString(), expires_at: null, redeemed_at: null, store_id: null,
}));

export const api = {
  // 체크인 상태는 세션에 하나뿐이므로 복구·완료 요청을 직렬화한다.
  syncProgress(localStamps, roundsDone = 0) {
    if (usingSample) return Promise.resolve({ stamps: localStamps, coupons: sampleCoupons(roundsDone) });
    const epoch = sessionEpoch;
    const task = mutations.catch(() => {}).then(async () => {
      if (epoch !== sessionEpoch) throw Object.assign(new Error('session_changed'), { cancelled: true });
      return withSession(async (session_id) => {
        const saved = await http(`/stars?session_id=${encodeURIComponent(session_id)}`);
        const serverStamps = saved.stars.map(stampFromServer).filter((id) => STAR_IDS.includes(id));
        const merged = new Set([...serverStamps, ...localStamps.filter((id) => STAR_IDS.includes(id))]);
        for (const id of STAR_IDS.filter((id) => merged.has(id) && !serverStamps.includes(id))) {
          if (epoch !== sessionEpoch) throw Object.assign(new Error('session_changed'), { cancelled: true });
          const [houseId, kind] = id.split(':');
          const spot_id = HOUSES.find((h) => h.id === houseId).server;
          await http('/checkin', { method: 'POST', body: { session_id, spot_id } });
          await http('/experiences/complete', { method: 'POST', body: { session_id, spot_id, kind } });
        }
        const of = (sid) => http(`/coupons?session_id=${encodeURIComponent(sid)}`);
        const coupons = (await Promise.all([of(session_id), ...pastSessions().map((sid) => of(sid).catch(error => {
          if (error.detail === 'session_not_found') return [];
          throw error;
        }))])).flat();
        return { stamps: [...merged], coupons: coupons.map(toCoupon) };
      });
    });
    mutations = task;
    return task;
  },
  stores: () => usingSample
    ? Promise.resolve(CAFES.map((c) => ({ ...c, accepts_coupon: true, demo: true, benefit: '[시연용] 음료 할인' })))
    : http('/stores').then((stores) => stores.map(toStore)),
};
