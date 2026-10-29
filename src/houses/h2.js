// 스팟 2 · 소제점방
// 스팟(건물) 데이터 한 곳 = 파일 하나. 목록 순서는 houses/index.js.
// TODO(기획): [대괄호] = 확정 전(역사·연도·작가·작품·역할극 대본).
// TODO(현장): lat/lng 는 지도 앱에서 건물 앞 서는 자리를 찍어 소수점 6자리로 교체(데모 모드에선 상관없음).
// map: 스팟 2 지도 사진(src/assets/spots/spot2.webp) 위 % 위치 = 팀이 표시한 소제점방 자리.
//   img · w · h = 그 사진과 크기(px). 02 지도에서 이 스팟을 고르면 이 사진이 나옴.
// server: 서버(Rest-Backend) 스팟 id 짝
import mapImg from '../assets/spots/spot2.webp';

export default {
  id: 'h2',
  server: 'b', // 서버 스팟 id
  look: 'theatre', // 정면 모양(자리표시 그림) — src/ui/facade.js
  no: 2,
  name: '소제점방',
  area: '소제동 · 수향2길',
  era: '[연도]',
  lat: 36.333050, lng: 127.438050, // [대략값] 현장 확인
  // 이 스팟의 별 2개(별마다 방법 하나) — lib/missions.js id
  missions: ['role', 'escape'],
  map: { img: mapImg, w: 901, h: 777, x: 58.5, y: 12.4 },
  story: '[역사 작성 필요] 소제동 골목 어귀의 오래된 점방.',
  stage: { artist: '[작가 B]', theme: '[연출 주제]', oldEra: false },
  yard: '소제점방 앞 빈 땅',
  artworks: [{ title: '[작품명]', artist: '[작가]', about: '[작가 · 작품 소개]' }],
  roleplay: {
    people: ['그 시대 인물 A', '그 시대 인물 B'],
    scenes: [{ who: 0, line: '[대사 1]' }, { who: 1, line: '[대사 2]' }],
    cut: '소제점방',
  },
  short: '소제점방', // 화면에 줄여 쓰는 이름
  // 단서 얻기(07) 별자리 퍼즐은 회차마다 섞어서 배정 → src/lib/puzzles.js
  escape: { minutes: 15 },
};
