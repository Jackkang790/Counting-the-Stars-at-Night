// 01 진입 — 별 헤는 밤 · 나의 별자리 n/6 · 투어 시작
import { useApp } from '../store.jsx';
import { SPOTS, TOTAL_STARS } from '../lib/spots.js';
import { Screen, StickyAction } from '../ui/Screen.jsx';
import Constellation from '../ui/Constellation.jsx';

// 키 비주얼 자리표시: 밤의 원도심 근대건축
// TODO(작가): 작가가 그린 일러스트를 받으면 <img> 로 교체.
function KeyVisual() {
  return (
    <svg className="key-visual" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="밤의 소제동 관사촌과 헤레디움">
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
  const { go, stars, demo, setDemo } = useApp();

  return (
    <Screen>
      <StickyAction
        action={
          <>
            <button type="button" className="btn" onClick={() => go('map')}>
              {stars.length ? '별 모으기 이어가기' : '투어 시작'}
            </button>
            <button type="button" className="link muted center" onClick={() => setDemo({ ...demo, on: !demo.on })}>
              {demo.on ? '데모 모드 켜짐 (행사용) · 끄기' : '데모 모드 (행사용)'}
            </button>
          </>
        }
      >
        <KeyVisual />
        <main>
          <p className="eyebrow">대전 원도심 근대건축 × 지역 예술가 · AR 야간 투어</p>
          <h1>별 헤는 밤</h1>
          <p className="lead">건물을 비추면 예술가의 짧은 뮤지컬이 깨어나요.<br />별 {TOTAL_STARS}개를 모아 카페에서 이어진 이야기를 보세요.</p>

          <div className="card">
            <div className="row">
              <b>나의 별자리</b>
              <span className="muted">★ {stars.length} / {TOTAL_STARS}</span>
            </div>
            <Constellation stars={stars} />
            <p className="muted small">{SPOTS.map((s) => `${s.act} ${s.name}`).join(' · ')}</p>
          </div>
        </main>
      </StickyAction>
    </Screen>
  );
}
