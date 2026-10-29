// 01 왼쪽 위 장식: 기와 처마 끝 + 매달린 청사초롱 2개. 등불은 바람에 흔들리고(sway) 불빛이 일렁임(flicker).
// 움직임 줄이기 설정(prefers-reduced-motion)이면 멈춤.
// 한옥 처마: 가운데는 살짝 처지고 오른쪽 끝(추녀)이 크게 들림
const eaveY = (x) => { const t = x / 200; return 44 - 2 * t - 34 * t ** 4; };
const eavePath = Array.from({ length: 41 }, (_, i) => { const x = i * 5; return `${x} ${eaveY(x).toFixed(1)}`; }).join(' L');
// 기와 골: 수키와(둥근 기와 줄)와 암키와(골)가 번갈아 처마 끝까지 내려옴
const ROWS = Array.from({ length: 21 }, (_, i) => 4 + i * 9.4);

function Lantern({ x, y, len, scale = 1, delay = 0, id }) {
  return (
    <g className="lantern" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}>
      <line x1={x} y1={y} x2={x} y2={y + len} stroke="#7a6a52" strokeWidth="1" />
      <g transform={`translate(${x} ${y + len}) scale(${scale})`}>
        <circle cy="22" r="34" fill={`url(#glow-${id})`} className="lantern-glow" style={{ animationDelay: `${delay * 0.7}s` }} />
        {/* 청사초롱: 위 홍(붉은 비단) · 아래 청(푸른 비단), 나무 테 · 안쪽 촛불 */}
        <path d="M-2 0h4v3h-4z" fill="#5a3b26" />
        <path d="M-10 3h20l-1 3h-18z" fill="#5a3b26" />
        <path d="M-10 6h20q2 8 1 15h-22q-1-7 1-15z" fill="#c4352e" />
        <path d="M-11 21h22q1 9-1 16h-20q-2-7-1-16z" fill="#2c4d9a" />
        <ellipse cy="21" rx="7" ry="12" fill={`url(#paper-${id})`} opacity=".55" />
        {[-6, 0, 6].map((dx) => <path key={dx} d={`M${dx} 6v31`} stroke="#5a3b26" strokeWidth=".7" opacity=".7" />)}
        <path d="M-11 21h22" stroke="#e7c86a" strokeWidth=".9" />
        <path d="M-10 37h20l1 3h-22z" fill="#5a3b26" />
      </g>
    </g>
  );
}

export default function Eave() {
  return (
    <svg className="eave" viewBox="0 0 200 170" aria-hidden="true">
      <defs>
        {['a', 'b'].map((id) => (
          <g key={id}>
            <radialGradient id={`paper-${id}`} cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#fff4cf" />
              <stop offset=".6" stopColor="#ffd27a" stopOpacity=".6" />
              <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`glow-${id}`}>
              <stop offset="0" stopColor="#ffc96b" stopOpacity=".55" />
              <stop offset="1" stopColor="#ffc96b" stopOpacity="0" />
            </radialGradient>
          </g>
        ))}
      </defs>

      {/* 지붕면(암키와 바탕) */}
      <path d={`M0 0H210V-4L${eavePath}L0 ${eaveY(0)}Z`} fill="#1a2040" />
      {/* 수키와 줄: 위에서 처마 끝으로 내려오는 둥근 기와 골 */}
      {ROWS.map((x) => {
        const y = eaveY(x);
        return <path key={x} d={`M${x - 10 + x * 0.06} -2 Q${x - 3} ${y * 0.5} ${x} ${y - 2}`} stroke="#323b6b" strokeWidth="4.2" strokeLinecap="round" fill="none" />;
      })}
      {/* 처마 끝: 수막새(둥근 끝) · 암막새(넓적한 끝) 번갈아 */}
      {ROWS.map((x, i) => {
        const y = eaveY(x);
        const nx = ROWS[i + 1];
        return (
          <g key={x}>
            {nx && <path d={`M${x + 2} ${y + 1} Q${(x + nx) / 2} ${eaveY((x + nx) / 2) + 5} ${nx - 2} ${eaveY(nx) + 1}`} stroke="#4a5488" strokeWidth="2" fill="none" />}
            <circle cx={x} cy={y} r="3.4" fill="#3c4679" stroke="#7a84b8" strokeWidth=".7" />
            <circle cx={x} cy={y} r="1.2" fill="#7a84b8" />
          </g>
        );
      })}
      {/* 부연(네모 끝) · 서까래(둥근 끝) — 단청: 초록 바탕, 붉은·흰 꽃무늬 */}
      {ROWS.map((x) => {
        const y = eaveY(x);
        return <rect key={x} x={x - 2.4} y={y + 5} width="4.8" height="4.4" fill="#2f6b55" stroke="#e8d9a0" strokeWidth=".5" />;
      })}
      {ROWS.map((x) => {
        const xx = x + 4.7;
        const y = eaveY(xx);
        return (
          <g key={x}>
            <circle cx={xx} cy={y + 13.5} r="2.8" fill="#2f6b55" stroke="#e8d9a0" strokeWidth=".5" />
            <circle cx={xx} cy={y + 13.5} r="1.1" fill="#c8463a" />
          </g>
        );
      })}

      {/* 추녀 끝: 처마 모서리가 하늘로 들린 부분 + 토수(끝 장식) */}
      <path d={`M190 ${eaveY(190) + 8} Q206 ${eaveY(200) + 2} 214 -6 L208 -6 Q200 ${eaveY(200) - 4} 190 ${eaveY(190) - 2}Z`} fill="#323b6b" stroke="#7a84b8" strokeWidth=".7" />
      <circle cx="213" cy="-4" r="2.4" fill="#2f6b55" stroke="#e8d9a0" strokeWidth=".5" />
      <Lantern id="a" x={58} y={eaveY(58) + 16} len={22} delay={0} />
      <Lantern id="b" x={133} y={eaveY(133) + 16} len={16} scale={0.78} delay={-1.4} />
    </svg>
  );
}
