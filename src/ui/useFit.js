// "위치 맞추기": 겹친 그림을 실제 건물·땅에 맞춤. 한 손가락 = 옮기기, 두 손가락 = 크기.
import { useRef, useState } from 'react';

export default function useFit(on) {
  const [fit, setFit] = useState({ x: 0, y: 0, s: 1 });
  const pts = useRef(new Map());
  const drag = useRef(null);

  const down = (e) => {
    if (!on) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, [e.clientX, e.clientY]);
    drag.current = { fit, start: [...pts.current.values()].map((p) => [...p]) };
  };
  const move = (e) => {
    if (!on || !drag.current || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, [e.clientX, e.clientY]);
    const now = [...pts.current.values()];
    const { fit: f0, start } = drag.current;
    if (now.length >= 2 && start.length >= 2) {
      const d = (a) => Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      setFit({ ...f0, s: Math.min(2.5, Math.max(0.4, f0.s * (d(now) / d(start)))) });
    } else {
      setFit({ ...f0, x: f0.x + now[0][0] - start[0][0], y: f0.y + now[0][1] - start[0][1] });
    }
  };
  const up = (e) => { pts.current.delete(e.pointerId); drag.current = null; };

  return {
    style: { transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` },
    handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
  };
}
