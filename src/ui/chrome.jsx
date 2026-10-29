// 카메라(AR) 화면 공통 조각: 상단(닫기/뒤로 · 가운데 알약 · 오른쪽 칸) + 관사별 도장 2개
import { useApp } from '../store.jsx';
import { stopCamera } from './Camera.jsx';

// close = X (카메라를 끄고 지도로) / back = ‹ (지나온 화면으로, 카메라는 유지)
export function ArHead({ pill, right = null, left = 'close' }) {
  const { go, back } = useApp();
  const onLeft = () => {
    if (left === 'close') { stopCamera(); go('map'); } else back();
  };
  return (
    <div className="ar-head">
      <button type="button" className="round" aria-label={left === 'close' ? '닫기' : '뒤로 가기'} onClick={onLeft}>
        {left === 'close' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        )}
      </button>
      <div className="pill">{pill}</div>
      <div className="ar-head-side">{right}</div>
    </div>
  );
}

// 관사별 도장 2개(역·방)
export function StampPair({ s = {}, small = false }) {
  return (
    <div className={'stamp-pair' + (small ? ' small' : '')}>
      <span className={'stamp' + (s.role ? ' on' : '')}>역</span>
      <span className={'stamp' + (s.escape ? ' on' : '')}>방</span>
    </div>
  );
}
