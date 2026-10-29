// 03 포인트 도착 확인 (기능 1.1)
// ① GPS: 스팟 반경 안이어야 함 → ② 건물 앞에 가상 QR 이 떠 있고, 누르면 서버가 위치(GPS)와 QR 을 함께 확인
// → 통과하면 AR(뮤지컬 영상 / 별길 작품)으로. 반경 밖이면 QR 이 안 뜨고 별도 못 받음.
// TODO(인식): ③ 외벽 기준점(번호판·간판) 이미지 인식은 AR 타깃이 준비되면 추가.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { CONFIG } from '../lib/spots.js';
import { gpsCheck } from '../lib/geo.js';
import { api } from '../lib/api.js';
import { drawQR } from '../lib/qr.js';
import Camera from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';

export default function Point() {
  const { point: p, pos, demo, go, stars } = useApp();
  const qr = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const gps = gpsCheck(pos, p, CONFIG.spotRadius);
  const payload = `${p.spot.id}:${p.id}`; // TODO(서버): 서명값 포함 형식은 docs/API.md 참고

  useEffect(() => { if (gps.ok && qr.current) drawQR(qr.current, payload); }, [gps.ok, payload]);

  const confirm = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.checkin({ point_id: p.id, lat: pos?.lat, lng: pos?.lng, qr_payload: payload, demo: demo.on });
      if (r.gps_ok && r.qr_ok) go(p.kind === 'musical' ? 'musical' : 'artwork', p.id, { replace: true });
      else setErr(r.gps_ok ? 'QR 을 확인하지 못했어요. 다시 눌러 주세요.' : '스팟 근처로 이동해 주세요');
    } catch {
      setErr('서버에 연결하지 못했어요. 잠시 후 다시 눌러 주세요.');
    }
    setBusy(false);
  };

  return (
    <div className="ar">
      <Camera />
      <ArHead pill={`${p.spot.act} · ${p.spot.name}`} />
      <div className="ar-hint">여기 서세요 · {p.label}</div>

      {gps.ok && (
        <button type="button" className="float-qr" onClick={confirm} disabled={busy} aria-label="떠 있는 QR 눌러 도착 확인">
          <canvas ref={qr} width="120" height="120" />
          <span>{busy ? '확인 중…' : '눌러서 도착 확인'}</span>
        </button>
      )}

      <div className="ar-foot">
        {gps.ok ? (
          <>
            <div className="ar-title">건물 앞에 QR 이 떠 있어요</div>
            <div className="ar-sub">{stars.includes(p.id) ? '이미 받은 별이에요 · 다시 볼 수 있어요' : '누르면 도착을 확인하고 AR 이 시작돼요'}</div>
          </>
        ) : (
          <>
            <div className="ar-title">스팟 근처로 이동해 주세요</div>
            <div className="ar-sub">{gps.dist != null ? `포인트까지 약 ${Math.round(gps.dist)}m` : '위치를 찾는 중…'}</div>
          </>
        )}
        {err && <div className="ar-err">{err}</div>}
      </div>
    </div>
  );
}
