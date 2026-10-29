// 07 단서 얻기 — 별자리 유추 퍼즐을 풀면 단서 + 별
// ① 담장에 실마리 원 3개 — 처음엔 자물쇠, 10초마다 하나씩 풀려 ?(CONFIG.clueEvery, 남은 초 표시 없음) → 눌러서 열고 어떤 별자리인지 유추(작은곰자리 · 카시오페이아 · 오리온자리처럼 잘 알려진 별자리) ② 섞인 별자리 조각을 끌어다 놓아 맞추기(건물마다 2×2 · 3×2 · 2×3)
// ③ 완성된 별자리 이름 고르기 → 맞으면 "단서 얻기 · 별". 남은 시간. 따로 힌트 없음(실마리 3개가 힌트).
// 데모 모드(발표용): 상단 "건너뛰기" → 퍼즐 없이 바로 단서 + 별.
// 유도: 단계 표시(① 실마리 → ② 조각 → ③ 이름) · 아직 안 연 ? 하나에 "눌러 보세요".
// TODO(AR): 실마리 위치는 지금 화면 % 고정. 벽면 인식이 되면 실제 담장 위치에 붙게 교체.
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import ArFrame from '../ui/ArFrame.jsx';
import StarPuzzle from '../ui/StarPuzzle.jsx';
import { missionFor } from '../lib/puzzles.js';
import { CONFIG } from '../lib/spots.js';
import { missionOf } from '../lib/missions.js';

const MISSION = missionOf('escape').id; // 이 화면이 주는 별(lib/missions.js)

const CLUE_EVERY = CONFIG.clueEvery; // 초. 이 간격마다 실마리 하나씩 나타남
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Escape() {
  const { house: h, finish, paused, round } = useApp();
  // 회차마다 건물에 배정되는 별자리가 바뀜(src/lib/puzzles.js)
  const { clues, puzzle, choices, title, minutes } = missionFor(h, round);
  const [found, setFound] = useState([]);
  const [left, setLeft] = useState(minutes * 60);
  const [solved, setSolved] = useState(false);
  const [guess, setGuess] = useState(null);
  const [elapsed, setElapsed] = useState(0); // 들어온 뒤 지난 초 → CLUE_EVERY 초마다 실마리 하나씩

  // 남은 시간: 실제 지난 시간(시계)으로 셈 → 브라우저가 창을 뒤로 보내 타이머를 늦춰도 정확. 메뉴가 열려 있으면(paused) 멈춤.
  useEffect(() => {
    if (paused) return undefined;
    let last = Date.now();
    let carry = 0; // 1초 미만 남은 시간(다음 틱으로 넘김)
    const tick = () => {
      const now = Date.now();
      carry += now - last;
      last = now;
      const sec = Math.floor(carry / 1000);
      if (!sec) return;
      carry -= sec * 1000;
      setLeft((s) => Math.max(0, s - sec));
      setElapsed((n) => n + sec);
    };
    const t = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [paused]);

  const pick = (k) => { setFound((f) => (f.includes(k) ? f : [...f, k])); };
  const right = guess === puzzle.name;
  const shown = Math.min(clues.length, Math.floor(elapsed / CLUE_EVERY)); // 자물쇠가 풀린 실마리 수(CLUE_EVERY 초마다 하나)
  const next = clues.findIndex((_, k) => k < shown && !found.includes(k)); // 다음에 열 실마리(풀린 것 중)
  const step = found.length < clues.length ? 0 : !solved ? 1 : 2;
  const open = () => finish(h.id, MISSION); // 별 받고 → 지도(6개 다 모으면 나의 별자리)

  const guide = step === 0
    ? found.length
      ? `실마리 · ${found.map((k) => clues[k].text).join(' · ')} — 남은 ? ${clues.length - found.length}개를 더 찾아요`
      : shown ? `자물쇠가 풀린 ? 를 눌러 실마리를 모아요` : '담장의 자물쇠가 곧 하나씩 풀려요'
    : step === 1
      ? `실마리 · ${found.map((k) => clues[k].text).join(' · ')} → 조각을 끌어다 놓아 별자리를 이어요`
      : guess && !right ? '실마리를 다시 떠올려 보세요' : '완성! 실마리와 맞는 별자리는?';

  return (
    <ArFrame
      className="escape"
      scene="wall"
      left="back"
      skip={open}
      right={<span className={'timer' + (left < 60 ? ' low' : '')}>{mmss(left)}</span>}
    >
      <div className="clue-field">
        {/* 실마리 원 3개는 처음부터 보임 · 자물쇠로 잠김 → 10 · 20 · 30초에 하나씩 풀려 ? → 누르면 실마리 */}
        {clues.map((cl, k) => k >= shown ? (
          <span key={k} className="clue-dot locked" style={{ left: cl.at.x + '%', top: cl.at.y + '%' }} aria-label="잠긴 실마리"><svg className="clue-lock" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></span>
        ) : (
          <button key={k} type="button" className={'clue-dot' + (found.includes(k) ? ' on' : '') + (k === next ? ' next' : '')} style={{ left: cl.at.x + '%', top: cl.at.y + '%' }} onClick={() => pick(k)}>
            {found.includes(k) ? cl.name : '?'}
            {k === next && <span className="tap-me">눌러 보세요</span>}
          </button>
        ))}
      </div>

      <section className="sheet lock-sheet">
        <div className="lock-head">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
          <b>{title}</b>
        </div>
        <ol className="steps">
          {['실마리 찾기', '조각 맞추기', '이름 맞히기'].map((t, i) => (
            <li key={t} className={i < step ? 'done' : i === step ? 'cur' : ''}>{i < step ? '✓' : i + 1} {t}</li>
          ))}
        </ol>
        <div className={'clue-box' + (guess && !right ? ' bad' : '')}>{guide}</div>

        <div className="pz-wrap"><StarPuzzle key={puzzle.name} puzzle={puzzle} onSolved={() => setSolved(true)} /></div>

        {solved && (
          <div className="choices">
            {choices.map((c) => (
              <button key={c} type="button" className={'choice' + (guess === c ? (right ? ' ok' : ' no') : '')} onClick={() => setGuess(c)}>{c}</button>
            ))}
          </div>
        )}

        <div className="two">
          <button type="button" className="btn" disabled={!right || left === 0} onClick={open}>단서 얻기 · 별</button>
        </div>
      </section>
    </ArFrame>
  );
}
