// 04-A 빈 땅 · 지역 작가 작품이 땅에서 솟아남 + QR (작가가 실물을 옮기지 않아도 됨)
// 안드로이드 크롬: WebXR 평면인식 → 바닥이 잡히면 탭 없이 그 자리에서 솟아남.
// 그 외 브라우저: 카메라 영상 위 2D 자리표시.
// 마당 작품이 여러 점이면 좌우로 밀어서 다음 작품(점 표시).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import Camera, { stopCamera } from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';
import { Peek } from '../ui/Screen.jsx';
import useFit from '../ui/useFit.js';
import { isARSupported, startAR } from '../lib/ar.js';
import { buildArtwork } from '../lib/artwork3d.js';
import { drawQR } from '../lib/qr.js';

const STATUS = { scanning: '바닥을 천천히 비춰 주세요', found: '바닥 인식됨 · 곧 솟아나요' };

export default function Artwork() {
  const { ep, go } = useApp();
  const works = ep.artworks;
  const root = useRef(null);
  const qr = useRef(null);
  const session = useRef(null);
  const tried = useRef(false);
  const sx = useRef(null);
  const [i, setI] = useState(0);
  const [xr, setXr] = useState(null); // null = 확인 중, false = 미지원, 'ready' | 'scanning' | 'found' | 'placed'
  const [align, setAlign] = useState(false);
  const fit = useFit(align);
  const work = works[i];

  useEffect(() => {
    let alive = true;
    isARSupported().then((ok) => alive && setXr(ok ? 'ready' : false));
    return () => { alive = false; session.current?.end(); };
  }, []);

  useEffect(() => {
    if (qr.current) drawQR(qr.current, `${location.origin}${location.pathname}#${ep.id}/artwork/${i + 1}`);
  }, [ep.id, i, xr]);

  const enter = async () => {
    stopCamera(); // WebXR 이 카메라를 직접 씀
    try {
      session.current = await startAR({
        overlayRoot: root.current,
        autoPlace: true,
        // TODO(작가): 작품마다 다른 glTF 로 교체 (지금은 같은 자리표시 조형물)
        buildFor: async () => buildArtwork(),
        onStatus: setXr,
        onEnd: () => { session.current = null; setXr('ready'); },
      });
    } catch {
      setXr('ready'); // 탭 유효시간이 지나 막힌 경우 → 버튼 한 번
    }
  };

  // 03 의 "이야기로 들어가기" 탭이 아직 유효할 때(크롬 기준 약 5초) 바로 AR 시작 → 추가 탭 없음.
  // 막히면 아래 버튼으로 한 번만.
  useEffect(() => {
    if (xr === 'ready' && !session.current && !tried.current) { tried.current = true; enter(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const inXR = xr === 'scanning' || xr === 'found' || xr === 'placed';
  const risen = xr === false || xr === 'placed';

  const step = (d) => {
    const n = Math.min(works.length - 1, Math.max(0, i + d));
    if (n === i) return;
    setI(n);
    session.current?.replace(); // AR 중이면 바닥을 다시 잡아 새 작품이 솟아남
  };
  const onAlign = () => {
    if (inXR) session.current?.replace();
    else setAlign((a) => !a);
  };

  return (
    <div
      className="ar"
      ref={root}
      onPointerDown={(e) => { if (!align) sx.current = e.clientX; }}
      onPointerUp={(e) => {
        if (sx.current == null) return;
        const d = e.clientX - sx.current;
        sx.current = null;
        if (Math.abs(d) > 50) step(d < 0 ? 1 : -1);
      }}
    >
      {!inXR && <Camera />}
      <ArHead
        pill={`${ep.order}호 관사 마당 · 작품 ${i + 1} / ${works.length}`}
        right={
          <button type="button" className={'pill line' + (align ? ' on' : '')} onClick={onAlign}>
            {align ? '맞추기 완료' : '위치 맞추기'}
          </button>
        }
      />
      {inXR && STATUS[xr] && <div className="ar-hint">{STATUS[xr]}</div>}

      {!inXR && xr === false && (
        <div className={'rise-wrap' + (align ? ' aligning' : '')} style={fit.style} {...fit.handlers}>
          <div className="rise-arrow" aria-hidden="true"><i />땅에서<br />솟아남</div>
          <div className="rise2d" key={i}>
            <div className="rise-art"><span className="arch" /><span className="cap light">{work.title}<br />3D</span></div>
          </div>
          <span className="rise-base" />
        </div>
      )}

      {risen && (
        <div className="qr-sign"><canvas ref={qr} width="96" height="96" /></div>
      )}

      <div className="art-foot">
        <div className="dots" aria-label={`작품 ${i + 1} / ${works.length}`}>
          {works.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}
        </div>
        {xr === 'ready' && <button type="button" className="btn light" onClick={enter}>빈 땅 비추기</button>}
        <p className="caption">빈 땅에서 지역 작가의 작품이 솟아남. 작가는 실물을 옮기지 않고 전시.</p>
      </div>

      <Peek onOpen={() => go('sheet')}>
        <b>{work.title} · {work.artist}</b>
        <span>위로 올려서 작품 이야기 보기</span>
      </Peek>
    </div>
  );
}
