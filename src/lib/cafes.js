// 쿠폰 사용 가능 카페(원도심 소상공인 카페) — 팀이 지도 캡처에 표시한 3곳(중앙로역 주변).
// map: 중앙로역 주변 지도 그림(src/assets/map.webp) 위 % 위치 = 지도에 그려진 카페 아이콘 한가운데(핀이 그 위에 겹침).
// tag: 지도 위 이름표 방향(top 위 가운데 · left 왼쪽 위 · right 오른쪽 위) — 붙어 있는 카페끼리 이름표가 겹치지 않게.
// lat/lng 는 지도 그림 위치로 어림한 값 → TODO(현장): 지도 앱에서 찍어 소수점 6자리로 교체.
// TODO(운영): 영업시간 · 혜택 문구 확정. 서버 매장 seed(Rest-Backend)도 이 3곳으로 맞춰 달라고 요청(docs/INTEGRATION_TODO.md).
export const CAFES = [
  { id: 'kiko', name: '키코', area: '대흥동 · 중앙로역 7번 출구 쪽', map: { x: 35.2, y: 43.4 }, tag: 'top', lat: 36.32935, lng: 127.42360, hours: '[영업시간]', benefit: '[아메리카노 1잔]' },
  { id: 'usia', name: '우시아', area: '대흥동 · 중앙로역 8번 출구 쪽', map: { x: 67.8, y: 35.3 }, tag: 'left', lat: 36.32964, lng: 127.42676, hours: '[영업시간]', benefit: '[아메리카노 1잔]' },
  { id: 'osiu', name: '오시우커피', area: '은행동 · 중앙로역 9번 출구 쪽', map: { x: 75.8, y: 37.2 }, tag: 'right', lat: 36.32957, lng: 127.42754, hours: '[영업시간]', benefit: '[아메리카노 1잔]' },
];
