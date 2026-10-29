// 스팟 1 · 소제동 관사 16호
// 스팟(건물) 데이터 한 곳 = 파일 하나. 목록 순서는 houses/index.js.
// TODO(기획): [대괄호] = 확정 전(역사·연도·작가·작품·역할극 대본).
// TODO(현장): lat/lng 는 지도 앱에서 건물 앞 서는 자리를 찍어 소수점 6자리로 교체(데모 모드에선 상관없음).
// map: 스팟 1 지도 사진(src/assets/spots/spot1.webp) 위 % 위치 = 팀이 표시한 "16" 건물 자리.
//   img · w · h = 그 사진과 크기(px). 02 지도에서 이 스팟을 고르면 이 사진이 나옴.
// server: 서버(Rest-Backend) 스팟 id 짝
import mapImg from '../assets/spots/spot1.webp';
import tour from '../../shared/tour.json';

export default {
  id: 'h1',
  server: 'a', // 서버 스팟 id
  look: 'center', // 정면 모양(자리표시 그림) — src/ui/facade.js
  no: 1,
  name: '소제동 관사 16호',
  area: '소제동 · 철갑1길',
  era: '[연도]',
  lat: 36.332450, lng: 127.436950, // [대략값] 현장 확인
  // 이 스팟의 별 2개(별마다 방법 하나) — lib/missions.js id
  missions: ['role', 'escape'],
  map: { img: mapImg, w: 999, h: 792, x: 28.4, y: 48.7 },
  story: '[역사 작성 필요] 소제동 철도관사촌에 원형이 남은 관사(16호). 후루룩대전 옆 골목.',
  stage: { artist: '[작가 A]', theme: '옛 시대 배경', oldEra: true }, // oldEra → 지금은 없는 부분 자동 복원
  yard: '관사 16호 앞 빈 땅',
  artworks: [
    { title: '[작품명 1]', artist: '[작가]', about: '[작가 · 작품 소개]' },
    { title: '[작품명 2]', artist: '[작가]', about: '[작가 · 작품 소개]' },
    { title: '[작품명 3]', artist: '[작가]', about: '[작가 · 작품 소개]' },
  ],
  roleplay: {
    people: ['그 시대 인물 A', '그 시대 인물 B'],
    scenes: [
      { who: 0, line: '[대사 1 — 이 건물에서 있었던 일]' },
      { who: 0, line: '[대사 2 — 이 건물에서 있었던 일, 건물의 역사와 배경]' },
      { who: 1, line: '[대사 3]' },
      { who: 0, line: '[대사 4]' },
    ],
    cut: '관사 16호', // 스토리보드 컷 이름 → "#1 관사 16호"
  },
  short: '관사 16호', // 화면에 줄여 쓰는 이름
  // 단서 얻기(07) 별자리 퍼즐은 회차마다 섞어서 배정 → src/lib/puzzles.js
  escape: { minutes: 15 },
  ...tour.spots.find((spot) => spot.id === 'h1'),
};
