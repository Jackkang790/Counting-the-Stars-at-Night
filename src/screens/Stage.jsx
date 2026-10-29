// 04-B 건물 외벽 전시 · 작가의 무대 — 부가 콘텐츠(별 없음). 05 "부가 콘텐츠"에서 들어오고 아래 버튼으로 돌아감.
// 작가가 연출한 옛 모습이 실제 건물에 겹쳐지고, 옛 시대 배경 작품이면 지금은 없는 부분이 자동 복원(탭 없음).
// TODO(AR): 지금은 카메라 영상 위에 겹치고 "위치 맞추기"로 건물에 맞춤. 건물 마커 인식이 되면 자동으로 붙게 교체.
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import OldHouse from '../ui/OldHouse.jsx';
import ArFrame from '../ui/ArFrame.jsx';
import { HOUSES } from '../lib/spots.js';
import useFit from '../ui/useFit.js';
import { facadeOf, restoreOf } from '../ui/facade.js';

export default function Stage() {
  const { house: h, back } = useApp();
  const [mix, setMix] = useState(40); // 0 = 옛 모습, 100 = 현재
  const [restored, setRestored] = useState(false);
  const [align, setAlign] = useState(false);
  const fit = useFit(align);
  // 복원된 부분(옥상 구조물) 자리 → 그 위에 유리에 새긴 글씨처럼 안내(말풍선 대신, 그림 좌표 320×300 기준 %)
  const rb = restoreOf(facadeOf(h.look));
  const glass = { left: (rb.x / 320) * 100 + '%', top: (rb.y / 300) * 100 + '%', width: (rb.w / 320) * 100 + '%', height: (rb.h / 300) * 100 + '%' };

  useEffect(() => {
    if (!h.stage.oldEra) return;
    const t = setTimeout(() => setRestored(true), 900);
    return () => clearTimeout(t);
  }, [h.stage.oldEra]);

  return (
    <ArFrame
      pill={`${h.no} / ${HOUSES.length} · ${h.name}`}
      hint="실제 건물이 작가의 무대가 됨"
      right={
        <button type="button" className={'pill line' + (align ? ' on' : '')} onClick={() => setAlign((a) => !a)}>
          {align ? '맞추기 완료' : '위치 맞추기'}
        </button>
      }
    >

      <div className={'overlay' + (align ? ' aligning' : '')} style={fit.style} {...fit.handlers}>
        <OldHouse restore={restored} opacity={1 - mix / 100} />
        {restored && mix < 90 && <div className="glass-tag" style={glass}><b>자동 복원</b><span>현재는 없는 부분</span></div>}
      </div>

      <div className="stage-cap">
        <div className="ar-sub">작가가 연출한 옛 모습이 겹쳐지고{h.stage.oldEra ? ', 없는 부분은 자동 복원' : ''}</div>
        <div className="credit">연출 · {h.stage.artist} · {h.stage.theme}</div>
      </div>

      <label className="mix">
        <span className="row"><span>옛 모습</span><span>현재</span></span>
        <input type="range" min="0" max="100" value={mix} onChange={(e) => setMix(+e.target.value)} aria-label="옛 모습과 현재 비교" />
      </label>

      {/* 부가 콘텐츠 → 05 이야기로 돌아감 */}
      <button type="button" className="btn light peek-btn" onClick={back}>{h.name}의 이야기로 돌아가기</button>
    </ArFrame>
  );
}
