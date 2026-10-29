// 08 이어진 이야기 — 별자리를 완성하면 열리는 전체 영상. 카페에서 커피 마시며 보는 보상.
import { useApp } from '../store.jsx';
import { STORY, TOTAL_STARS } from '../lib/spots.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';
import Clip from '../ui/Clip.jsx';

export default function Story() {
  const { complete, stars, go, demo } = useApp();
  return (
    <Screen>
      <TopBar back title="이어진 이야기" />
      <StickyAction action={<button type="button" className="btn secondary" onClick={() => go('stores')}>근처 카페 찾기</button>}>
        <main>
          {complete ? (
            <>
              <p className="lead">세 건물의 장면이 하나로 이어져요.<br />커피 한 잔과 함께 천천히 보세요.</p>
              <div className="story-player">
                <Clip src={STORY.src} title={STORY.title} duration={STORY.duration} fast={demo.on} />
              </div>
              <p className="muted small">관사 16호 · 관사 42호 · 헤레디움 · 지역 예술가 [작가 명단]</p>
            </>
          ) : (
            <div className="notice">별 {TOTAL_STARS}개를 모으면 열려요 · 지금 ★ {stars.length}/{TOTAL_STARS}</div>
          )}
        </main>
      </StickyAction>
    </Screen>
  );
}
