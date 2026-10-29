// 땅 위 3D 작품 자리표시(2D 그림). 땅에서 솟아나는 입체 조형물 → 좌대 위에 선 모양.
// WebXR 이 되면 lib/artwork3d.js 의 3D 조형물이 실제 바닥에 놓임. 작가 glTF 가 오면 둘 다 교체.
// form: 건축 예술품 모양(FORMS — 헤레디움 전시 건축물). 없으면 seed(작품 순번)로 조형물 모양을 돌려 가며 고름.
// 밑변(좌대 바닥) = 그림 맨 아래 → 땅 위에 세우면 됨.
// 건축 예술품(헤레디움 전시 건축물 — 땅에서 솟아오름). 금속·석재 재질 그라디언트는 아래 defs 공용.
const FORMS = {
  // 열주 파빌리온: 계단 · 기둥 넷 · 삼각 박공
  pavilion: (g) => (
    <>
      <path d="M14 70 L60 40 L106 70 Z" fill={`url(#${g}s)`} />
      <path d="M26 66 L60 46 L94 66 Z" fill="#7a5418" opacity=".35" />
      <rect x="12" y="70" width="96" height="10" fill={`url(#${g}m)`} />
      {[20, 42, 70, 92].map((x) => <rect key={x} x={x} y="80" width="8" height="70" fill={`url(#${g}m)`} />)}
      <rect x="12" y="150" width="96" height="6" fill="#9aa1b3" />
      <rect x="8" y="156" width="104" height="5" fill="#7d8496" />
      <rect x="4" y="161" width="112" height="5" fill="#666d80" />
      <rect x="52" y="96" width="16" height="54" fill="#ffd25e" opacity=".55" />
    </>
  ),
  // 아치 문: 벽돌 기둥 사이 반원 아치 · 이맛돌
  gate: (g) => (
    <>
      <path d="M16 166 V64 H104 V166 H82 V100 a22 22 0 0 0 -44 0 V166 Z" fill="#a4553c" />
      {[78, 92, 106, 120, 134, 148].map((y) => <path key={y} d={`M16 ${y} H38 M82 ${y} H104`} stroke="#7d3b28" strokeWidth="1" />)}
      <path d="M38 100 a22 22 0 0 1 44 0" fill="none" stroke={`url(#${g}m)`} strokeWidth="6" />
      <path d="M55 74 H65 L63 84 H57 Z" fill={`url(#${g}s)`} />
      <rect x="10" y="56" width="100" height="8" fill={`url(#${g}m)`} />
      <path d="M38 166 V100 a22 22 0 0 1 44 0 V166 Z" fill="#ffd25e" opacity=".25" />
    </>
  ),
  // 돔 탑: 사각 기단 위 원통 · 둥근 지붕 · 첨탑
  dome: (g) => (
    <>
      <rect x="24" y="120" width="72" height="46" fill={`url(#${g}m)`} />
      {[34, 54, 74].map((x) => <path key={x} d={`M${x} 166 V140 a6 6 0 0 1 12 0 V166 Z`} fill="#2c3040" />)}
      <rect x="34" y="78" width="52" height="42" fill="#c9cfdd" />
      {[42, 56, 70].map((x) => <rect key={x} x={x} y="88" width="8" height="22" fill="#ffd25e" opacity=".7" />)}
      <path d="M30 78 a30 30 0 0 1 60 0 Z" fill={`url(#${g}s)`} />
      <rect x="58" y="32" width="4" height="18" fill="#c98a1e" />
      <circle cx="60" cy="30" r="3" fill="#ffe28a" />
    </>
  ),
};

const SHAPES = [
  // 별 조각: 기둥 위에 큰 별
  (g) => (
    <>
      <rect x="57" y="92" width="6" height="74" fill={`url(#${g}m)`} />
      <path d="M60 18 L71 50 L104 50 L77 70 L87 102 L60 82 L33 102 L43 70 L16 50 L49 50 Z" fill={`url(#${g}s)`} stroke="#fff3c2" strokeWidth="1.2" />
      <path d="M60 18 L71 50 L60 60 Z M60 82 L87 102 L77 70 Z" fill="#fff" opacity=".18" />
    </>
  ),
  // 별 아치: 반원 문 위에 작은 별들
  (g) => (
    <>
      <path d="M22 166 V96 a38 38 0 0 1 76 0 V166 H86 V96 a26 26 0 0 0 -52 0 V166 Z" fill={`url(#${g}m)`} />
      {[[30, 76], [44, 60], [60, 54], [76, 60], [90, 76]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#ffe28a" />)}
    </>
  ),
  // 고리 셋: 서로 엇갈린 금속 고리
  (g) => (
    <>
      <rect x="56" y="120" width="8" height="46" fill={`url(#${g}m)`} />
      <ellipse cx="60" cy="80" rx="34" ry="34" fill="none" stroke={`url(#${g}s)`} strokeWidth="7" />
      <ellipse cx="60" cy="80" rx="14" ry="34" fill="none" stroke="#c9d3ff" strokeWidth="5" opacity=".85" />
      <ellipse cx="60" cy="80" rx="34" ry="12" fill="none" stroke="#ffe28a" strokeWidth="4" opacity=".9" />
    </>
  ),
];

export default function Sculpture({ seed = 0, form, title = '' }) {
  const g = 'sc' + (form || seed % SHAPES.length);
  const draw = FORMS[form] || SHAPES[seed % SHAPES.length];
  return (
    <svg className="sculpture" viewBox="0 0 120 200" role="img" aria-label={title || '3D 작품'}>
      <defs>
        <linearGradient id={g + 's'} x1="0" x2="1"><stop offset="0" stopColor="#ffd25e" /><stop offset="1" stopColor="#c98a1e" /></linearGradient>
        <linearGradient id={g + 'm'} x1="0" x2="1"><stop offset="0" stopColor="#d9dde8" /><stop offset=".5" stopColor="#8b93a8" /><stop offset="1" stopColor="#4c5367" /></linearGradient>
        <linearGradient id={g + 'p'} x1="0" x2="1"><stop offset="0" stopColor="#6c6862" /><stop offset="1" stopColor="#3a3733" /></linearGradient>
      </defs>
      {draw(g)}
      {/* 좌대: 윗면 · 앞면 */}
      <path d="M26 166 L94 166 L102 174 L18 174 Z" fill="#8a857d" />
      <rect x="18" y="174" width="84" height="26" fill={`url(#${g}p)`} />
    </svg>
  );
}
