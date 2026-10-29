// 서버 API 부르는 곳. 서버(FastAPI)는 팀원이 만들고, 약속한 모양은 docs/API.md 에 적어 둠.
// VITE_API_URL 이 있으면 그 서버로. 없으면 아래 고정 예시 데이터(API.md 의 응답 예시와 같은 모양)를 돌려줌.
// 예시 데이터엔 판정 로직이 없음(별 판정·쿠폰 발급은 서버 일). 화면 코드는 이 함수들만 부름.
import { CONFIG } from './spots.js';

const BASE = import.meta.env.VITE_API_URL;

async function http(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceToken() },
    body: body && JSON.stringify(body),
  });
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status });
  return r.json();
}

// 비회원 시작(브리프 8): 기기마다 한 번 만든 토큰으로 사용자 구분
function deviceToken() {
  try {
    let t = localStorage.getItem('byeol-night:device');
    if (!t) { t = crypto.randomUUID(); localStorage.setItem('byeol-night:device', t); }
    return t;
  } catch { return 'no-storage'; }
}

// ── 고정 예시 데이터 (서버 없을 때) ───────────────────────
// TODO(운영): 제휴 매장 확정(원도심 소상공인 카페, 대기업·체인점 제외). 지금은 자리표시.
const SAMPLE_STORES = [
  { id: 's1', name: '[소제동 카페 1]', area: '소제동', lat: 36.3328, lng: 127.4376, hours: '11:00–23:00', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's2', name: '[소제동 카페 2]', area: '소제동', lat: 36.3335, lng: 127.4389, hours: '12:00–22:00', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's3', name: '[대동천 카페]', area: '소제동', lat: 36.3318, lng: 127.4396, hours: '10:00–21:00', open_now: false, night: false, benefit: '[음료 1,000원 할인]' },
  { id: 's4', name: '[인동 카페 1]', area: '인동', lat: 36.3259, lng: 127.4317, hours: '11:00–22:30', open_now: true, night: true, benefit: '[음료 1,000원 할인]' },
  { id: 's5', name: '[인동 카페 2]', area: '인동', lat: 36.3248, lng: 127.4331, hours: '09:00–20:00', open_now: false, night: false, benefit: '[음료 1,000원 할인]' },
];
const SAMPLE_COUPON = {
  id: 'cp_sample', title: CONFIG.couponTitle, code: '482915730264', status: 'issued',
  issued_at: '2026-10-29T21:10:00+09:00', expires_at: '2026-11-12T23:59:59+09:00', redeemed_at: null, store_id: null,
};

const sample = {
  checkin: () => ({ gps_ok: true, qr_ok: true }),
  star: () => ({ ok: true }),
  myCoupons: () => [SAMPLE_COUPON],
  stores: () => SAMPLE_STORES,
};

export const usingSample = !BASE;

export const api = {
  // POST /checkin
  checkin: (body) => (BASE ? http('/checkin', { method: 'POST', body }) : Promise.resolve(sample.checkin(body))),
  // POST /stars
  star: (body) => (BASE ? http('/stars', { method: 'POST', body }) : Promise.resolve(sample.star(body))),
  // GET /coupons/me
  myCoupons: () => (BASE ? http('/coupons/me') : Promise.resolve(sample.myCoupons())),
  // GET /stores
  stores: (q = {}) => (BASE ? http(`/stores?${new URLSearchParams(Object.entries(q).filter(([, v]) => v != null))}`) : Promise.resolve(sample.stores(q))),
};
