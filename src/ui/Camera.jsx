// 실제 카메라 영상(후면). 못 켜면 회색 바탕 + 이유 표시 — 와이어프레임의 [카메라 화면] 자리.
import { useEffect, useRef, useState } from 'react';

let shared = null; // 화면 사이를 오가도 카메라를 다시 켜지 않게 스트림 공유

export function stopCamera() {
  shared?.getTracks().forEach((t) => t.stop());
  shared = null;
}

export default function Camera({ dim = false }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        shared ??= await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (alive && ref.current) {
          ref.current.srcObject = shared;
          await ref.current.play().catch(() => {});
        }
      } catch (e) {
        if (alive) setErr(e?.name === 'NotAllowedError' ? '카메라 권한이 필요해요' : '카메라를 켜지 못했어요');
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className={'cam' + (dim ? ' dim' : '')} aria-hidden="true">
      <video ref={ref} playsInline muted />
      {err && <div className="cam-err">{err}</div>}
    </div>
  );
}
