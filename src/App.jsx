import { AppProvider, useApp } from './store.jsx';
import Home from './screens/Home.jsx';
import MapScreen from './screens/MapScreen.jsx';
import Scan from './screens/Scan.jsx';
import Artwork from './screens/Artwork.jsx';
import Stage from './screens/Stage.jsx';
import Wall from './screens/Wall.jsx';
import Sheet from './screens/Sheet.jsx';
import Roleplay from './screens/Roleplay.jsx';
import Escape from './screens/Escape.jsx';
import Stamps from './screens/Stamps.jsx';

const SCREENS = {
  home: Home,       // 01 진입 · 도장판
  map: MapScreen,   // 02 도장깨기 지도
  scan: Scan,       // 03 비추면 자동 인식
  artwork: Artwork, // 04-A 빈 땅 · 작품이 솟아남
  stage: Stage,     // 04-B 실제 건물 · 작가의 무대 (MVP)
  wall: Wall,       // 04-C 담장 · 미술 전시관
  sheet: Sheet,     // 05 건물 이야기
  roleplay: Roleplay, // 06 역할극
  escape: Escape,   // 07 방탈출
  stamps: Stamps,   // 08 도장 · 스토리보드
};

function Current() {
  const { screen } = useApp();
  const Screen = SCREENS[screen.name] || Home;
  return <Screen key={screen.name} />;
}

export default function App() {
  return (
    <AppProvider>
      <Current />
    </AppProvider>
  );
}
