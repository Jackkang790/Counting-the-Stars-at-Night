// 07 단서 얻기 — 별자리 퍼즐 모음 + 회차마다 건물에 섞어 배정.
// 쿠폰은 최대 3번(CONFIG.rounds). 회차가 바뀌면 건물마다 다른 별자리 · 보기 순서가 나와서 다시 해도 새로움.
// 좌표: 조각 한 칸 = 50 (cols×rows). StarPuzzle 이 판 가운데로 맞춰 그림.
// 새 별자리 추가 = PUZZLES 에 하나 더 넣기(실마리 3). 잘 알려진 별자리만. 힌트는 짧게(한 줄 · 10자 안팎).
import { CONFIG } from './spots.js';

export const PUZZLES = [
  {
    name: '작은곰자리', cols: 2, rows: 2,
    stars: [[12, 14], [30, 26], [46, 40], [58, 56], [86, 52], [90, 78], [62, 84]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    clues: ['북극성이 꼬리 끝', '작은 국자 모양', '일곱 개의 별'],
  },
  {
    name: '카시오페이아', cols: 3, rows: 2,
    stars: [[14, 28], [44, 72], [76, 38], [106, 74], [136, 26]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    clues: ['다섯 개의 별', 'W 모양', '북극성 맞은편'],
  },
  {
    name: '오리온자리', cols: 2, rows: 3,
    stars: [[50, 14], [24, 36], [78, 42], [40, 76], [50, 80], [60, 84], [26, 130], [80, 124]],
    lines: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
    clues: ['겨울 밤하늘', '허리띠 별 셋', '사냥꾼'],
  },
  {
    name: '큰곰자리', cols: 3, rows: 2,
    stars: [[12, 22], [42, 30], [68, 40], [92, 52], [96, 82], [136, 78], [132, 48]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    clues: ['봄철 북쪽 하늘', '큰 국자 모양', '북두칠성'],
  },
  {
    name: '전갈자리', cols: 2, rows: 3,
    stars: [[62, 12], [50, 30], [42, 50], [48, 74], [58, 94], [60, 114], [46, 132], [28, 138], [18, 122]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
    clues: ['여름 남쪽 하늘', '붉은 심장 별', '갈고리 꼬리'],
  },
];

// 회차로 정해지는 섞기(새로고침해도 같은 결과)
const rand = (seed) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const shuffle = (arr, seed) => {
  const r = rand(seed), a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const CLUE_AT = [{ x: 20, y: 30 }, { x: 50, y: 34 }, { x: 80, y: 30 }]; // 담장 윗줄(실마리)

/**
 * 이 회차에 이 건물(no: 1부터)의 단서 얻기 미션.
 * 1회차 = 작은곰 · 카시오페이아 · 오리온(기본). 2회차부터 별자리 배정 · 보기 순서를 섞음.
 */
export function missionFor(house, round = 1) {
  const order = round === 1 ? PUZZLES.map((_, i) => i) : shuffle(PUZZLES.map((_, i) => i), round * 101);
  const p = PUZZLES[order[(house.no - 1) % order.length]];
  const others = shuffle(PUZZLES.filter((x) => x !== p).map((x) => x.name), round * 31 + house.no).slice(0, 3);
  return {
    title: `${house.short || house.name} 별자리 퍼즐`,
    minutes: house.escape?.minutes ?? CONFIG.escapeMinutes,
    puzzle: { name: p.name, cols: p.cols, rows: p.rows, stars: p.stars, lines: p.lines },
    clues: p.clues.map((t, i) => ({ name: t, text: t, at: CLUE_AT[i] })),
    choices: shuffle([p.name, ...others], round * 7 + house.no),
  };
}
