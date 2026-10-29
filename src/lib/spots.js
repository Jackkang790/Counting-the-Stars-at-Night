// 원도심 스팟 3곳 · 별 6개(스팟마다 2개, 별마다 방법 하나 — houses/h*.js missions) (와이어프레임 01~11)
// 스팟 1 소제동 관사 16호 · 스팟 2 소제점방(소제동) · 스팟 3 헤레디움(인동). 지도 사진은 스팟마다 하나(src/assets/spots/).
// 건물 데이터는 src/houses/ (건물마다 파일 하나), 미션(역할극 · 단서 얻기) 목록은 src/lib/missions.js.
// 스팟 1 · 2 = 역할극 + 별자리 퍼즐(단서 얻기) · 스팟 3 헤레디움 = 역할극 없음, 전시 보기(전시 건축물이 땅에서 솟아오름) + 별자리 퍼즐. 다 모으면 → 이어진 이야기 영상 + 작가 엽서 + 카페 쿠폰(서버 발급).
//
// TODO(운영): 세 곳 야간 사용(건물 앞 AR·담장) 협조 확인 필요.
// TODO(인식): 03 도착 확인은 지금 시간 지나면 인식됨. 실제는 건물 이미지 마커로 교체.
import { HOUSES, houseById } from '../houses/index.js';
import { MISSIONS, missionsOf } from './missions.js';

export { HOUSES, houseById, MISSIONS, missionsOf };

// 운영 설정(임의로 확정하지 말고 설정값으로)
export const CONFIG = {
  radius: 40,          // m. 건물 반경(골목 GPS 오차 감안, 30~50)
  couponTitle: '[원도심 로컬 카페 · 음료 할인]',
  couponValidDays: 14,
  rounds: 3,           // 쿠폰 최대 3번: 별 6개 완성 = 1회차. 다음 회차는 별자리 배정이 바뀜
  clueEvery: 10,       // 초. 07 실마리 자물쇠가 하나씩 풀리는 간격(10초 · 20초 · 30초)
  escapeMinutes: 15,   // 07 제한 시간 기본값(건물 escape.minutes 가 있으면 그 값)
  mapZoom: 1.7,        // 02 지도에서 도착한 스팟으로 옮겨갈 때 확대 배율
};

export const TOTAL_STAMPS = HOUSES.reduce((n, h) => n + h.missions.length, 0); // 6
// 별로 셀 수 있는 도장 id 전부(스팟마다 그 스팟 미션만)
export const STAR_IDS = HOUSES.flatMap((h) => h.missions.map((k) => `${h.id}:${k}`));
// 도장 id = "건물:종류" (서버엔 point_id 로 보냄)
export const stampId = (houseId, kind) => `${houseId}:${kind}`;
