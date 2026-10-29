// 작가가 연출한 옛 모습(자리표시 그림). 실제 건물 위에 겹쳐짐. 건물마다 정면 모양이 다름(facade.js).
// TODO(작가): 작가가 그린 옛 모습 이미지(PNG, 배경 투명)를 받으면 <image href> 로 교체.
// restore: 지금은 없는 부분(옥상 구조물)을 자동 복원해서 보여줌
import { useApp } from '../store.jsx';
import { facadeOf, restoreOf } from './facade.js';

const LINE = '#f3e2c0';

export default function OldHouse({ restore = false, opacity = 1 }) {
  const { house } = useApp();
  const f = facadeOf(house.look);
  const r = restoreOf(f);
  return (
    <svg className="oldhouse" viewBox="0 0 320 300" style={{ opacity }} aria-hidden="true">
      <defs>
        <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a3" />
          <stop offset="1" stopColor="#e8a94a" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {restore && (
        <g className="restore">
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#8c6f5c" fillOpacity=".72" stroke="#fff6dc" strokeWidth="1.5" />
          <rect x={r.x + 28} y={r.y + 10} width="24" height="20" fill="url(#win)" stroke="#fff6dc" />
        </g>
      )}
      <rect {...box(f.parapet)} fill="#4b3a36" stroke={LINE} strokeWidth="1.5" />
      <rect {...box(f.body)} fill="#8c6f5c" fillOpacity=".72" stroke={LINE} strokeWidth="1.5" />
      {f.windows.map((w, i) => (
        <g key={i}>
          {i % 3 !== 1 && <rect x={w.x - 3} y={w.y - 3} width={w.w + 6} height={w.h + 6} fill="#ffd27a" filter="url(#glow)" opacity=".7" />}
          <rect {...box(w)} fill={i % 3 === 1 ? '#2b2522' : 'url(#win)'} stroke={LINE} />
        </g>
      ))}
      <rect {...box(f.door)} fill="#3a2c27" stroke={LINE} />
      <Signs f={f} fill="#2b2522" stroke={LINE} text="#ffd27a" />
    </svg>
  );
}

export const box = (b) => ({ x: b.x, y: b.y, width: b.w, height: b.h });

// 간판(가로 · 세로 · 차양) — MockScene 에서도 같이 씀
export function Signs({ f, fill, stroke, text }) {
  return (
    <>
      {f.sign && <g><rect {...box(f.sign)} fill={fill} stroke={stroke} /><text x={f.sign.x + f.sign.w / 2} y={f.sign.y + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={text}>{f.sign.text}</text></g>}
      {f.vsign && (
        <g>
          <rect {...box(f.vsign)} fill={fill} stroke={stroke} />
          {[...f.vsign.text].map((ch, i) => <text key={i} x={f.vsign.x + f.vsign.w / 2} y={f.vsign.y + 30 + i * 30} textAnchor="middle" fontSize="12" fontWeight="700" fill={text}>{ch}</text>)}
        </g>
      )}
      {f.marquee && (
        <g>
          <rect {...box(f.marquee)} rx="3" fill={fill} stroke={stroke} />
          {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={f.marquee.x + 8 + i * ((f.marquee.w - 16) / 9)} cy={f.marquee.y + 4} r="1.6" fill={text} />)}
          <text x={f.marquee.x + f.marquee.w / 2} y={f.marquee.y + 19} textAnchor="middle" fontSize="11" fontWeight="700" fill={text}>{f.marquee.text}</text>
        </g>
      )}
    </>
  );
}
