// 08 나의 별자리 — 별자리 배너 + 방금 받은 별 + 완성 보상(미션별 모음판 없음)
// 별 TOTAL_STAMPS 개 완성 → 이어진 이야기 영상 + 작가 엽서 + 카페 쿠폰(서버 발급) → 쿠폰함
import { useApp } from '../store.jsx';
import { TOTAL_STAMPS, houseById } from '../lib/spots.js';
import { missionById } from '../lib/missions.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';
import Star from '../ui/Star.jsx';
import MyConstellation from '../ui/MyConstellation.jsx';


export default function Stamps() {
  const { count, complete, fresh, go, round, rounds, canReplay, nextRound } = useApp();
  const [fh, fk] = fresh ? fresh.split(':') : [];
  const fHouse = fh && houseById(fh);
  const fMission = fk && missionById(fk);


  const action = (
    <>
      <div className="reward">
        <span>{`${TOTAL_STAMPS}개 완성 · 이어진 이야기 영상 + 작가 엽서`}</span>
        <b>{count}/{TOTAL_STAMPS}</b>
      </div>
      {complete ? (
        <>
          <button type="button" className="btn" onClick={() => go('couponbox')}>쿠폰함</button>
          {/* 쿠폰 최대 3번: 다음 회차는 스팟마다 다른 별자리 */}
          {canReplay && <button type="button" className="btn secondary" onClick={nextRound}>한 번 더 · {round + 1}회차 (별자리가 바뀌어요)</button>}
        </>
      ) : (
        <button type="button" className="btn secondary" onClick={() => go('map')}>다음 스팟으로</button>
      )}
    </>
  );

  return (
    <Screen>
      <TopBar back title={`나의 별자리 · ${round}/${rounds}회차`} right={<span className="muted">{count}/{TOTAL_STAMPS}</span>} />
      <StickyAction action={action}>
        <main>
          {/* 나의 별자리 배너: 별 TOTAL_STAMPS 개로 이루어진 별자리, 방금 받은 별은 반짝임 */}
          <section className="const-banner" aria-label="나의 별자리">
            <div className="row">
              <b>나의 별자리 <span className="muted small">{round}/{rounds}회차</span></b>
              <span className="const-count">★ {count} / {TOTAL_STAMPS}</span>
            </div>
            <MyConstellation fresh={fresh} vertical />
            <p className="muted small">{complete ? '별자리 완성! 쿠폰함에서 카페 쿠폰을 확인하세요' : `별 ${TOTAL_STAMPS - count}개를 더 모으면 별자리 완성 · 카페 쿠폰`}</p>
          </section>
          {fHouse && fMission && (
            <div className="got">
              <Star on label={fMission.star} className="big" />
              <div>
                <b>새 별 획득! · 스팟 {fHouse.no}</b>
                <p className="muted small">{fMission.got}</p>
              </div>
            </div>
          )}

        </main>
      </StickyAction>
    </Screen>
  );
}
