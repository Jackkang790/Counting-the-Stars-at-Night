// 스타일 묶음 — 화면별 CSS 를 순서대로 불러옴(공통 → 화면 번호 순, 뒤 파일이 같은 세기 규칙을 이김).
// CSS 안의 @import 대신 여기서 불러옴: 개발 서버가 새 CSS 파일을 바로 찾고, 경로 문제(윈도우)가 없음.
import './base.css';
import './pause.css';
import './home.css';
import './map.css';
import './ar.css';
import './artwork.css';
import './stage.css';
import './sheet.css';
import './roleplay.css';
import './escape.css';
import './stamps.css';
import './coupons.css';
import './stores.css';
import './integration.css';
