// AR 화면 하단: 평소엔 버튼 하나. 버튼을 누르면 밑에서 시트가 올라와 작가·작품 이야기 + 다음으로 들어가는 버튼.
// 시트는 시트 바로 위의 닫기 버튼(여는 버튼과 같은 모양)으로 내려감(아래로 끌어도 됨).
// onDone 이 있으면 닫기 대신 "확인"(doneLabel) — 누르면 onDone(예: 헤레디움 전시 보기 → 별).
import { useState } from 'react';
import useDragY from './useDragY.js';

export default function Peek({ label, title, children, avatar = false, onDone, doneLabel = '확인' }) {
  const [open, setOpen] = useState(false);
  const drag = useDragY({ onDown: () => setOpen(false), min: 40 });

  if (!open) {
    return <button type="button" className="btn light peek-btn" onClick={() => setOpen(true)}>{label}</button>;
  }
  return (
    <div className="sheet-dock" style={drag.style}>
      <button type="button" className="btn light sheet-close" onClick={() => { setOpen(false); onDone?.(); }}>{onDone ? doneLabel : '닫기'}</button>
      <section className="peek-sheet open" {...drag.handlers}>
      <div className={avatar ? 'peek-row' : 'peek-head'}>
        {avatar && <span className="avatar" aria-hidden="true" />}
        <span>{title}</span>
      </div>
      <div className="peek-body">{children}</div>
      </section>
    </div>
  );
}
