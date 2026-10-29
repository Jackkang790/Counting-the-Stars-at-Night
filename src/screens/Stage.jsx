// 04-B 실제 건물 = 작가의 무대 (MVP)
// 작가가 연출한 옛 모습이 실제 건물 위에 겹쳐지고, 옛 시대 배경 작품이면 지금은 없는 부분이 자동 복원됨(탭 없음).
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import OldHouse from '../ui/OldHouse.jsx';
import { ArHead } from '../ui/chrome.jsx';
import { Peek } from '../ui/Screen.jsx';
import useFit from '../ui/useFit.js';

export default function Stage() {
  const { ep, go } = useApp();
  const [mix, setMix] = useState(40); // 0 = 옛 모습, 100 = 현재
  const [restored, setRestored] = useState(false);
  const [align, setAlign] = useState(false);
  const fit = useFit(align);

  useEffect(() => {
    if (!ep.stage.oldEra) return;
    const t = setTimeout(() => setRestored(true), 900);
    return () => clearTimeout(t);
  }, [ep.id, ep.stage.oldEra]);

  return (
    <div className="ar">
      <Camera />
      <ArHead
        pill={`${ep.order} / 3 · ${ep.title}`}
        right={
          <button type="button" className={'pill line' + (align ? ' on' : '')} onClick={() => setAlign((a) => !a)}>
            {align ? '맞추기 완료' : '위치 맞추기'}
          </button>
        }
      />
      <div className="ar-hint">실제 건물이 작가의 무대가 됨</div>

      <div className={'overlay' + (align ? ' aligning' : '')} style={fit.style} {...fit.handlers}>
        <OldHouse restore={restored} opacity={1 - mix / 100} />
        {restored && mix < 90 && (
          <div className="bubble">옛 시대 배경<br />작품일 경우<br />자동 복원</div>
        )}
      </div>

      <div className="stage-cap">
        <div className="ar-sub">작가가 연출한 옛 모습이 겹쳐지고{ep.stage.oldEra ? ', 없는 부분은 자동 복원' : ''}</div>
        <div className="credit">연출 · {ep.stage.artist} · {ep.stage.theme}</div>
      </div>

      <label className="mix">
        <span className="row"><span>옛 모습</span><span>현재</span></span>
        <input type="range" min="0" max="100" value={mix} onChange={(e) => setMix(+e.target.value)} aria-label="옛 모습과 현재 비교" />
      </label>

      <Peek onOpen={() => go('sheet')}>
        <b>{ep.title}의 이야기</b>
        <span>위로 올려서 설명 보기</span>
      </Peek>
    </div>
  );
}
