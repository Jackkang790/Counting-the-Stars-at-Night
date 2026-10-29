// 목업 배경: 밤 22시의 원도심 풍경. 실제 카메라 영상 자리를 대신함(데모 모드 · 후면 카메라 없는 기기).
// scene: building = 지금 건물(건물마다 정면 모양 다름, facade.js) / ground = 건물 옆 빈 땅 / wall = 골목 담장 / street = 하늘·땅만(화면이 건물을 따로 그릴 때)
// 건물은 04-B 옛 모습(OldHouse)과 같은 상자·같은 좌표로 그려서 화면 크기가 달라도 정확히 겹침.
// 생동감: 손에 든 카메라처럼 살짝 흔들림(cam-sway — 04-B 옛 모습 · 04-A 작품도 같은 흔들림이라 어긋나지 않음) ·
//   별 반짝임 · 창문 불빛 깜빡임 · 렌즈 비네트 · 필름 노이즈. 움직임 줄이기 설정이면 멈춤.
// TODO(현장): 현장 사진(밤)을 찍으면 사진으로 바꿔 끼우기.
import { useApp } from '../store.jsx';
import { facadeOf } from './facade.js';
import { box, Signs } from './OldHouse.jsx';

// 별: 고정 배치(렌더마다 안 바뀜) · 반짝임 시차
const rnd = (n) => ((Math.sin(n * 91.7) * 43758.5453) % 1 + 1) % 1;
const STARS = Array.from({ length: 34 }, (_, i) => [rnd(i + 1) * 100, rnd(i + 40) * 40, rnd(i + 80) * 4, 1 + rnd(i + 120) * 1.6]);

function Building() {
  const { house } = useApp();
  const f = facadeOf(house.look);
  return (
    <div className="mock-bld">
      <svg viewBox="0 0 320 300" aria-hidden="true">
        <rect {...box(f.parapet)} fill="#3b3433" />
        <rect {...box(f.body)} fill="#6b625b" />
        {/* 창문: 몇 개는 안에 불이 켜져 있고 은은하게 깜빡임 */}
        {f.windows.map((w, i) => <rect key={i} {...box(w)} fill={i % 3 === 1 ? '#e8b964' : '#2a2624'} stroke="#857a70" className={i % 3 === 1 ? 'mock-lit' : undefined} style={i % 3 === 1 ? { animationDelay: `${(i * 1.7) % 5}s` } : undefined} />)}
        <rect {...box(f.door)} fill="#241f1d" />
        <Signs f={f} fill="#2a2624" stroke="#857a70" text="#9a8f84" />
      </svg>
    </div>
  );
}

export default function MockScene({ scene = 'building' }) {
  return (
    <div className={'mock mock-' + scene} aria-hidden="true">
      {STARS.map(([x, y, d, s], i) => <i key={i} className="mock-star" style={{ left: x + '%', top: y + '%', width: s, height: s, animationDelay: `-${d}s` }} />)}
      {scene === 'wall' && <div className="mock-wall-band" />}
      {scene === 'building' && <Building />}
      <i className="mock-fx" />
    </div>
  );
}
