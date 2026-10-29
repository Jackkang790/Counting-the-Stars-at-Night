import { AppProvider, useApp } from './store.jsx';
import PauseMenu from './ui/PauseMenu.jsx';
import Home from './screens/Home.jsx';
import MapScreen from './screens/MapScreen.jsx';
import Scan from './screens/Scan.jsx';
import Artwork from './screens/Artwork.jsx';
import Stage from './screens/Stage.jsx';
import Sheet from './screens/Sheet.jsx';
import Roleplay from './screens/Roleplay.jsx';
import Escape from './screens/Escape.jsx';
import Stamps from './screens/Stamps.jsx';
import CouponBox from './screens/CouponBox.jsx';
import Coupons from './screens/Coupons.jsx';
import Stores from './screens/Stores.jsx';

// 와이어프레임 01~11 (별헤는밤 와이어프레임 PDF)
const SCREENS = {
  home: Home,         // 01 진입 · 도장판
  map: MapScreen,     // 02 밤 마실 걷기 지도
  scan: Scan,         // 03 비추면 자동 인식
  artwork: Artwork,   // 04-A 빈 땅 · 작품이 솟아남
  stage: Stage,       // 04-B 실제 건물 · 작가의 무대 (MVP)
  sheet: Sheet,       // 05 건물 이야기
  roleplay: Roleplay, // 06 역할극
  escape: Escape,     // 07 단서 얻기
  stamps: Stamps,     // 08 도장 · 스토리보드
  couponbox: CouponBox, // 09 쿠폰함
  coupons: Coupons,   // 10 내 쿠폰
  stores: Stores,     // 11 사용 가능 카페
};

function Current() {
  const { screen } = useApp();
  const Screen = SCREENS[screen.name] || Home;
  return <Screen key={screen.name + (screen.h || '')} />;
}

export default function App() {
  return (
    <AppProvider>
      <Current />
      <PauseMenu />
    </AppProvider>
  );
}
