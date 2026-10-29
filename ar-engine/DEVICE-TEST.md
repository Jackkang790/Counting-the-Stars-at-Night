# Android Chrome 실기기 테스트 체크리스트

> 목적: AR 세션·Hit Test·GLB 로딩·애니메이션·배치 안정성을 **실제 스마트폰**에서 점검.
> 각 항목을 체크하고 결과를 기록하세요. **실기기 통과 전에는 어떤 항목도 "완료"가 아닙니다.**
> 진단 데이터: 화면 상단 **텔레메트리 HUD** + `chrome://inspect` 콘솔 로그(`[ar-engine] …`, `[AR 진단 …]`).

## 0. 사전 준비 (PC)
- [ ] `cd ar-engine && npm install && npm run dev`
- [ ] 출력에서 **Wi-Fi LAN IP** 확인 (가상 어댑터(192.168.x VMware/Docker 등) 말고
      폰과 같은 Wi-Fi 대역). 예: `https://172.16.42.83:5173/`
- [ ] 방화벽에서 5173 인바운드(사설 네트워크) 허용

## 1. 접속 · HTTPS · Secure Context
- [ ] 폰과 PC가 **같은 Wi-Fi**
- [ ] 폰 Chrome에서 `https://<PC-LAN-IP>:5173` 접속
- [ ] 자체 서명 인증서 경고 → **고급 → 계속 진행**
- [ ] 페이지 상단 지원줄에 **secure=true** 표시
  - 실패 시: HTTP로 접속했는지 확인. **대안**: USB 연결 + `chrome://inspect` Port forwarding →
    폰에서 `https://localhost:5173`(localhost는 secure context로 인정, 인증서 경고 없음)
- 결과: ___________________

## 2. AR 지원 감지
- [ ] 상단에 **"● AR 지원"** 표시 (미지원이면 안내 문구 확인)
- [ ] **[환경 진단 로그]** 탭 → `xr=true immersive-ar=true secure=true webgl=true`
  - `immersive-ar=false`: ARCore("Google Play 서비스(AR)") 설치/업데이트, 최신 Chrome 확인
  - `iOS`: Safari는 WebXR AR 미지원(정상적으로 안내됨)
- 결과: ___________________

## 3. AR 세션 시작
- [ ] **[AR 시작]** → 카메라 권한 **허용**
- [ ] 카메라 화면 전환 + 상단 **텔레메트리 HUD** 표시(`fps … | searching | …`)
- [ ] 로그에 `▶ sessionStarted`
  - 실패 시: 로그/콘솔의 `세션 시작 실패 [code]` 및 `[AR 진단]` 블록 기록
- 결과(fps 대략): ___________________

## 4. Hit Test (바닥 인식)
- [ ] 바닥(텍스처 있는 바닥 권장)을 **천천히** 비춤
- [ ] **레티클(링)** 표시, HUD가 `searching → reticle`로 전환
- [ ] 콘솔 `hit-test 바닥 인식됨 ✓`
  - 인식 안 됨: 조명/바닥 패턴 개선, 기기를 좌우로 천천히 이동
- 결과: ___________________

## 5. GLB 로딩 (실제 Codex 에셋)
- [ ] 로그 `✓ ready — Codex GLB 로드됨: /models/starseed_sculpture.glb`
- [ ] `clips=[Emerge, Idle, Disappear]`
- [ ] 로드 상태줄이 **"Codex GLB"**(임시 모델 아님)
  - 임시 모델로 뜨면: 네트워크/경로 문제 → 콘솔의 GLB 로드 오류 확인
- 결과: ___________________

## 6. 배치 + 애니메이션 (Emerge → Idle → Disappear)
- [ ] 레티클 위치에서 화면 **탭** → 작품 배치(HUD `placed`)
- [ ] **Emerge**: 땅에서 솟아오름(HUD `phase emerging` → `idle`)
- [ ] **Idle**: 미세 좌우 흔들림 지속
- [ ] 작품 **탭** → 강조 펄스 + 로그 `hotspotSelected`
- [ ] **[작품 퇴장(Disappear)]** → 축소되며 사라짐(HUD `phase disappearing`)
- [ ] 퇴장 후 바닥 **탭** → 재배치·재등장
- 결과: ___________________

## 7. 배치 안정성 (드리프트/트래킹)
- [ ] 배치 후 **기기를 들고 이동**해도 작품이 **같은 실제 위치**에 머무름
- [ ] HUD `track ok` 유지(간헐 `LOST`면 빈도 기록), `anchor(x,y,z)` 값이 급변하지 않음
- [ ] 로그에 `trackingLost`가 과도하게 반복되지 않음
- 결과(이동 시 흔들림 정도): ___________________

## 8. 종료
- [ ] **[AR 종료]** → 로그 `■ sessionEnded`, 초기 화면 복귀

---

## 실패 보고 양식 (실패 시 이 정보를 공유해 주세요)
- 기기 모델 / Android 버전 / Chrome 버전:
- 실패 단계(위 번호):
- 화면 HUD 내용:
- `chrome://inspect` 콘솔의 `[ar-engine]` / `[AR 진단]` 로그:
- 증상 설명(스크린샷/영상 있으면 첨부):

> 위 정보로 원인 분석 후 **엔진 측에서** 수정합니다(Codex 에셋·타 작업자 파일 미수정).
