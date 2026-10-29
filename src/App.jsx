import { AppProvider, useApp } from './store.jsx';
import Home from './screens/Home.jsx';
import MapScreen from './screens/MapScreen.jsx';
import Point from './screens/Point.jsx';
import Musical from './screens/Musical.jsx';
import Artwork from './screens/Artwork.jsx';
import Stars from './screens/Stars.jsx';
import Coupons from './screens/Coupons.jsx';
import Stores from './screens/Stores.jsx';
import Story from './screens/Story.jsx';

// 이용 흐름(브리프 6): 스팟 도착 → 포인트에서 웹앱 → AR 감상·별 모으기 → 쿠폰 → 근처 카페
const SCREENS = {
  home: Home,       // 01 진입 · 나의 별자리
  map: MapScreen,   // 02 투어 지도 (스팟 반경 = GPS 확인)
  point: Point,     // 03 포인트 도착 확인 (GPS + 가상 QR)
  musical: Musical, // 04 AR 뮤지컬 짧은 영상 → 별
  artwork: Artwork, // 04-A 별길 작품 → 별
  stars: Stars,     // 05 나의 별자리 · 완성 보상
  coupons: Coupons, // 06 내 쿠폰 (QR · 바코드 · 번호)
  stores: Stores,   // 07 사용 가능 카페 (약도 + 목록)
  story: Story,     // 08 이어진 이야기 전체 영상
};

function Current() {
  const { screen } = useApp();
  const Screen = SCREENS[screen.name] || Home;
  return <Screen key={screen.name + (screen.pt || '')} />;
}

export default function App() {
  return (
    <AppProvider>
      <Current />
    </AppProvider>
  );
}
