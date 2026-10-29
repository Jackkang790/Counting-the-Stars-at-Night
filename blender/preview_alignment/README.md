# 임시 원격 에셋 뷰어

배포 URL: https://temiorae-alignment-test-20261029.lobo2u.chatgpt.site

Sites의 owner-private 페이지다. 해당 Site 소유자 ChatGPT 계정으로 로그인해야 한다. 자동 만료는 설정하지 않았으며 임시 테스트 용도로 별도 생성했다. WebXR/실건물 추적 기능이 아닌 GLB 검수 페이지다.

레이어 토글, 정면/사선 보기, 확대·회전, 불투명도 조절, 기준점 좌표 11개 조회, GLB 다운로드를 제공한다. 3D 로드와 주요 조작은 Chrome 로컬 미리보기에서 확인했고 원격 URL은 로그인 화면에 도달했다. 배포 성공은 Sites의 최종 상태로 확인했다.

`blender/scripts/package_alignment_preview.py`가 뷰어 소스와 기존 에셋, 고정 Three.js 모듈을 독립 Sites 프로젝트 `blender/.tools/alignment-remote-preview/`에 복사한다. 원격 프로젝트는 별도 Git 저장소이며 원본 에셋 브랜치/Claude 엔진 저장소와 분리된다. `.tools/`의 패키지·빌드·Git 정보는 바깥 에셋 브랜치에 커밋하지 않는다.

프로젝트 ID는 독립 프로젝트의 `.openai/hosting.json`과 `blender/reports/alignment_deployment.json`에 보존한다. 재배포 시 기존 ID를 재사용하고 새 Site를 만들지 않는다. 인증 토큰은 파일에 기록하지 않는다.

재배포는 Sites 스킬의 소스 동기화·패키징·버전 저장·private 배포 절차를 사용한다. 기존 archive를 다른 commit과 혼용하지 않는다. 공유 루트나 `ar-engine/`에는 새 파일을 복사하지 않는다.
