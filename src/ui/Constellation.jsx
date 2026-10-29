// 별자리: 별 6개(스팟마다 2개)를 선으로 이음. 받은 별만 밝게, 받은 별끼리의 선만 이어짐.
import { POINTS } from '../lib/spots.js';

// 별자리 모양 자리(뷰박스 0~100). 스팟 순서대로 A 둘 → B 둘 → C 둘
const XY = [[14, 62], [28, 34], [46, 52], [62, 24], [78, 46], [88, 76]];

export default function Constellation({ stars, fresh = null }) {
  const on = POINTS.map((p) => stars.includes(p.id));
  return (
    <svg className="constellation" viewBox="0 0 100 100" role="img" aria-label={`별자리 ${on.filter(Boolean).length} / ${POINTS.length}`}>
      {XY.slice(1).map(([x, y], i) => (
        <line key={i} x1={XY[i][0]} y1={XY[i][1]} x2={x} y2={y} className={on[i] && on[i + 1] ? 'cl on' : 'cl'} />
      ))}
      {XY.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={on[i] ? 3.4 : 2.4} className={(on[i] ? 'cs on' : 'cs') + (POINTS[i].id === fresh ? ' fresh' : '')} />
      ))}
    </svg>
  );
}
