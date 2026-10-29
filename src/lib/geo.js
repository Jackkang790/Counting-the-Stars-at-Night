// 위치 기반 해금. 실제 GPS 또는 데모 모드(가짜 좌표).

export function distanceM(a, b) {
  const R = 6371000;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLng = (b.lng - a.lng) * toR;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// 반경 안의 가장 가까운 에피소드 1개. GPS 오차는 최대 30m까지만 봐줌
// (관사들이 붙어 있어서 너무 넓게 잡으면 엉뚱한 건물이 잡힘).
export function nearestEpisode(pos, episodes) {
  if (!pos) return null;
  const slack = Math.min(pos.acc ?? 0, 30);
  let best = null;
  for (const ep of episodes) {
    const d = distanceM(pos, ep);
    if (d <= ep.radius + slack && (!best || d < best.dist)) best = { ep, dist: d };
  }
  return best;
}

export class Geo {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.pos = null;
    this.error = null;
    this.demoEp = null;
    this.watchId = null;
  }

  start() {
    if (!('geolocation' in navigator)) {
      this.error = '이 기기는 위치를 지원하지 않아요';
      this.onUpdate();
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) => {
        this.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        this.error = null;
        this.onUpdate();
      },
      (e) => {
        this.error = e.code === 1 ? '위치 권한이 거부됐어요' : '위치를 못 잡고 있어요';
        this.onUpdate();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }

  setDemo(ep) {
    this.demoEp = ep;
    this.onUpdate();
  }

  current() {
    if (this.demoEp) return { lat: this.demoEp.lat, lng: this.demoEp.lng, acc: 0, demo: true };
    return this.pos;
  }
}
