// 건물마다 하는 미션 목록(별 = 건물 × 미션). 화면(홈 · 지도 · 05 시트 · 08 나의 별자리 · 06 · 07)은 전부 이 목록을 돌며 그림.
// 미션 추가 = 여기 한 줄 + 그 미션 화면을 App.jsx SCREENS 에 등록(screen 이름 같게).
//   id     : 별 id 의 뒤쪽("h1:role"). 바꾸면 저장된 진행과 안 맞음
//   name   : 화면에 쓰는 이름 · short: 지도 별 안의 한 글자 · star: 08 "새 별 획득" 별 안의 글자
//   screen : 이 미션 화면(App.jsx SCREENS 이름)
//   title · desc : 05 시트 미션 버튼
//   got    : 08 "새 별 획득!" 아래 문구
//   board  : 08 에서 모아 보여 주는 모양 — story = 스토리보드 컷(건물 roleplay.cut) / stars = 건물별 별
export const MISSIONS = [
  {
    id: 'role',
    name: '역할극',
    short: '역',
    star: '역할극',
    screen: 'roleplay',
    title: '역할극 보기',
    desc: '밖에서 건물 안이 비춰 보이며 이야기 진행 · 스토리보드 한 컷',
    got: '장면이 스토리보드에 추가됐어요',
    board: { kind: 'story', title: '스토리보드 · 역할극' },
  },
  {
    id: 'escape',
    name: '단서 얻기',
    short: '단',
    star: '단서',
    screen: 'escape',
    title: '단서 얻기',
    desc: '실마리 3개로 별자리 퍼즐을 풀고 단서 얻기',
    got: '단서를 얻었어요',
    board: { kind: 'stars', title: '단서 얻기' },
  },
  {
    // 전시 보기: 그 스팟의 전시 화면(house.view — artwork: 전시 건축물이 땅에서 솟아오름, 스팟 3 헤레디움)에서 작품 이야기를 열고 "확인"을 누르면 별
    id: 'view',
    name: '전시 보기',
    short: '전',
    star: '전시',
    screen: 'artwork', // 실제 화면은 스팟마다 house.view
    title: '전시 보기',
    desc: '땅에서 솟아오르는 전시 건축물을 보고 확인하면 별',
    got: '전시를 봤어요',
    board: { kind: 'stars', title: '전시 보기' },
  },
];

// 이 스팟에서 별을 주는 미션(house.missions — 스팟마다 2개, 별마다 방법 하나)
export const missionsOf = (house) => house.missions.map((id) => MISSIONS.find((m) => m.id === id)); // house.missions 순서
// 미션 버튼이 갈 화면(전시 보기는 스팟마다 다름)
export const screenOf = (m, house) => (m.id === 'view' ? house.view : m.screen);


export const missionById = (id) => MISSIONS.find((m) => m.id === id);
// 미션 화면이 자기 미션을 찾을 때(화면 이름으로)
export const missionOf = (screen) => MISSIONS.find((m) => m.screen === screen);
