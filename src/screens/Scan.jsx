// 03 비추면 도착 확인 — 건물을 비추면 인식 → 바로 05 이 스팟의 이야기 · 별 모으기(역할극 · 단서 얻기).
// 전시(건물 외벽 작가의 무대 · 벽 그림 · 땅 위 3D 작품)는 별과 관계없는 부가 콘텐츠 → 05 아래 "부가 콘텐츠"에서 들어감.
// TODO(인식): 지금은 1.8초 뒤 인식됨으로 표시. 건물 이미지 마커 인식이 되면 교체.
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import ArFrame from '../ui/ArFrame.jsx';
import { HOUSES } from '../lib/spots.js';

export default function Scan() {
  const { house: h, go } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <ArFrame scene="building" pill={`${h.no} / ${HOUSES.length} · ${h.name}`}>
      <div className={'brackets' + (ready ? ' locked' : '')}>
        <i /><i /><i /><i />
        <span className="brackets-cap">실제 건물 (카메라 영상) · 윤곽 인식 중</span>
      </div>
      <div className="ar-foot">
        <div className="ar-title">건물을 비춰 주세요</div>
        <div className="ar-sub">{ready ? `스팟 ${h.no} · ${h.name}에 도착했어요` : '건물을 알아보는 중…'}</div>
        {ready && (
          <>
            <span className="found"><i />건물 인식됨</span>
            <button type="button" className="btn light" onClick={() => go('sheet')}>이야기 · 별 모으기</button>
          </>
        )}
      </div>
    </ArFrame>
  );
}
