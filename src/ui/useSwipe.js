// 좌우로 밀어서 넘기기(손가락·마우스 둘 다). 상단바·하단 시트·점·버튼에서 시작한 동작은 무시.
// 10px 넘게 움직이면 그때 포인터를 잡아 둠(capture) → 밀기는 끝까지 받고, 거의 안 움직인 탭은 원래 클릭(액자 고르기 등)으로 통과.
import { useRef } from 'react';

export default function useSwipe(onSwipe, { off = false, min = 40 } = {}) {
  const st = useRef(null);
  const end = (e) => {
    const s = st.current;
    st.current = null;
    if (!s || off) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > min && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
  };
  return {
    onPointerDown: (e) => {
      if (off || e.target.closest('.ar-head, .peek-sheet, .dots, .btn, a, input')) return;
      st.current = { x: e.clientX, y: e.clientY, cap: false };
    },
    onPointerMove: (e) => {
      const s = st.current;
      if (!s || s.cap || Math.abs(e.clientX - s.x) < 10) return;
      s.cap = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onDragStart: (e) => e.preventDefault(),
  };
}
