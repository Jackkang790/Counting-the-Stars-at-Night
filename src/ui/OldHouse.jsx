// 작가가 연출한 옛 모습(자리표시 그림). 실제 건물 위에 겹쳐짐.
// TODO(작가): 작가가 그린 옛 모습 이미지(PNG, 배경 투명)를 받으면 <image href> 로 교체.
// restore: 지금은 없는 부분(별채)을 자동 복원해서 보여줌 / inside: 역할극에서 벽이 비쳐 보이는 창
export default function OldHouse({ restore = false, inside = null, opacity = 1 }) {
  return (
    <svg className="oldhouse" viewBox="0 0 320 300" style={{ opacity }} aria-hidden="true">
      <defs>
        <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a3" />
          <stop offset="1" stopColor="#e8a94a" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {/* 지붕 + 몸채 */}
      <path d="M20 112 L150 30 L280 112 Z" fill="#4b3a36" stroke="#f3e2c0" strokeWidth="1.5" />
      <rect x="35" y="112" width="230" height="168" fill="#8c6f5c" fillOpacity=".72" stroke="#f3e2c0" strokeWidth="1.5" />
      {[60, 135, 210].map((x, i) => (
        <g key={x}>
          {i !== 1 && <rect x={x - 4} y="134" width="38" height="60" fill="#ffd27a" filter="url(#glow)" opacity=".7" />}
          <rect x={x} y="138" width="30" height="52" fill={i === 1 ? '#2b2522' : 'url(#win)'} stroke="#f3e2c0" />
          <path d={`M${x + 15} 138v52M${x} 164h30`} stroke="#5a463c" strokeWidth="1.5" />
        </g>
      ))}
      <rect x="132" y="210" width="36" height="70" fill="#3a2c27" stroke="#f3e2c0" />
      {/* 지금은 없는 부분: 별채 */}
      {restore && (
        <g className="restore">
          <path d="M262 160 L292 136 L318 160 Z" fill="#4b3a36" stroke="#fff6dc" strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="266" y="160" width="48" height="120" fill="#8c6f5c" fillOpacity=".72" stroke="#fff6dc" strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="280" y="182" width="20" height="34" fill="url(#win)" stroke="#fff6dc" />
        </g>
      )}
      {inside}
    </svg>
  );
}
