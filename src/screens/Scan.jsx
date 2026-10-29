// 03 비추면 자동 인식 — 건물 / 빈 땅 / 담장 자동 판별 → 바로 AR
// TODO(인식): 지금은 관사 데이터의 target 으로 판정.
//   실제 판별은 WebXR hit-test 평면 방향(바닥=빈 땅, 세로면=담장) + 건물 이미지 마커로 교체.
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';

const FOUND = {
  building: { what: '실제 건물', label: '건물 인식됨', next: 'stage' },
  ground: { what: '빈 땅', label: '빈 땅 인식됨', next: 'artwork' },
  wall: { what: '담장', label: '담장 인식됨', next: 'wall' },
};

export default function Scan() {
  const { ep, go } = useApp();
  const [found, setFound] = useState(null);
  const kind = ep.target;

  useEffect(() => {
    const t = setTimeout(() => setFound(kind), 1800);
    return () => clearTimeout(t);
  }, [kind, ep.id]);

  return (
    <div className="ar">
      <Camera />
      <ArHead pill={`${ep.order} / 3 · ${ep.title}`} />
      <div className={'brackets' + (found ? ' locked' : '')}>
        <i /><i /><i /><i />
        <span className="brackets-tag">{found ? FOUND[found].what : '윤곽 인식 중'}</span>
      </div>
      <div className="ar-foot">
        <div className="ar-title">비추기만 하세요</div>
        <div className="ar-sub">무엇을 비추는지 자동으로 알아봐요{found ? '' : ' · 인식 중…'}</div>
        {found && (
          <>
            <div className="found"><i />{FOUND[found].label}</div>
            <button type="button" className="btn light" onClick={() => go(FOUND[found].next)}>이야기로 들어가기</button>
          </>
        )}
      </div>
    </div>
  );
}
