// 건물 정면 모양(자리표시). 04-B 작가의 무대(OldHouse) · 목업 배경(MockScene)이 같은 좌표(viewBox 320×300)로 그려서 정확히 겹침.
// look: center = 스팟 1 관사 16호(넓은 2층 + 문패) / theatre = 스팟 2 소제점방(좁은 3층 + 세로 간판) / hall = 스팟 3 헤레디움(차양 간판)
// TODO(현장): 각 건물 실제 사진을 보고 비율·창 배치 맞추기. 작가 이미지가 오면 그걸로 교체.
const grid = (xs, ys, w, h) => ys.flatMap((y) => xs.map((x) => ({ x, y, w, h })));

export const FACADES = {
  center: {
    body: { x: 30, y: 90, w: 240, h: 190 },
    parapet: { x: 24, y: 80, w: 252, h: 12 },
    windows: grid([48, 84, 120, 168, 204, 240], [110, 160], 22, 34),
    door: { x: 130, y: 222, w: 60, h: 58 },
    sign: { x: 110, y: 200, w: 100, h: 16, text: '관사 16호' },
  },
  theatre: {
    body: { x: 80, y: 60, w: 160, h: 220 },
    parapet: { x: 74, y: 50, w: 172, h: 12 },
    windows: grid([100, 145, 190], [78, 128, 178], 30, 36),
    door: { x: 140, y: 230, w: 40, h: 50 },
    vsign: { x: 246, y: 76, w: 20, h: 120, text: '' }, // 세로 간판(글자 없음)
  },
  hall: {
    body: { x: 30, y: 100, w: 260, h: 180 },
    parapet: { x: 24, y: 90, w: 272, h: 12 },
    windows: grid([52, 100, 148, 196, 244], [122], 26, 40),
    door: { x: 120, y: 226, w: 80, h: 54 },
    marquee: { x: 84, y: 196, w: 152, h: 26, text: '헤레디움' },
  },
};

// 지금은 없는 부분(옥상 구조물) — 옛 시대 배경 작품이면 자동 복원
export const restoreOf = (f) => ({ x: 120, y: f.parapet.y - 40, w: 80, h: 40 });

export const facadeOf = (look) => FACADES[look] || FACADES.center;
