// 04-A 빈 땅 · 작품이 솟아남 — 빈 땅에서 지역 작가 작품이 솟아남. 작가는 실물을 옮기지 않고 전시.
// 안드로이드 크롬: WebXR 평면인식 → 바닥이 잡히면 탭 없이 그 자리에서 솟아남. 그 외: 카메라 위 2D(좌대 위 조형물이 땅에서 솟아오름, ui/Sculpture.jsx). 
// 작품이 여러 개면 점(● ○ ○)을 누르거나 좌우로 밀어서 다음 작품.
// 스팟 3 '전시 보기' 별 화면 — 작품 이야기를 열고 "확인"을 누르면 별 → 02 지도. 아래 버튼 · ‹ 로 언제든 돌아감(막히지 않음).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { stopCamera } from '../ui/Camera.jsx';
import ArFrame from '../ui/ArFrame.jsx';
import Peek from '../ui/Peek.jsx';
import Sculpture from '../ui/Sculpture.jsx';
import useFit from '../ui/useFit.js';
import useSwipe from '../ui/useSwipe.js';
import { isARSupported, startAR } from '../lib/ar.js';
import { buildArtwork } from '../lib/artwork3d.js';
import ARViewer from '../ui/ARViewer.jsx';

const STATUS = { scanning: '바닥을 천천히 비춰 주세요', found: '바닥 인식됨 · 곧 솟아나요' };

export default function Artwork() {
  const { house: h, back, finish } = useApp();
  // 이 스팟 별이 '전시 보기'면: 작품 이야기 시트의 "확인" → 별 받고 지도
  const viewStar = h.missions.includes('view')
    ? () => { session.current?.end(); finish(h.id, 'view'); }
    : undefined;
  const root = useRef(null);
  const session = useRef(null);
  const tried = useRef(false);
  const [xr, setXr] = useState(null); // null = 확인 중, false = 미지원, 'ready' | 'scanning' | 'found' | 'placed'
  const [i, setI] = useState(0);
  const [arOpen, setArOpen] = useState(false);
  // 작품 회전무대: 작품들이 원(회전판) 위에 놓여, 다음 작품으로 넘기면 원이 돌며 앞으로 옴. ang = 지금 앞에 있는 자리(작품 번호, 소수 = 도는 중)
  const [ang, setAng] = useState(0);
  const angRef = useRef(0);
  const spin = (to) => {
    const from = angRef.current, t0 = performance.now(), D = 900;
    const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D);
      angRef.current = from + (to - from) * ease(p);
      setAng(angRef.current);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const [risen, setRisen] = useState(false); // 처음 한 번만 솟아오르고, 그 뒤엔 제자리에 가만히(다른 작품도 바로 보임)
  const [align, setAlign] = useState(false);
  const fit = useFit(align);
  const works = h.artworks;
  const w = works[i];

  useEffect(() => {
    let alive = true;
    // 실제 AR(WebXR). 데모 모드(발표장)에서도 강당 바닥에서 진짜로 솟아남
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
  const show = (k) => {
    const n = works.length;
    const to = ((k % n) + n) % n; // 끝에서 넘기면 처음으로(빙글 돌아감)
    if (to === i) return;
    let d = to - i; // 가까운 쪽으로 돌기
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    setI(to);
    spin(Math.round(angRef.current) + d);
    if (inXR) session.current?.replace(); // 다음 작품도 그 자리에서 다시 솟아남
  };
  // 좌우로 밀면 다음/이전 작품 (위치 맞추기 중엔 끔)
  const swipe = useSwipe((d) => show(i + d), { off: align });
  const onAlign = () => {
    if (inXR) session.current?.replace(); // AR 중이면 바닥을 다시 잡아 그 자리에 솟아남
    else setAlign((a) => !a);
  };

  if (arOpen) return <ARViewer experience="starseed" onClose={() => setArOpen(false)} onComplete={viewStar} confirmExhibit />;

  return (
    <ArFrame
      ref={root}
      className={inXR ? 'xr' : ''}
      scene="ground"
      camera={!inXR}
      left="back"
      pill={`${h.yard} · 작품 ${i + 1} / ${works.length}`}
      hint={inXR ? STATUS[xr] : null}
      right={
        <button type="button" className={'pill line' + (align ? ' on' : '')} onClick={onAlign}>
          {align ? '맞추기 완료' : '위치 맞추기'}
        </button>
      }
      {...swipe}
    >
      {!inXR && xr === false && (
        <div className={'rise-wrap ring' + (align ? ' aligning' : '') + (risen ? ' still' : '')} onAnimationEnd={(e) => e.animationName === 'rise' && setRisen(true)} style={fit.style} {...fit.handlers}>
          {/* 땅선(rise-clip 아래쪽) 밑에서 위로 올라옴(처음 한 번) → 그 뒤엔 회전무대처럼 원을 따라 돌며 다음 작품이 앞으로 */}
          <div className="rise-clip">
            <div className="rise2d">
              <span className="rise-glow" aria-hidden="true" />
              {works.map((wk, k) => {
                const n = works.length;
                const kk = k + n * Math.round((ang - k) / n); // 원 위에서 지금 자리와 가장 가까운 바퀴
                const th = ((kk - ang) * 2 * Math.PI) / n; // 0 = 맨 앞
                const front = (Math.cos(th) + 1) / 2; // 1 = 앞, 0 = 뒤
                return (
                  <div key={k} className="ring-item" style={{
                    left: `${50 + Math.sin(th) * 34}%`,
                    transform: `translateX(-50%) translateY(${-(1 - front) * 14}%) scale(${0.5 + front * 0.5})`,
                    zIndex: Math.round(front * 10), opacity: 0.45 + front * 0.55,
                  }}>
                    <Sculpture seed={k} form={wk.form} title={wk.title} />
                  </div>
                );
              })}
            </div>
          </div>
          <span className="rise-base" />
          <span className="rise-dust" aria-hidden="true" />
        </div>
      )}

      <div className="art-foot">
        <button type="button" className="btn light" onClick={() => { session.current?.end(); setArOpen(true); }}>별의 새싹 · 실제 3D 작품 보기</button>
        {works.length > 1 && (
          <div className="dots">
            {works.map((_, k) => <button key={k} type="button" className={k === i ? 'on' : ''} onClick={() => show(k)} aria-label={`작품 ${k + 1}`} />)}
          </div>
        )}
        {xr === 'ready' ? (
          <button type="button" className="btn light" onClick={enter}>빈 땅 비추기</button>
        ) : (
          // 막히지 않게: 바닥을 못 잡아도 언제든 05 이야기로 돌아감
          <button type="button" className="btn ghost art-back" onClick={back}>{h.short || h.name} 이야기로 돌아가기</button>
        )}
      </div>

      <Peek label="작품 이야기 보기" title={<b>{w.title} · {w.artist}</b>} onDone={viewStar}>
        <p>{w.about}</p>
      </Peek>
    </ArFrame>
  );
}
