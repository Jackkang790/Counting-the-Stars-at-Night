// 07 방탈출 — 주변 단서 3개(카메라 위 표식) → 잠긴 문 열기 + 도장
// 제한 시간이 흐르고, 힌트를 쓰면 1분이 줄어드는 대신 비밀번호 한 자리가 채워짐.
// TODO(인식): 표식 자리는 지금 화면 고정(x/y). 현장에선 실제 단서 위치(hit-test/이미지 마커)에 붙이기.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Escape() {
  const { ep, go, stamp } = useApp();
  const { clues, code, door, minutes } = ep.escape;
  const [seen, setSeen] = useState([]);
  const [cur, setCur] = useState(null); // 시트에 보이는 단서
  const [val, setVal] = useState('');
  const [bad, setBad] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const input = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const find = (k) => { setSeen((s) => (s.includes(k) ? s : [...s, k])); setCur(k); };
  const type = (v) => { setBad(false); setVal(v.replace(/\D/g, '').slice(0, code.length)); };
  const hint = () => {
    if (val.length >= code.length) return;
    setLeft((s) => Math.max(0, s - 60));
    // 앞에서부터 맞는 자리까지 남기고 다음 한 자리를 채움
    let k = 0;
    while (k < val.length && val[k] === code[k]) k++;
    type(code.slice(0, k + 1));
  };
  const open = () => {
    if (val === code) { stamp(ep.id, 'escape'); go('stamps', null, { replace: true }); }
    else { setBad(true); setVal(''); input.current?.focus(); }
  };

  return (
    <div className="ar">
      <Camera />
      <ArHead
        left="back"
        pill={`방탈출 · 단서 ${seen.length} / ${clues.length}`}
        right={<span className={'timer' + (left === 0 ? ' over' : '')}>{mmss(left)}</span>}
      />

      {clues.map((c, k) => (
        <button
          key={k}
          type="button"
          className={'clue-mark' + (seen.includes(k) ? ' on' : '')}
          style={{ left: c.x + '%', top: `calc(90px + ${c.y * 0.45}%)` }} // 아래 시트에 가리지 않게 화면 위쪽 절반 안
          onClick={() => find(k)}
        >
          {seen.includes(k) ? `${c.name} ✓` : '?'}
        </button>
      ))}

      <section className="sheet lock-sheet">
        <i className="grip" />
        <h3 className="lock-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          {door}
        </h3>
        <div className="clue-box">
          {cur == null ? '주변의 ? 표식을 비춰 단서를 찾아요' : `단서 ${cur + 1} · ${clues[cur].name}: ${clues[cur].text}`}
        </div>

        <label className={'code' + (bad ? ' bad' : '')} onClick={() => input.current?.focus()}>
          {Array.from(code, (_, k) => <span key={k} className={val[k] ? 'on' : ''}>{val[k] ?? ''}</span>)}
          <input
            ref={input}
            inputMode="numeric"
            autoComplete="off"
            aria-label="비밀번호"
            value={val}
            onChange={(e) => type(e.target.value)}
          />
        </label>
        {bad && <p className="bad-msg">아직 안 열려요. 단서를 다시 살펴보세요.</p>}
        {left === 0 && <p className="bad-msg">시간이 다 됐어요 · 계속 도전할 수 있어요</p>}

        <div className="two">
          <button type="button" className="btn secondary" onClick={hint}>힌트 (−1분)</button>
          <button type="button" className="btn" disabled={val.length !== code.length} onClick={open}>열기 · 도장</button>
        </div>
      </section>
    </div>
  );
}
