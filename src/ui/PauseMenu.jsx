// 메뉴(일시정지 메뉴): 어느 화면에서나 오른쪽 위 ☰ 버튼 → 오른쪽에서 메뉴가 열림
// → 지도 · 나의 별자리 · 쿠폰함 · 제휴 카페 위치 · 처음 화면으로 바로 이동(콘텐츠를 하다가도 쿠폰·카페 확인).
// 진행이 한 줄로만 이어지지 않게(실제 앱처럼 아무 때나 오가기). 메뉴가 열려 있으면 paused = true(07 타이머 멈춤).
// 메뉴 항목은 아래 ITEMS 배열만 고치면 됨.
import { useApp } from '../store.jsx';
import { TOTAL_STAMPS } from '../lib/spots.js';
import { CAFES } from '../lib/cafes.js';
import { stopCamera } from './Camera.jsx';

// to: 이동할 화면 이름 · sub: 오른쪽 작은 글씨(앱 상태로 계산)
const ITEMS = [
  { to: 'map', label: '밤 마실 걷기 지도', icon: 'map' },
  { to: 'stamps', label: '나의 별자리', icon: 'star', sub: (a) => `${a.round}회차 · ${a.count} / ${TOTAL_STAMPS}` },
  { to: 'couponbox', label: '쿠폰함', icon: 'gift', sub: (a) => { const n = a.coupons.filter((c) => c.status === 'issued').length; return n ? `사용 가능 ${n}장` : '아직 없음'; } },
  { to: 'stores', label: '제휴 카페 위치', icon: 'cup', sub: () => `지도 · ${CAFES.length}곳` },
  { to: 'home', label: '처음 화면', icon: 'home' },
];
const AR_SCREENS = ['scan', 'artwork', 'stage', 'roleplay', 'escape'];

// 메뉴 항목 아이콘(선 그림)
const ICON = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  gift: 'M3 8h18v4H3zM5 12h14v8H5zM12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0',
  cup: 'M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
};
const Ico = ({ d }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

/** 오른쪽 위(상단바·AR 상단·홈)에 붙는 메뉴 버튼(☰) */
export function MenuButton({ dark = false }) {
  const { setMenu } = useApp();
  return (
    <button type="button" className={'menu-btn' + (dark ? ' on-ar' : '')} aria-label="메뉴 열기" onClick={() => setMenu(true)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  );
}

/** 메뉴 판(App 에서 한 번만 그림) */
export default function PauseMenu() {
  const app = useApp();
  const { menu, setMenu, go, screen, demo, setDemo, resetProgress } = app;
  if (!menu) return null;
  const move = (to) => {
    if (AR_SCREENS.includes(screen.name) && !AR_SCREENS.includes(to)) stopCamera();
    if (to === screen.name) setMenu(false);
    else go(to, to === 'home' ? null : undefined);
  };
  return (
    <div className="pause" role="dialog" aria-modal="true" aria-label="메뉴" onClick={() => setMenu(false)}>
      <div className="pause-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pause-head">
          <div className="pause-title">별 헤는 밤</div>
          <button type="button" className="menu-btn" aria-label="메뉴 닫기" onClick={() => setMenu(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <button type="button" className="btn" onClick={() => setMenu(false)}>이어하기</button>
        <nav className="pause-list">
          {ITEMS.map((it) => (
            <button key={it.to} type="button" className={'pause-item' + (it.to === screen.name ? ' cur' : '')} onClick={() => move(it.to)}>
              <span className="pause-ico"><Ico d={ICON[it.icon]} /></span>
              <span className="pause-label">{it.label}</span>
              {it.sub && <span className="muted small">{it.sub(app)}</span>}
            </button>
          ))}
        </nav>
        <div className="pause-demo">
          <button type="button" className="link muted" onClick={() => setDemo({ ...demo, on: !demo.on })}>{demo.on ? '데모 모드 켜짐 · 끄기' : '데모 모드 켜기'}</button>
          {demo.on && <button type="button" className="link muted" onClick={resetProgress}>진행 초기화</button>}
        </div>
      </div>
    </div>
  );
}
