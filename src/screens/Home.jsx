// 01 진입 · 도장판 — 도장 0/6 · 도장깨기 시작
import { useApp } from '../store.jsx';
import { EPISODES, TOTAL_STAMPS } from '../lib/episodes.js';
import { Screen, StickyAction } from '../ui/Screen.jsx';

// 키 비주얼 자리표시: 밤의 테미오래 관사촌
// TODO(작가): 작가가 그린 관사촌 일러스트를 받으면 <img> 로 교체.
function KeyVisual() {
  return (
    <svg className="key-visual" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="밤의 테미오래 관사촌">
      <rect width="360" height="220" fill="var(--night)" />
      {[[40, 40], [90, 22], [150, 54], [210, 30], [262, 62], [318, 26], [120, 90], [300, 100], [60, 110]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#fff6d6" className="twinkle" style={{ animationDelay: i * 0.3 + 's' }} />
      ))}
      <circle cx="286" cy="52" r="16" fill="var(--star)" opacity=".9" />
      <path d="M0 220V170l40-26 40 26v-8l50-34 50 34v10l36-24 36 24v-6l44-30 44 30v54z" fill="#232b52" />
      <path d="M0 220v-24h360v24z" fill="#1b2244" />
      {[60, 150, 238, 318].map((x) => <rect key={x} x={x} y="178" width="10" height="12" fill="var(--star)" opacity=".8" />)}
    </svg>
  );
}

export default function Home() {
  const { go, stamps, count, demo, setDemo } = useApp();
  // 도장판 6칸 = 관사마다 역할극 · 방탈출
  const slots = EPISODES.flatMap((ep) => [stamps[ep.id]?.role, stamps[ep.id]?.escape]);

  return (
    <Screen>
      <StickyAction
        action={
          <>
            <button type="button" className="btn" onClick={() => go('map')}>
              {count ? '도장깨기 이어가기' : '도장깨기 시작'}
            </button>
            <button type="button" className="link muted center" onClick={() => setDemo({ ...demo, on: !demo.on })}>
              {demo.on ? '데모 모드 켜짐 (행사용) · 끄기' : '데모 모드 (행사용)'}
            </button>
          </>
        }
      >
        <KeyVisual />
        <main>
          <p className="eyebrow">테미오래 · 원도심 근대문화유산 × 지역 예술인</p>
          <h1>별 헤는 밤</h1>
          <p className="lead">관사마다 숨은 이야기를 깨우고<br />도장을 모아 밤의 이야기를 완성하세요</p>

          <div className="card">
            <div className="row">
              <b>나의 도장판</b>
              <span className="muted">{count} / {TOTAL_STAMPS}</span>
            </div>
            <div className="slots">
              {slots.map((on, i) => <span key={i} className={'slot-stamp' + (on ? ' on' : '')} />)}
            </div>
            <p className="muted small">역할극 {EPISODES.length} · 방탈출 {EPISODES.length} · 모으면 스토리보드 완성</p>
          </div>
        </main>
      </StickyAction>
    </Screen>
  );
}
