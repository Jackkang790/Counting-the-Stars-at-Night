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

// 기능 1.1 도착 체크 ① GPS: 스팟 반경 안인지. GPS 오차는 최대 30m까지만 봐줌
// (골목이라 오차가 커서 반경은 넉넉히, 하지만 이것만으로 판정하지 않음 → 다음 단계 가상 QR).
export function gpsCheck(pos, point, radius) {
  if (!pos) return { ok: false, dist: null };
  const dist = distanceM(pos, point);
  return { ok: dist <= radius + Math.min(pos.acc ?? 0, 30), dist };
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

  // 데모 모드: 가상 위치를 이 포인트 위로
  setDemo(point) {
    this.demoEp = point;
    this.onUpdate();
  }

  current() {
    if (this.demoEp) return { lat: this.demoEp.lat, lng: this.demoEp.lng, acc: 0, demo: true };
    return this.pos;
  }
}
