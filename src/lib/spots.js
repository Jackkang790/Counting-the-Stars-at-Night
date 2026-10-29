// 세 스팟 · 별 6개 (브리프 5.2 · 5.3)
// 스팟마다 별 2개: ① 건물 외벽 AR 뮤지컬 짧은 영상 ② 근처 별길의 예술가 작품.
// 별 6개를 다 모으면(별자리 완성) 카페 쿠폰 + 이어진 이야기 전체 영상이 열림 → 카페에서 커피 마시며 감상.
//
// TODO(현장): 좌표는 대략값. 포인트(서는 자리)는 공공 공간 · 밤 조명 · 3~4명 서도 통행 안 막힘 ·
//   번호판/간판 같은 그 건물만의 기준점 기준으로 지도 앱에서 찍어 소수점 6자리로 교체.
// TODO(운영): 관사 42호 현재 사용 가능 여부 확인 필요(브리프 13).
// TODO(작가): musical.src / story.src 에 실제 영상(모바일 경량 인코딩) 주소. 비어 있으면 자리표시 장면을 재생.

export const SPOTS = [
  {
    id: 'a',
    act: 'ACT 1',
    actLabel: '관사촌의 기억',
    name: '관사 16호',
    area: '소제동 철도관사촌',
    about: '원형이 보존된 관사, 지금은 티룸으로 운영',
    map: { x: 30, y: 30 },
    points: [
      {
        id: 'a-musical',
        kind: 'musical',
        label: '[관사 16호 번호판 앞 골목]',
        lat: 36.33245, lng: 127.43695,
        title: '[철도원 가족의 저녁]',
        story: '관사촌에 살던 철도원 가족의 기억',
        artist: '[작가 A]',
        duration: 45, // 초. 짧은 영상
        src: '',
      },
      {
        id: 'a-art',
        kind: 'artwork',
        label: '[관사 16호 옆 별길]',
        lat: 36.33265, lng: 127.43725,
        title: '[작품명]',
        artist: '[작가 B]',
        support: '',
      },
    ],
  },
  {
    id: 'b',
    act: 'ACT 2',
    actLabel: '번호판을 따라',
    name: '관사 42호',
    area: '소제동 철도관사촌',
    about: '관사촌에서 가장 알려진 관사, 전시 공간',
    map: { x: 52, y: 44 },
    points: [
      {
        id: 'b-musical',
        kind: 'musical',
        label: '[관사 42호 번호판 앞 골목]',
        lat: 36.33305, lng: 127.43805,
        title: '[골목의 번호판]',
        story: '골목에 남은 번호판을 따라 이어지는 이야기',
        artist: '[작가 C]',
        duration: 45,
        src: '',
      },
      {
        id: 'b-art',
        kind: 'artwork',
        label: '[관사 42호에서 대동천 가는 별길]',
        lat: 36.33285, lng: 127.43865,
        title: '[작품명]',
        artist: '[작가 D]',
        support: '',
      },
    ],
  },
  {
    id: 'c',
    act: '피날레',
    actLabel: '100년 건물의 무대',
    name: '헤레디움',
    area: '인동',
    about: '1922년 구 동양척식주식회사 대전지점, 국가등록문화유산',
    map: { x: 70, y: 74 },
    points: [
      {
        id: 'c-musical',
        kind: 'musical',
        label: '[헤레디움 정면 광장]',
        lat: 36.32535, lng: 127.43245,
        title: '[100년 건물이 무대가 되는 밤]',
        story: '100년 건물이 예술의 무대가 되는 장면',
        artist: '[작가 E]',
        duration: 60,
        src: '',
      },
      {
        id: 'c-art',
        kind: 'artwork',
        label: '[헤레디움 앞 인동 별길]',
        lat: 36.32565, lng: 127.43195,
        title: '[작품명]',
        artist: '[작가 F]',
        support: '',
      },
    ],
  },
];

// 별자리 완성 보상: 이어진 이야기 전체 영상(카페에서 커피와 함께)
export const STORY = { title: '[이어진 이야기 · 별 헤는 밤]', duration: 300, src: '' };

// 운영 설정(브리프 13: 임의로 확정하지 말고 설정값으로)
export const CONFIG = {
  spotRadius: 40,     // m. GPS 스팟 반경(골목 오차 감안, 30~50)
  watchRatio: 0.8,    // 영상 80% 이상 보면 별
  couponTitle: '[원도심 로컬 카페 · 음료 할인]',
  couponValidDays: 14,
};

export const POINTS = SPOTS.flatMap((s) => s.points.map((p) => ({ ...p, spot: s })));
export const TOTAL_STARS = POINTS.length; // 6
export const pointById = (id) => POINTS.find((p) => p.id === id);
