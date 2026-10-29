// 06 역할극 — 밖에서 건물 안이 비춰 보이며 이야기 진행 → 스토리보드 컷 + 도장
// 장면을 끝내면 이 스팟 역할극 별 → 02 지도(다음 스팟으로 자동으로 넘어가지 않음).
// 이 스팟 건물 정면(facade.js — 03 · 04-B 와 같은 모양)의 벽이 투명해지며 실내가 비침. 작가는 무대를 연출한 사람(등장인물 아님), 등장인물은 그 시대 인물.
// TODO(작가): 실내 장면 이미지·인물·대사(음성) 확정본으로 교체.
import { useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import ArFrame from '../ui/ArFrame.jsx';
import { missionOf } from '../lib/missions.js';
import { facadeOf } from '../ui/facade.js';
import { box, Signs } from '../ui/OldHouse.jsx';

const MISSION = missionOf('roleplay').id; // 이 화면이 주는 별(lib/missions.js)

// 두 사각형이 겹치는지
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// 인물: base = 발 위치(실내 바닥). 말하는 인물은 노랗게(이름은 아래 대사 카드에).
function Person({ x, base, talking, s = 1 }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`}>
      {/* 말하는 인물만 살짝 움직임(transform 은 안쪽 g 에만 — 바깥 위치가 덮이지 않게) */}
      <g className={'person' + (talking ? ' talk' : '')}>
        <circle cx="0" cy="-58" r="13" />
        <path d="M-19 0v-29q0-14 19-14t19 14v29z" />
      </g>
    </g>
  );
}

export default function Roleplay() {
  const { house: h, finish } = useApp();
  const { scenes, people } = h.roleplay;
  const [n, setN] = useState(0);
  const last = n === scenes.length - 1;
  const sc = scenes[n];
  // 실내 창(벽이 투명해지는 자리): 이 건물 정면 몸통 안쪽
  const f = facadeOf(h.look);
  // 1층 바닥까지 내려오는 실내(땅에 붙은 방) — 몸통 위쪽 여백만 두고 건물 밑변까지
  const base = f.body.y + f.body.h; // 건물 밑변 = 땅
  // 투명해지는 부분: 아래에서 두 번째 창문 줄(2층)부터 땅까지 통째로(그 안의 창문도 없어지고 실내만 보임).
  // 그 위 층 창문은 03 · 04-B 와 같은 색 그대로. 인물은 실내 바닥(1층)에 섬
  const rows = [...new Set(f.windows.map((w) => w.y))].sort((a, b) => a - b);
  const top2 = rows.length >= 2 ? rows[rows.length - 2] : rows[0];
  const room = { x: f.body.x + 10, y: Math.max(f.body.y + 6, top2 - 10), w: f.body.w - 20, h: 0 };
  room.h = base - room.y;
  const floor = base - 4;
  const ps = Math.min(1, (room.h - 12) / 72); // 실내 높이에 맞춘 인물 크기

  // 역할극을 끝내면 이 스팟 역할극 별만 받고 → 지도(다음 스팟 역할극으로 자동으로 넘어가지 않음 — 걸어가서 직접 봄).
  // 한 번만: 빠르게 두 번 눌러도 별이 다른 스팟에 붙지 않게 막음
  const busy = useRef(false);
  const done = () => {
    if (busy.current) return;
    busy.current = true;
    finish(h.id, MISSION);
  };

  return (
    // 데모 모드(발표용): 게임처럼 건너뛰기 → 바로 별 받고 지도
    <ArFrame scene="sky" left="back" pill={`역할극 · 장면 ${n + 1} / ${scenes.length}`} skip={done}>
      {/* 위에서부터: 안내 → 무대(땅 위에 섬) → 대사 카드. 무대는 남는 높이만큼만 커져서 어떤 화면에서도 땅에 붙어 있음 */}
      <div className="rp-col">
      <div className="rp-stage">
        <p className="rp-hint">밖에 선 채로 건물 안의 이야기를 들여다봄</p>
        {/* 이 스팟 건물 정면(facade.js — 03 · 04-B 와 같은 모양) 위에 벽이 투명해진 실내 */}
        <svg viewBox={`0 ${f.parapet.y - 24} 320 ${base - f.parapet.y + 24}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <text x="160" y={f.parapet.y - 10} textAnchor="middle" className="rp-cap">{h.stage.artist}가 연출한 무대</text>
          <rect {...box(f.parapet)} fill="#3b3433" />
          <rect {...box(f.body)} fill="#6b625b" />
          {/* 바깥 창문은 투명해진 벽(실내) 밖에 있는 것만 — 실내와 겹치지 않게 */}
          {/* 투명해진 부분 바깥(위층) 창문만 — 03 · 04-B 카메라 화면과 같은 색 */}
          {f.windows.map((w, i) => (overlaps(w, room) ? null : <rect key={i} {...box(w)} fill={i % 3 === 1 ? '#e8b964' : '#2a2624'} stroke="#857a70" />))}
          <Signs f={f} fill="#2a2624" stroke="#857a70" text="#9a8f84" />
          {/* 벽이 투명해진 1층 실내(문 · 간판 자리까지 비침) — 바닥 = 건물 밑변 = 땅 */}
          <g className="see-through">
            <rect {...box(room)} className="rp-room" />
            <path d={`M${room.x} ${floor}h${room.w}`} className="rp-floor" />
            <path d={`M${room.x + room.w / 2 - 26 * ps} ${floor - 18 * ps}h${52 * ps}v${6 * ps}h${-52 * ps}z`} className="rp-table" />
            <Person x={room.x + room.w * 0.24} base={floor} talking={sc.who === 0} s={ps} />
            <Person x={room.x + room.w * 0.76} base={floor} talking={sc.who === 1} s={ps} />
          </g>
        </svg>
      </div>

      <div className="line-card">
        <div className="cap">{people[sc.who]}</div>
        <p>{sc.line}</p>
        <div className="dots left">{scenes.map((_, k) => <i key={k} className={k <= n ? 'on' : ''} />)}</div>
        <div className="two">
          <button type="button" className="btn ghost" disabled={last} onClick={() => setN(n + 1)}>다음 장면</button>
          <button type="button" className="btn light-solid" disabled={!last} onClick={done}>장면 완료 · 별</button>
        </div>
      </div>
      </div>
    </ArFrame>
  );
}
