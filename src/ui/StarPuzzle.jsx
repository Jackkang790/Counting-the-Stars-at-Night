// 07 단서 얻기 · 별자리 조각 퍼즐. 별자리 그림 하나를 cols×rows 조각으로 나눠 섞어 둠.
// 조각을 끌어다 다른 조각 위에 놓으면 두 조각 자리가 바뀜 → 전부 제자리면 별·선이 이어지며 완성(onSolved).
// 좌표는 조각 한 칸 = 50. 별 좌표는 fit() 으로 판 가운데에 꽉 차게 맞춤. 각 조각은 같은 그림을 viewBox 로 잘라서 보여 줌.
import { useEffect, useMemo, useRef, useState } from 'react';

// 정해진 섞기: 조각을 한 칸씩 밀어 둠 → 처음부터 제자리인 조각이 하나도 없음
const shuffled = (n) => Array.from({ length: n }, (_, i) => (i + 1) % n);

// 별 좌표를 판 가운데로: 별자리 전체 크기를 재서 판(여백 9)에 꽉 차게 키우고 가운데 정렬 → 빈 조각이 생기지 않게
function fit(pts, w, h, pad = 9) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((w - pad * 2) / (x1 - x0 || 1), (h - pad * 2) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  return pts.map(([x, y]) => [x * k + ox, y * k + oy]);
}

export default function StarPuzzle({ puzzle, onSolved }) {
  const { cols, rows, lines } = puzzle;
  const stars = useMemo(() => fit(puzzle.stars, cols * 50, rows * 50), [puzzle.stars, cols, rows]);
  const n = cols * rows;
  const [order, setOrder] = useState(() => shuffled(n)); // order[자리] = 조각 번호
  const [drag, setDrag] = useState(null); // { pos, dx, dy, over }
  const start = useRef(null);
  const tiles = useRef([]);
  const solved = order.every((t, i) => t === i);

  useEffect(() => { if (solved) onSolved?.(); }, [solved]); // eslint-disable-line react-hooks/exhaustive-deps

  // 손가락·마우스 아래 있는 조각 자리(끌고 있는 조각 자신은 빼고)
  const posAt = (x, y, self) => tiles.current.findIndex((el, i) => {
    if (!el || i === self) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });

  const down = (pos) => (e) => {
    if (solved) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ pos, dx: 0, dy: 0, over: -1 });
  };
  const move = (e) => {
    if (!drag || !start.current) return;
    setDrag({ ...drag, dx: e.clientX - start.current.x, dy: e.clientY - start.current.y, over: posAt(e.clientX, e.clientY, drag.pos) });
  };
  const up = (e) => {
    if (!drag) return;
    const to = posAt(e.clientX, e.clientY, drag.pos);
    if (to >= 0) setOrder((o) => { const c = [...o]; [c[drag.pos], c[to]] = [c[to], c[drag.pos]]; return c; });
    setDrag(null);
    start.current = null;
  };

  const art = useMemo(() => (
    <>
      {lines.map(([a, b], i) => <line key={i} x1={stars[a][0]} y1={stars[a][1]} x2={stars[b][0]} y2={stars[b][1]} className="pz-line" />)}
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" className="pz-star" />)}
    </>
  ), [stars, lines]);

  return (
    <div className={'puzzle' + (solved ? ' solved' : '')} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${rows}` }}>
      {order.map((t, pos) => {
        const c = t % cols, r = Math.floor(t / cols);
        const me = drag?.pos === pos;
        return (
          <div
            key={pos}
            ref={(el) => { tiles.current[pos] = el; }}
            className={'pz-tile' + (me ? ' dragging' : '') + (drag?.over === pos ? ' over' : '')}
            style={me ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
            onPointerDown={down(pos)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            role="img"
            aria-label={`조각 ${pos + 1}`}
          >
            <svg viewBox={`${c * 50} ${r * 50} 50 50`} aria-hidden="true">{art}</svg>
          </div>
        );
      })}
    </div>
  );
}
