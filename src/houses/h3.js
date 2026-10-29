// 스팟 3 · 헤레디움
// 스팟(건물) 데이터 한 곳 = 파일 하나. 목록 순서는 houses/index.js.
// TODO(기획): [대괄호] = 확정 전(역사·연도·작가·작품·역할극 대본).
// TODO(현장): lat/lng 는 지도 앱에서 건물 앞 서는 자리를 찍어 소수점 6자리로 교체(데모 모드에선 상관없음).
// map: 스팟 3 지도 사진(src/assets/spots/spot3.webp) 위 % 위치 = 팀이 표시한 헤레디움 자리.
//   img · w · h = 그 사진과 크기(px). 02 지도에서 이 스팟을 고르면 이 사진이 나옴.
// server: 서버(Rest-Backend) 스팟 id 짝
import mapImg from '../assets/spots/spot3.webp';

export default {
  id: 'h3',
  server: 'c', // 서버 스팟 id
  look: 'hall', // 정면 모양(자리표시 그림) — src/ui/facade.js
  no: 3,
  name: '헤레디움',
  area: '인동 · 대전로',
  era: '[연도]',
  lat: 36.325350, lng: 127.432450, // [대략값] 현장 확인
  // 이 스팟의 별 2개(별마다 방법 하나) — lib/missions.js id
  missions: ['view', 'escape'], // 헤레디움: 역할극 없음 — 전시물(땅에서 솟아오르는 전시 건축물) + 콘텐츠(별자리 퍼즐)
  view: 'artwork', // 전시 보기 화면(땅 위 3D 작품)
  map: { img: mapImg, w: 1120, h: 657, x: 40.8, y: 44.4 },
  story: '[역사 작성 필요] 1922년 구 동양척식주식회사 대전지점. 국가등록문화유산, 지금은 복합문화공간.',
  stage: { artist: '[작가 C]', theme: '옛 시대 배경', oldEra: true },
  yard: '헤레디움 앞 빈 땅',
  // 전시 건축물(건축 예술품, form: ui/Sculpture.jsx FORMS)이 땅에서 솟아오름
  artworks: [
    { title: '[작품명 1]', artist: '[작가]', about: '[작가 · 작품 소개]', form: 'pavilion' },
    { title: '[작품명 2]', artist: '[작가]', about: '[작가 · 작품 소개]', form: 'gate' },
    { title: '[작품명 3]', artist: '[작가]', about: '[작가 · 작품 소개]', form: 'dome' },
  ],

  roleplay: {
    people: ['그 시대 인물 A', '그 시대 인물 B'],
    scenes: [{ who: 0, line: '[대사 1]' }, { who: 1, line: '[대사 2]' }],
    cut: '헤레디움',
  },
  short: '헤레디움', // 화면에 줄여 쓰는 이름
  // 단서 얻기(07) 별자리 퍼즐은 회차마다 섞어서 배정 → src/lib/puzzles.js
  escape: { minutes: 15 },
};
