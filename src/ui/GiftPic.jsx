// 기프티콘 상품 그림(자리표시): 별이 뜬 밤 + 커피 한 잔. TODO(디자인): 실제 음료 사진으로 바꿔 끼우기.
export default function GiftPic({ className = '' }) {
  return (
    <svg className={'gift-pic ' + className} viewBox="0 0 160 120" aria-hidden="true">
      <defs>
        <linearGradient id="gp-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2a6b" /><stop offset="1" stopColor="#3a2f6e" /></linearGradient>
      </defs>
      <rect width="160" height="120" fill="url(#gp-bg)" />
      {[[18, 18], [40, 34], [132, 16], [146, 44], [112, 30], [24, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} fill="#fff6d6" />)}
      <path d="M126 22l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#f4c54a" />
      <ellipse cx="78" cy="104" rx="40" ry="6" fill="#000" opacity=".25" />
      <path d="M50 52h56l-6 46a6 6 0 0 1-6 5H62a6 6 0 0 1-6-5z" fill="#f6efe4" />
      <path d="M52 64h52l-1.4 11H53.4z" fill="#c8915a" />
      <path d="M106 60h6a9 9 0 0 1 0 18h-8" fill="none" stroke="#f6efe4" strokeWidth="5" />
      <rect x="46" y="46" width="64" height="8" rx="3" fill="#e7dccb" />
      <path d="M68 40c-4-6 4-8 0-14M80 40c-4-6 4-8 0-14M92 40c-4-6 4-8 0-14" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M78 66l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" fill="#f4c54a" />
    </svg>
  );
}
