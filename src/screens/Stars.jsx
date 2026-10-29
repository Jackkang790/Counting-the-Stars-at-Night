// 05 나의 별자리 — 받은 별 · 다시 볼 수 있는 짧은 영상 · 완성 보상(카페 쿠폰 + 이어진 이야기 전체 영상)
import { useEffect } from 'react';
import { useApp } from '../store.jsx';
import { POINTS, SPOTS, TOTAL_STARS, pointById } from '../lib/spots.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';
import Constellation from '../ui/Constellation.jsx';

export default function Stars() {
  const { stars, complete, fresh, clearFresh, go } = useApp();
  const newPt = fresh && pointById(fresh);

  // "새 별!" 은 받은 직후 한 번만
  useEffect(() => clearFresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const action = complete ? (
    <div className="two">
      <button type="button" className="btn secondary" onClick={() => go('coupons')}>내 쿠폰</button>
      <button type="button" className="btn" onClick={() => go('story')}>이어진 이야기 보기</button>
    </div>
  ) : (
    <button type="button" className="btn secondary" onClick={() => go('map')}>다음 별 찾기</button>
  );

  return (
    <Screen>
      <TopBar back title="나의 별자리" right={<span className="muted">★ {stars.length}/{TOTAL_STARS}</span>} />
      <StickyAction action={action}>
        <main>
          {newPt && (
            <div className="got">
              <span className="big-star">★</span>
              <div>
                <b>새 별!</b>
                <p className="muted small">{newPt.spot.act} · {newPt.title}</p>
              </div>
            </div>
          )}

          <div className="sky">
            <Constellation stars={stars} fresh={fresh} />
          </div>

          {complete ? (
            <div className="reward done">
              <b>별자리 완성</b>
              <span>원도심 카페 쿠폰이 발급됐어요. 커피 한 잔과 함께 이어진 이야기 전체 영상을 보세요.</span>
            </div>
          ) : (
            <div className="reward">
              <span>별 {TOTAL_STARS}개 · 카페 쿠폰 + 이어진 이야기 전체 영상</span>
              <b>{stars.length}/{TOTAL_STARS}</b>
            </div>
          )}

          {SPOTS.map((s) => (
            <section key={s.id} className="spot">
              <div className="spot-head"><b>{s.act} · {s.name}</b><span className="muted small">{s.actLabel}</span></div>
              {s.points.map((p) => {
                const got = stars.includes(p.id);
                return (
                  <div key={p.id} className={'pt-row' + (got ? ' got' : '')}>
                    <span className={'pt-star' + (got ? ' on' : '')}>★</span>
                    <span className="pt-text">
                      <span className="cap">{p.kind === 'musical' ? 'AR 뮤지컬' : '별길 작품'}</span>
                      <b>{got ? p.title : '아직 못 받은 별'}</b>
                    </span>
                    {got && p.kind === 'musical' && (
                      <button type="button" className="link" onClick={() => go('musical', p.id)}>다시 보기</button>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
          <p className="muted small">{POINTS.length}개 중 {stars.length}개</p>
        </main>
      </StickyAction>
    </Screen>
  );
}
