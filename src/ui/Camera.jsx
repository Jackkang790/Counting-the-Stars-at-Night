// 실제 카메라 영상(후면).
// 데모 모드(발표장 · 강당엔 건물이 없음) 또는 후면 카메라가 없는 기기(노트북)는 목업 풍경(MockScene).
// 권한 거부 등은 이유 표시.
import { useEffect, useRef, useState } from 'react';
import MockScene from './MockScene.jsx';
import { useApp } from '../store.jsx';

let shared = null; // 화면 사이를 오가도 카메라를 다시 켜지 않게 스트림 공유

export function stopCamera() {
  shared?.getTracks().forEach((t) => t.stop());
  shared = null;
}

export default function Camera({ dim = false, scene = 'building' }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');
  const { demo } = useApp();
  const [noRear, setNoRear] = useState(false);
  const mock = demo.on || noRear;

  useEffect(() => {
    if (demo.on) { stopCamera(); return; } // 데모 모드: 카메라를 켜지 않음
    let alive = true;
    (async () => {
      try {
        // 후면 카메라만(exact). 노트북처럼 전면 카메라뿐이면 얼굴 대신 목업 풍경.
        shared ??= await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' } },
          audio: false,
        });
        if (alive && ref.current) {
          ref.current.srcObject = shared;
          await ref.current.play().catch(() => {});
        }
      } catch (e) {
        if (!alive) return;
        if (e?.name === 'NotAllowedError') setErr('카메라 권한이 필요해요');
        else if (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError') setNoRear(true);
        else setErr('카메라를 켜지 못했어요');
      }
    })();
    return () => { alive = false; };
  }, [demo.on]);

  return (
    <div className={'cam' + (dim ? ' dim' : '')} aria-hidden="true">
      {mock ? <MockScene scene={scene} /> : <video ref={ref} playsInline muted />}
      {err && <div className="cam-err">{err}</div>}
    </div>
  );
}
