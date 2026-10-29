// 01 진입 · 도장판 — 도장 0/6 · 밤 마실 걷기 시작
import { useApp } from '../store.jsx';
import { TOTAL_STAMPS } from '../lib/spots.js';
import { Screen, StickyAction } from '../ui/Screen.jsx';
import Eave from '../ui/Eave.jsx';
import { MenuButton } from '../ui/PauseMenu.jsx';
import MyConstellation from '../ui/MyConstellation.jsx';

// 키 비주얼 자리표시: 밤의 원도심 근대건축
// TODO(작가): 일러스트를 받으면 <img> 로 교체.
function KeyVisual() {
  return (
    <svg className="key-visual" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="밤의 원도심">
      <rect width="360" height="220" fill="var(--night)" />
      {[[40, 40], [90, 22], [150, 54], [210, 30], [262, 62], [318, 26], [120, 90], [300, 100], [60, 110]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#fff6d6" className="twinkle" style={{ animationDelay: i * 0.3 + 's' }} />
      ))}
      {/* 원도심 스카이라인(평지붕 건물들) */}
      <path d="M0 220v-58h44v-22h62v34h28v-50h76v40h34v-28h58v16h58v68z" fill="#232b52" />
      {[16, 62, 150, 178, 262, 318].map((x) => <rect key={x} x={x} y="184" width="10" height="12" fill="var(--star)" opacity=".8" />)}
    </svg>
  );
}

export default function Home() {
  const { go, stamps, count, demo, setDemo, round, rounds } = useApp();

  return (
    <Screen>
      <StickyAction
        action={
          <>
            <button type="button" className="btn" onClick={() => go('map')}>
              {stamps.length ? '밤 마실 걷기 이어가기' : '밤 마실 걷기 시작'}
            </button>
            <button type="button" className="link muted center" onClick={() => setDemo({ ...demo, on: !demo.on })}>
              {demo.on ? '데모 모드 켜짐 (발표용) · 끄기' : '데모 모드 (발표용)'}
            </button>
          </>
        }
      >
        <div className="key-wrap">
          <KeyVisual />
          <Eave />
          <div className="home-menu"><MenuButton dark /></div>
        </div>
        <main>
          <p className="eyebrow">대전 원도심 · 근대문화유산 × 지역 예술인</p>
          <h1>별 헤는 밤</h1>
          <p className="lead">스팟마다 숨은 이야기를 깨우고<br />{`별 ${TOTAL_STAMPS}개로 나의 별자리를 완성하세요`}</p>

          <div className="card">
            <div className="row">
              <b>나의 별자리 <span className="muted small">{round}/{rounds}회차</span></b>
              <span className="muted">{count} / {TOTAL_STAMPS}</span>
            </div>
            {/* 별 TOTAL_STAMPS 개로 이루어진 나의 별자리 — 받은 별끼리 선이 이어짐 */}
            <MyConstellation />
            <p className="muted small">스팟마다 별 2개 · 역할극 · 단서 얻기 · 전시 보기 · 모으면 카페 쿠폰</p>
          </div>
        </main>
      </StickyAction>
    </Screen>
  );
}
