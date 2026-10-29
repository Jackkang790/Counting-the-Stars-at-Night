// 서버 API 부르는 곳. 서버(FastAPI)는 팀원 담당 — Jackkang790/Counting-the-Stars-at-Night `Rest-Backend` 브랜치, backend/API.md v0.1.0.
// VITE_API_URL(예: http://localhost:8000)이 있으면 그 서버로. 없으면 아래 고정 예시 데이터로 동작.
// 화면 코드는 아래 api.* 함수만 부르고, 서버 응답은 여기서 화면이 쓰는 모양으로 바꿔서 돌려줌.
//
// 서버 v0.1.0 과 앱의 차이(여기서 맞춤):
// - 사용자 구분: 서버가 발급한 session_id (POST /sessions) → 기기에 저장해 계속 사용
// - 건물 id: 앱 h1·h2·h3 ↔ 서버 a·b·c (건물 파일의 server 값, src/houses/)
// - 별: 앱은 건물당 2개(역할극·단서 얻기). 서버는 건물당 1개(완료 1회) → 그 건물 별 2개를 다 받았을 때 checkin + complete 를 보냄
// - 쿠폰 만료일·카페 좌표/영업시간은 서버에 없음 → 화면에서 해당 칸을 숨김
import { CONFIG, houseById } from './spots.js';

const BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api/v1' : null;
const SKEY = 'byeol-night:session:v5';

async function http(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    const detail = await r.json().then((j) => j.detail).catch(() => '');
    throw Object.assign(new Error(`${r.status} ${detail}`), { status: r.status, detail });
  }
  return r.json();
}

// 체험 세션: 한 번 받아서 기기에 저장. 서버 DB가 초기화돼 session_not_found 면 새로 받음
let sessionP = null;
function session(renew = false) {
  if (!renew) {
    try { const s = localStorage.getItem(SKEY); if (s) return Promise.resolve(s); } catch { /* 저장 불가 */ }
  }
  sessionP ??= http('/sessions', { method: 'POST' }).then(({ session_id }) => {
    try { localStorage.setItem(SKEY, session_id); } catch { /* 저장 불가 */ }
    sessionP = null;
    return session_id;
  });
  return sessionP;
}
// 회차(쿠폰 최대 3번): 서버는 세션 하나에 쿠폰 하나 → 다음 회차는 새 세션. 지난 세션은 쿠폰을 계속 보여주려고 목록에 남김
const PKEY = 'byeol-night:past-sessions:v5';
const pastSessions = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || []; } catch { return []; } };
export function nextSession() {
  try {
    const s = localStorage.getItem(SKEY);
    if (s) localStorage.setItem(PKEY, JSON.stringify([...pastSessions(), s]));
    localStorage.removeItem(SKEY);
  } catch { /* 저장 불가 */ }
}
// 데모 진행 초기화: 기기에 저장한 세션을 모두 지움 → 다음 요청 때 새 세션(별·쿠폰 0부터)
export function resetSession() {
  try { localStorage.removeItem(SKEY); localStorage.removeItem(PKEY); } catch { /* 저장 불가 */ }
}

async function withSession(fn) {
  try { return await fn(await session()); } catch (e) {
    if (e.detail === 'session_not_found') return fn(await session(true));
    throw e;
  }
}

// 서버 응답 → 화면 모양
const toCoupon = (c) => ({
  id: c.id, title: c.title, benefit: c.benefit, code: c.code, status: c.status,
  issued_at: c.issued_at, redeemed_at: c.redeemed_at, expires_at: c.expires_at ?? null, // v0.2.0 부터 만료 있음(v0.1.0 은 null)
  store_id: c.store_id ?? null,
});
const toStore = (s) => ({
  id: s.id, name: s.name, area: s.display_location, about: s.description,
  benefit: s.accepts_coupon ? '쿠폰 사용 가능' : '쿠폰 사용 불가',
  accepts_coupon: s.accepts_coupon, demo: s.is_demo,
  // 서버 v0.2.0 부터 좌표·영업시간·영업 중·야간 영업. v0.1.0 이면 undefined → 화면에서 숨김
  lat: s.lat ?? undefined, lng: s.lng ?? undefined, hours: s.hours ?? undefined, open_now: s.open_now ?? undefined, night: s.night ?? undefined,
});

// ── 고정 예시 데이터 (서버 없을 때) ───────────────────────
// TODO(운영): 제휴 매장 확정(원도심 소상공인 카페, 대기업·체인점 제외). 지금은 자리표시.
const SAMPLE_STORES = [
  { id: 's1', name: '[대흥동 카페 1]', area: '대흥동', lat: 36.3298, lng: 127.4228, hours: '11:00–23:00', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's2', name: '[대흥동 카페 2]', area: '대흥동', lat: 36.3289, lng: 127.4215, hours: '12:00–22:00', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's3', name: '[대흥동 카페 3]', area: '대흥동', lat: 36.3280, lng: 127.4240, hours: '10:00–21:00', open_now: false, night: false, benefit: '[음료 1,000원 할인]' },
  { id: 's4', name: '[선화동 카페 1]', area: '선화동', lat: 36.3294, lng: 127.4248, hours: '11:00–22:30', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's5', name: '[중앙로 카페]', area: '중앙로', lat: 36.3286, lng: 127.4268, hours: '09:00–20:00', open_now: false, night: false, benefit: '[음료 1,000원 할인]' },
];
const SAMPLE_COUPON = {
  id: 'cp_sample', title: CONFIG.couponTitle, code: '482915730264', status: 'issued',
  issued_at: '2026-10-29T21:10:00+09:00', expires_at: '2026-11-12T23:59:59+09:00', redeemed_at: null, store_id: null,
};

const sample = {
  star: () => ({ ok: true }),
  // 완성한 회차 수만큼 예시 쿠폰
  myCoupons: (n) => Array.from({ length: n }, (_, i) => ({ ...SAMPLE_COUPON, id: `cp_sample_${i + 1}`, code: String(482915730264 + i * 7919) })),
  stores: () => SAMPLE_STORES,
};

export const usingSample = !BASE;

export const api = {
  // 건물 완료(그 건물 별 2개 = 역할극 + 단서 얻기를 다 받음) → 서버에 checkin → experiences/complete.
  // 서버는 건물당 별 1개 · 별 3개면 쿠폰 → 앱 별 6개를 다 모은 순간과 서버 쿠폰 발급이 같아짐. 다시 보내도 서버가 중복 지급 안 함.
  clearHouse: (houseId) => {
    if (!BASE) return Promise.resolve(sample.star());
    const spot_id = houseById(houseId).server;
    return withSession(async (session_id) => {
      await http('/checkin', { method: 'POST', body: { session_id, spot_id } });
      return http('/experiences/complete', { method: 'POST', body: { session_id, spot_id } });
    });
  },
  // GET /coupons?session_id=
  // 지금 회차 + 지난 회차 세션의 쿠폰을 모두 모음. done = 서버 없을 때 예시 쿠폰 수(완성한 회차 수)
  myCoupons: async (done = 0) => {
    if (!BASE) return sample.myCoupons(done);
    const of = (sid) => http(`/coupons?session_id=${encodeURIComponent(sid)}`).catch(() => []);
    const past = (await Promise.all(pastSessions().map(of))).flat();
    const now = await withSession((sid) => http(`/coupons?session_id=${encodeURIComponent(sid)}`));
    return [...now, ...past].map(toCoupon);
  },
  // GET /stores
  stores: () => (BASE ? http('/stores').then((l) => l.map(toStore)) : Promise.resolve(sample.stores())),
};
