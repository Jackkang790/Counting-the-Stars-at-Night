// 하단 시트를 손가락으로 위/아래로 끌기. 끄는 동안 시트가 손가락을 따라 움직이고,
// 60px 넘게 올리면 onUp, 내리면 onDown. 시트 안에서 시작해도 됨(버튼 누르기는 거의 안 움직이면 그대로 클릭).
import { useRef, useState } from 'react';

export default function useDragY({ onUp, onDown, min = 60 } = {}) {
  const st = useRef(null);
  const dragged = useRef(false); // 끌기로 끝난 동작 뒤 따라오는 클릭은 무시
  const [dy, setDy] = useState(0);
  const end = (e) => {
    const s = st.current;
    st.current = null;
    setDy(0);
    if (!s || !s.moved) return;
    dragged.current = true;
    const d = e.clientY - s.y;
    if (d < -min) onUp?.();
    else if (d > min) onDown?.();
  };
  return {
    style: dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined,
    handlers: {
      onPointerDown: (e) => {
        dragged.current = false;
        // 스크롤되는 시트 안쪽에서 스크롤 중이면 끌기로 안 침
        st.current = { y: e.clientY, moved: false, top: e.currentTarget.scrollTop ?? 0 };
      },
      onPointerMove: (e) => {
        const s = st.current;
        if (!s) return;
        const d = e.clientY - s.y;
        if (!s.moved && Math.abs(d) < 8) return;
        if (!s.moved) { s.moved = true; e.currentTarget.setPointerCapture?.(e.pointerId); }
        // 위로는 조금만(살짝 딸려 오는 느낌), 아래로는 손가락 그대로. 시트가 스크롤된 상태면 내리기 끌기 안 함
        if (d > 0 && s.top > 0) return;
        setDy(d < 0 ? Math.max(d * 0.5, -80) : d);
      },
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture: (e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } },
    },
  };
}
