// 나의 별자리: 스팟 × 미션 = 별 6개를 선으로 이은 별자리 하나. 받은 별은 노랗게 빛나고, 받은 별끼리만 선이 밝게 이어짐.
// 01 홈 카드 · 08 나의 별자리 배너가 같이 씀. 별 아래 글자(역/단/전) 없음 — 스팟 이름만. 별 순서 = 스팟 1 역할극 → 스팟 1 단서 → 스팟 2 … (스팟마다 house.missions 순서)
// fresh: 방금 받은 별 id("h1:role") → 튀어나옴. 모든 별은 박자를 달리해 계속 반짝임(mc-tw)
// vertical: 세로로 크게(08 나의 별자리) — 위에서 아래로 스팟 1 → 3, 스팟 이름은 왼쪽
import { useApp } from '../store.jsx';
import { HOUSES, missionsOf, stampId } from '../lib/spots.js';

// 별 개수별 모양(가로 320 × 세로 170). 목록에 없는 개수면 지그재그로 자동 배치
const SHAPES = {
  6: [[36, 112], [92, 70], [146, 98], [190, 50], [244, 80], [292, 36]],
  9: [[22, 112], [56, 84], [92, 108], [126, 66], [160, 92], [194, 52], [228, 78], [264, 42], [298, 66]],
};
const STAR = (r) => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    p.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
};
const BIG = STAR(15);
// 세로(가로 300 × 세로 440): 스팟마다 두 별이 지그재그로 내려감
const VSHAPE6 = [[110, 40], [215, 95], [125, 175], [230, 230], [115, 310], [220, 370]];
const VBIG = STAR(24);

export default function MyConstellation({ fresh = null, className = '', vertical = false }) {
  const { stamps } = useApp();
  const pts = HOUSES.flatMap((h) => missionsOf(h).map((m) => ({ h, m, id: stampId(h.id, m.id) })));
  const n = pts.length;
  const xy = vertical
    ? (n === 6 ? VSHAPE6 : pts.map((_, k) => [k % 2 ? 215 : 115, 40 + (k * 340) / Math.max(1, n - 1)]))
    : SHAPES[n] || pts.map((_, k) => [30 + (k * 260) / Math.max(1, n - 1), k % 2 ? 60 : 108]);
  const star = vertical ? VBIG : BIG;
  const on = pts.map((p) => stamps.includes(p.id));
  const got = on.filter(Boolean).length;

  return (
    <svg className={'my-const ' + (vertical ? 'vertical ' : '') + className} viewBox={vertical ? '0 0 300 410' : '0 0 320 170'} role="img" aria-label={`나의 별자리 · 별 ${got} / ${n}`}>
      <defs>
        <filter id="mc-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {xy.slice(1).map(([x, y], k) => (
        <line key={'l' + k} x1={xy[k][0]} y1={xy[k][1]} x2={x} y2={y} className={'mc-line' + (on[k] && on[k + 1] ? ' on' : '')} />
      ))}
      {xy.map(([x, y], k) => (
        <g key={pts[k].id} transform={`translate(${x} ${y})`} className={'mc-star' + (on[k] ? ' on' : '') + (fresh === pts[k].id ? ' fresh' : '')}>
          {/* 반짝임: 별마다 박자를 달리해 은은하게 깜빡(받은 별은 빛이 커졌다 작아짐) */}
          <g className="mc-tw" style={{ animationDelay: `${-(k * 0.73) % 3}s`, animationDuration: `${2.4 + (k % 3) * 0.5}s` }}>
            <path d={star} filter={on[k] ? 'url(#mc-glow)' : undefined} />
          </g>
        </g>
      ))}
      {/* 스팟 이름: 가로면 그 스팟 별들 아래 가운데, 세로면 왼쪽에 그 스팟 높이로 */}
      {HOUSES.map((h, i) => {
        const ks = pts.map((p, k) => (p.h.id === h.id ? k : -1)).filter((k) => k >= 0);
        const cx = ks.reduce((s, k) => s + xy[k][0], 0) / ks.length;
        const cy = ks.reduce((s, k) => s + xy[k][1], 0) / ks.length;
        return vertical
          ? <text key={h.id} x="8" y={cy + 5} className="mc-spot">스팟 {h.no}</text>
          : <text key={h.id} x={cx} y="164" textAnchor="middle" className="mc-spot">스팟 {h.no}</text>;
      })}
    </svg>
  );
}
