// 04 AR 뮤지컬 — 건물 외벽 위에 예술가의 짧은 뮤지컬 장면이 겹쳐 재생됨. 80% 이상 보면 별.
// TODO(AR): 지금은 카메라 영상 위에 화면을 겹치고 "위치 맞추기"로 외벽에 맞춤.
//   외벽 기준점 이미지 인식이 되면 그 자리에 자동으로 붙게 교체.
import { useState } from 'react';
import { useApp } from '../store.jsx';
import { CONFIG, TOTAL_STARS } from '../lib/spots.js';
import Camera from '../ui/Camera.jsx';
import Clip from '../ui/Clip.jsx';
import { ArHead } from '../ui/chrome.jsx';
import useFit from '../ui/useFit.js';

export default function Musical() {
  const { point: p, stars, earn, go, demo } = useApp();
  const [align, setAlign] = useState(false);
  const fit = useFit(align);
  const got = stars.includes(p.id);

  const onProgress = (r) => { if (!got && r >= CONFIG.watchRatio) earn(p.id, r); };

  return (
    <div className="ar">
      <Camera />
      <ArHead
        left="back"
        pill={`${p.spot.act} · ${p.spot.actLabel}`}
        right={
          <button type="button" className={'pill line' + (align ? ' on' : '')} onClick={() => setAlign((a) => !a)}>
            {align ? '맞추기 완료' : '위치 맞추기'}
          </button>
        }
      />
      <div className="ar-hint">{p.spot.name} 외벽이 무대가 돼요 · 연출 {p.artist}</div>

      <div className={'wall-screen' + (align ? ' aligning' : '')} style={fit.style} {...fit.handlers}>
        <Clip src={p.src} title={p.title} duration={p.duration} fast={demo.on} onProgress={onProgress} />
      </div>

      <div className="star-foot">
        <span className={'star-count' + (got ? ' on' : '')}>★ 별 {stars.length} / {TOTAL_STARS}</span>
        <p>{p.story}</p>
        {got ? (
          <button type="button" className="btn light-solid" onClick={() => go('stars', null, { replace: true })}>별 받았어요 · 별자리 보기</button>
        ) : (
          <p className="muted-light">{Math.round(CONFIG.watchRatio * 100)}% 이상 보면 별을 받아요</p>
        )}
      </div>
    </div>
  );
}
