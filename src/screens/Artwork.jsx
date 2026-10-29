// 04-A 별길 작품 — 별 포인트마다 지역 예술가 작품이 땅에서 솟아남(작가가 실물을 옮기지 않아도 됨) + 작품 카드.
// 솟아난 작품을 잠시 감상하면 별. 작품 카드엔 작가 소개와 후원·굿즈 링크.
// 안드로이드 크롬: WebXR 평면인식 → 바닥이 잡히면 탭 없이 그 자리에서 솟아남. 그 외: 카메라 위 2D 자리표시.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { TOTAL_STARS } from '../lib/spots.js';
import Camera, { stopCamera } from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';
import useFit from '../ui/useFit.js';
import { isARSupported, startAR } from '../lib/ar.js';
import { buildArtwork } from '../lib/artwork3d.js';

const STATUS = { scanning: '바닥을 천천히 비춰 주세요', found: '바닥 인식됨 · 곧 솟아나요' };
const VIEW_MS = 4000; // 솟아난 뒤 이만큼 보면 별

export default function Artwork() {
  const { point: p, stars, earn, go } = useApp();
  const root = useRef(null);
  const session = useRef(null);
  const tried = useRef(false);
  const [xr, setXr] = useState(null); // null = 확인 중, false = 미지원, 'ready' | 'scanning' | 'found' | 'placed'
  const [align, setAlign] = useState(false);
  const fit = useFit(align);
  const got = stars.includes(p.id);

  useEffect(() => {
    let alive = true;
    isARSupported().then((ok) => alive && setXr(ok ? 'ready' : false));
    return () => { alive = false; session.current?.end(); };
  }, []);

  const enter = async () => {
    stopCamera(); // WebXR 이 카메라를 직접 씀
    try {
      session.current = await startAR({
        overlayRoot: root.current,
        autoPlace: true,
        // TODO(작가): 작품 glTF 로 교체 (지금은 자리표시 조형물)
        buildFor: async () => buildArtwork(),
        onStatus: setXr,
        onEnd: () => { session.current = null; setXr('ready'); },
      });
    } catch {
      setXr('ready'); // 탭 유효시간이 지나 막힌 경우 → 버튼 한 번
    }
  };

  // 03 에서 누른 탭이 아직 유효할 때(크롬 기준 약 5초) 바로 AR 시작 → 추가 탭 없음. 막히면 버튼으로 한 번만.
  useEffect(() => {
    if (xr === 'ready' && !session.current && !tried.current) { tried.current = true; enter(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const inXR = xr === 'scanning' || xr === 'found' || xr === 'placed';
  const risen = xr === false || xr === 'placed';

  useEffect(() => {
    if (!risen || got) return;
    const t = setTimeout(() => earn(p.id), VIEW_MS);
    return () => clearTimeout(t);
  }, [risen, got, p.id, earn]);

  const onAlign = () => {
    if (inXR) session.current?.replace(); // AR 중이면 바닥을 다시 잡아 그 자리에 솟아남
    else setAlign((a) => !a);
  };

  return (
    <div className="ar" ref={root}>
      {!inXR && <Camera />}
      <ArHead
        left="back"
        pill={`${p.spot.act} · 별길 작품`}
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
          <div className="rise2d">
            <div className="rise-art"><span className="arch" /><span className="cap light">{p.title}<br />3D</span></div>
          </div>
          <span className="rise-base" />
        </div>
      )}

      <div className="art-foot">
        {xr === 'ready' && <button type="button" className="btn light" onClick={enter}>빈 땅 비추기</button>}
      </div>

      <div className="star-foot light">
        <span className={'star-count' + (got ? ' on' : '')}>★ 별 {stars.length} / {TOTAL_STARS}</span>
        <div className="peek-row">
          <span className="avatar" aria-hidden="true" />
          <span>
            <span className="cap">별길 작품 · {p.label}</span>
            <b>{p.title} · {p.artist}</b>
          </span>
        </div>
        {/* TODO(작가): 작가 소개 한 줄 + 후원·굿즈 링크 확정 */}
        {p.support && <a className="link" href={p.support} target="_blank" rel="noreferrer">작가 후원 · 굿즈 보기</a>}
        {got ? (
          <button type="button" className="btn" onClick={() => go('stars', null, { replace: true })}>별 받았어요 · 별자리 보기</button>
        ) : (
          <p className="muted small">{risen ? '작품을 감상하는 중…' : '작품이 솟아나면 잠시 감상해 주세요'}</p>
        )}
      </div>
    </div>
  );
}
