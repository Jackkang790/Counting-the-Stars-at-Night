// 08 도장 · 스토리보드 — 역할극 컷 모음 + 방탈출 도장 + 완성 보상
import { useEffect } from 'react';
import { useApp } from '../store.jsx';
import { EPISODES, TOTAL_STAMPS, byId } from '../lib/episodes.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';

const KIND = { role: '역할극', escape: '방탈출' };

export default function Stamps() {
  const { stamps, count, go, fresh, clearFresh } = useApp();
  const roles = EPISODES.filter((ep) => stamps[ep.id]?.role).length;
  const escapes = EPISODES.filter((ep) => stamps[ep.id]?.escape).length;
  const newEp = fresh && byId(fresh.ep);

  // "새 도장 획득!" 은 받은 직후 한 번만
  useEffect(() => clearFresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <TopBar back title="나의 도장판" right={<span className="muted">{count}/{TOTAL_STAMPS}</span>} />
      <StickyAction action={<button type="button" className="btn secondary" onClick={() => go('map')}>다음 관사로</button>}>
        <main>
          {newEp && (
            <div className="got">
              <span className="big-stamp"><small>관사 {newEp.order}</small>{KIND[fresh.kind]}</span>
              <div>
                <b>새 도장 획득!</b>
                <p className="muted small">{fresh.kind === 'role' ? '장면이 스토리보드에 추가됐어요' : '잠긴 문을 열었어요'}</p>
              </div>
            </div>
          )}

          <div className="sec-head"><b>스토리보드 · 역할극</b><span className="muted small">{roles}/{EPISODES.length}</span></div>
          <div className="story-board">
            {EPISODES.map((ep) => {
              const on = stamps[ep.id]?.role;
              return (
                <div key={ep.id} className={'panel' + (on ? ' on' : '')}>
                  {on ? <span className="panel-cap">#{ep.order} {ep.roleplay.cut}</span> : '?'}
                </div>
              );
            })}
          </div>

          <div className="sec-head"><b>방탈출</b><span className="muted small">{escapes}/{EPISODES.length}</span></div>
          <div className="escape-row">
            {EPISODES.map((ep) => (
              <span key={ep.id} className={'big-stamp' + (stamps[ep.id]?.escape ? ' on' : '')}>관사 {ep.order}</span>
            ))}
          </div>

          <div className="reward">
            <span>{TOTAL_STAMPS}개 완성 · 이어진 이야기 영상 + 작가 엽서</span>
            <b>{count}/{TOTAL_STAMPS}</b>
          </div>
        </main>
      </StickyAction>
    </Screen>
  );
}
