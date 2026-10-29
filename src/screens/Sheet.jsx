// 05 건물 이야기 — 역사·작품 + 미션 선택(역할극/방탈출). 카메라 위로 올라온 시트.
import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import OldHouse from '../ui/OldHouse.jsx';
import { drawQR } from '../lib/qr.js';

export default function Sheet() {
  const { ep, go, back, stamps } = useApp();
  const qr = useRef(null);
  const s = stamps[ep.id] || {};
  const work = ep.artworks[0];
  useEffect(() => { drawQR(qr.current, `${location.origin}${location.pathname}#${ep.id}`); }, [ep.id]);

  return (
    <div className="ar">
      <Camera dim />
      <div className="sheet-bg" onClick={back}>
        <OldHouse restore={ep.stage.oldEra} />
      </div>
      <section className="sheet">
        <button type="button" className="grip" aria-label="시트 내리기" onClick={back} />
        <div className="row top-row">
          <div>
            <div className="cap">관사 {ep.order} · {ep.era}</div>
            <h2>{ep.title}</h2>
          </div>
          <canvas ref={qr} width="64" height="64" className="qr" />
        </div>
        <p className="story">{ep.story}</p>

        <button type="button" className="work" onClick={() => go('artwork')}>
          <span className="thumb">[작품]</span>
          <span>
            <span className="cap">이 관사의 작가 작품 (AR)</span>
            <b>{work.artist} · {work.title} 보기</b>
          </span>
        </button>

        <h3>이 건물의 도장 2개</h3>
        <button type="button" className="mission dark" onClick={() => go('roleplay')}>
          <span className={'stamp' + (s.role ? ' on' : '')}>역할극</span>
          <span><b>역할극 보기</b><small>밖에서 건물 안이 비춰 보이며 이야기 진행 · 스토리보드 한 컷</small></span>
        </button>
        <button type="button" className="mission" onClick={() => go('escape')}>
          <span className={'stamp' + (s.escape ? ' on' : '')}>방탈출</span>
          <span><b>방탈출 도전</b><small>주변 단서 {ep.escape.clues.length}개로 잠긴 문 열기</small></span>
        </button>
      </section>
    </div>
  );
}
