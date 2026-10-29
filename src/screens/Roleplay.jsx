// 06 역할극 = 스토리보드 — 밖에서 비추면 벽이 투명해지고, 건물 안에서 그 시대 인물들의 이야기가 진행됨
// → 마지막 장면에서 스토리보드 컷 + 도장. 작가는 무대를 연출한 사람(등장인물 아님).
import { useState } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import OldHouse from '../ui/OldHouse.jsx';
import { ArHead } from '../ui/chrome.jsx';

function Person({ x, talking, flip }) {
  return (
    <g transform={`translate(${x} 0) ${flip ? 'scale(-1 1)' : ''}`} className={talking ? 'talk' : ''}>
      <circle cx="0" cy="168" r="9" fill="#2b2522" />
      <path d="M-13 212 Q-13 180 0 180 Q13 180 13 212 Z" fill="#2b2522" />
    </g>
  );
}

export default function Roleplay() {
  const { ep, go, stamp } = useApp();
  const { scenes, people } = ep.roleplay;
  const [n, setN] = useState(0);
  const last = n === scenes.length - 1;
  const sc = scenes[n];

  // 벽이 투명해진 부분: 집 안 (방 + 인물 둘)
  const inside = (
    <g className="see-through">
      <rect x="50" y="128" width="200" height="94" rx="4" fill="#f6d79a" fillOpacity=".92" stroke="#fff6dc" strokeWidth="2" strokeDasharray="5 4" />
      <rect x="120" y="196" width="60" height="6" fill="#7a5a44" />
      <Person x={105} talking={sc.who === 0} />
      <Person x={195} talking={sc.who === 1} flip />
    </g>
  );

  const finish = () => { stamp(ep.id, 'role'); go('stamps', null, { replace: true }); };

  return (
    <div className="ar">
      <Camera />
      <ArHead left="back" pill={`역할극 · 장면 ${n + 1} / ${scenes.length}`} />
      <div className="ar-hint">{ep.stage.artist}가 연출한 무대</div>
      <div className="overlay">
        <OldHouse restore={ep.stage.oldEra} inside={inside} />
        <span className="inside-tag">벽이 투명해지며 실내가 비침</span>
      </div>
      <div className="role-cap">밖에 선 채로 건물 안의 이야기를 들여다봄</div>

      <div className="line-card">
        <div className="cap">{people[sc.who]}</div>
        <p>{sc.line}</p>
        <div className="dots left">
          {scenes.map((_, k) => <i key={k} className={k === n ? 'on' : ''} />)}
        </div>
        <div className="two">
          <button type="button" className="btn ghost" disabled={last} onClick={() => setN(n + 1)}>다음 장면</button>
          <button type="button" className="btn light-solid" disabled={!last} onClick={finish}>장면 완료 · 도장</button>
        </div>
      </div>
    </div>
  );
}
