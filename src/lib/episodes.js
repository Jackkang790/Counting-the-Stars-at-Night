// 테미오래 관사 데이터
// TODO(기획): 건물명·작가·작품·역할극 대본·방탈출 단서는 확정본으로 교체.
// TODO(현장): lat/lng 는 임시 좌표. 지도 앱에서 각 관사 입구를 찍어 소수점 6자리로 교체.
//   좌표가 틀려도 데모 모드에선 상관없음.
// target: 이 관사에서 카메라가 처음 잡는 대상 (building = 작가의 무대 / ground = 빈 땅 작품 / wall = 담장 전시관)
// artworks: 빈 땅(마당)에 솟아나는 작품들 · gallery: 담장에 걸리는 작품들(null = 빈 자리 → 별무리)
// escape.clues: name = AR 표식 이름, text = 찾으면 보이는 단서, x/y = 카메라 화면 위 표식 자리(%)

export const EPISODES = [
  {
    id: 'ep1',
    order: 1,
    title: '옛 도지사 공관',
    era: '근대',
    lat: 36.3203,
    lng: 127.4242,
    radius: 35, // m. 이 반경 안에 들어오면 해금
    target: 'building',
    map: { x: 34, y: 34 },
    story: '[관사 1 역사 작성 필요] 1930년대에 지어진 도지사의 관사. 이 집에 처음 불이 켜지던 밤의 이야기.',
    stage: { artist: '[작가 A]', theme: '옛 시대 배경', oldEra: true },
    artworks: [
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
    ],
    roleplay: {
      people: ['[그 시대 인물 A]', '[그 시대 인물 B]'],
      scenes: [
        { who: 0, line: '[대사 1] 오늘 밤도 불을 늦게까지 켜 두셨네요.' },
        { who: 1, line: '[대사 2] 이 집의 첫 겨울이니까요.' },
        { who: 0, line: '[대사 3] 창밖으로 별이 참 많아요.' },
        { who: 1, line: '[대사 4] 이 별들을 오래 기억하게 될 거예요.' },
      ],
      cut: '첫 불이 켜지던 밤',
    },
    escape: {
      door: '공관의 잠긴 문',
      minutes: 15,
      clues: [
        { name: '편지', text: '[건물 역사 속 숫자·이름을 암시하는 문구]', x: 24, y: 30 },
        { name: '명패', text: '[현관 명패에 새겨진 연도]', x: 48, y: 62 },
        { name: '일기', text: '[정원 나무 수를 암시하는 문구]', x: 76, y: 24 },
      ],
      code: '1932',
    },
  },
  {
    id: 'ep2',
    order: 2,
    title: '[관사 2]',
    era: '근대',
    lat: 36.3201,
    lng: 127.4246,
    radius: 30,
    target: 'ground',
    map: { x: 62, y: 52 },
    story: '[관사 2 역사 작성 필요] 담장 너머로 오가던 사람들.',
    stage: { artist: '[작가 B]', theme: '[연출 주제]', oldEra: false },
    artworks: [
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
    ],
    roleplay: {
      people: ['[인물 A]', '[인물 B]'],
      scenes: [
        { who: 0, line: '[대사 1]' },
        { who: 1, line: '[대사 2]' },
      ],
      cut: '[장면 제목]',
    },
    escape: {
      door: '[잠긴 문]',
      minutes: 15,
      clues: [
        { name: '[단서 1]', text: '[단서 내용]', x: 24, y: 30 },
        { name: '[단서 2]', text: '[단서 내용]', x: 48, y: 62 },
        { name: '[단서 3]', text: '[단서 내용]', x: 76, y: 24 },
      ],
      code: '0000',
    },
  },
  {
    id: 'ep3',
    order: 3,
    title: '[관사 3]',
    era: '근대',
    lat: 36.3199,
    lng: 127.425,
    radius: 30,
    target: 'wall',
    map: { x: 44, y: 74 },
    story: '[관사 3 역사 작성 필요] 오래된 정원에 남은 계절.',
    stage: { artist: '[작가 C]', theme: '옛 시대 배경', oldEra: true },
    artworks: [
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
      { artist: '[작가명]', title: '[작품명]' },
    ],
    wallName: '[담장 갤러리 · 관사 사이]',
    gallery: [
      { artist: '[작가 A]', title: '[작품 1]' },
      { artist: '[작가 B]', title: '[작품 2]' },
      null, // 비어 있는 벽 → 별무리
      { artist: '[작가 C]', title: '[작품 4]' },
      null,
      { artist: '[작가 D]', title: '[작품 6]' },
      { artist: '[작가 E]', title: '[작품 7]' },
      null,
    ],
    roleplay: {
      people: ['[인물 A]', '[인물 B]'],
      scenes: [
        { who: 0, line: '[대사 1]' },
        { who: 1, line: '[대사 2]' },
      ],
      cut: '[장면 제목]',
    },
    escape: {
      door: '[잠긴 문]',
      minutes: 15,
      clues: [
        { name: '[단서 1]', text: '[단서 내용]', x: 24, y: 30 },
        { name: '[단서 2]', text: '[단서 내용]', x: 48, y: 62 },
        { name: '[단서 3]', text: '[단서 내용]', x: 76, y: 24 },
      ],
      code: '0000',
    },
  },
];

export const byId = (id) => EPISODES.find((e) => e.id === id);
export const TOTAL_STAMPS = EPISODES.length * 2;
