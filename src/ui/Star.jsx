// 별 자리: 아직 못 받은 별 = 점선 별 / 받은 별 = 노란 별. 가운데 글자(역할극·단서 얻기 등)는 선택.
const PATH = 'M50 4l13.5 29.6 32.3 3.7-24 21.9 6.6 31.8L50 74.8 21.6 91l6.6-31.8-24-21.9 32.3-3.7z';

export default function Star({ on = false, label = '', className = '' }) {
  return (
    <span className={'star ' + (on ? 'on ' : '') + className}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d={PATH} /></svg>
      {label && <span className="star-t">{label}</span>}
    </span>
  );
}
