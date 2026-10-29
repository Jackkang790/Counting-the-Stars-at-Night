# 배포 가이드 — 테미오래 WebAR 테스트 사이트

> 빌드 산출물 `ar-engine/dist/` 는 **자립적(self-contained)** 입니다.
> 두 GLB(별의 새싹·외벽 정합)와 매니페스트가 모두 포함되며, Codex worktree 경로에
> 의존하지 않습니다. (에셋은 빌드 시 `scripts/stage-assets.mjs` 가 `feature/blender-assets`
> git ref 에서 가져옵니다.)

## 재현 가능한 빌드

```powershell
cd Z:\sjb\Counting-the-Stars-at-Night\ar-engine
# 사전: Codex 에셋 브랜치를 받아둔다(스테이징 소스)
git fetch origin feature/blender-assets
npm ci            # 또는 npm install
npm run build     # prebuild가 에셋 스테이징 → dist/ 생성
```
빌드 후 확인:
```
dist/index.html
dist/models/starseed_sculpture.glb
dist/models/alignment_test_facade.glb
dist/models/alignment_test_facade.manifest.json
dist/models/asset-manifest.json  + starseed_sculpture.manifest.json
```

### 도메인 루트 vs 서브경로
- 엔진은 모델 URL을 **base 기준으로 해석**합니다(`import.meta.env.BASE_URL`).
- **도메인 루트**(예: `https−//xxx.netlify.app/`) 배포: 기본값(`AR_BASE=/`)으로 빌드.
- **서브경로**(예: GitHub Pages 프로젝트 사이트 `https://user.github.io/REPO/`) 배포:
  PowerShell에서 `$env:AR_BASE='/REPO/'; npm run build` 로 빌드.

## 요구사항 충족
- **HTTPS**: 아래 모든 호스트가 자동 HTTPS 제공(WebXR 필수 조건).
- **정적 GLB/매니페스트**: `dist/models/` 로 포함(HTTP 200 확인은 아래).
- WebXR/ARCore/카메라 권한 안내: 사이트 내 `checkSupport`·진단·오류 배너로 처리.
- 모바일 세로 대응: 구현됨.

## 배포 옵션 비교 (이 PC 환경 기준)

| 방법 | 계정/로그인 | HTTPS | 루트 도메인 | 접근제어 | 비고 |
| --- | --- | --- | --- | --- | --- |
| **Netlify Drop** | 불필요(끌어다 놓기) | ✅ | ✅ 루트 | 유료(암호)·또는 비공개 URL | **가장 빠름**, 저장소 변경 없음 |
| **GitHub Pages** | gh 로그인됨(Lobo2u) | ✅ | 서브경로 | 공개만(무료) | git 연동, `AR_BASE` 필요 |
| Cloudflare Pages | 로그인 필요 | ✅ | ✅ 루트 | Cloudflare Access | wrangler 미설치 |
| Vercel | **토큰 무효**(재로그인 필요) | ✅ | ✅ 루트 | 유료(암호) | `vercel login` 필요 |

> 현재 이 PC에서 **인증된 배포 수단은 `gh`(GitHub) 뿐**이고, Vercel 토큰은 무효입니다.
> Netlify Drop은 계정 없이 즉시 가능(수동 업로드).

### 권장 A — Netlify Drop (가장 빠름, 저장소 변경 없음)
1. `npm run build` (루트 base).
2. 브라우저에서 <https://app.netlify.com/drop> 열기.
3. `ar-engine/dist/` 폴더를 통째로 드래그 앤 드롭.
4. 생성된 `https://<무작위>.netlify.app` URL을 폰에서 열기(루트 도메인이라 base 변경 불필요).
5. 접근 제어가 필요하면 Netlify 사이트 설정에서 비밀번호(유료) 또는 비공개 URL 공유.

### 권장 B — GitHub Pages (git 연동, gh 로그인 사용)
> 프로젝트 사이트는 `https://<owner>.github.io/<repo>/` **서브경로**로 서빙됩니다.
> 저장소는 `Jackkang790/Counting-the-Stars-at-Night`(내 소유 아님) → **푸시/공개 발행은 사용자 승인 필요**.
1. 서브경로 base로 빌드:
   ```powershell
   $env:AR_BASE='/Counting-the-Stars-at-Night/'; npm run build
   ```
2. `dist/` 를 `gh-pages` 브랜치로 발행(예: `git worktree` 또는 `gh`/`git subtree`). 또는
   `.github/workflows/`에 Actions 워크플로를 두어 자동 빌드·배포(`actions/deploy-pages`).
3. 저장소 Settings → Pages → Source를 `gh-pages`(또는 Actions)로 설정.
4. `https://jackkang790.github.io/Counting-the-Stars-at-Night/` 를 폰에서 열기.

> GitHub Pages 무료 플랜은 **공개** URL입니다(로그인 없이 링크 공유 — 요구사항의
> "로그인 없이 공유" 에 부합). 접근 제어가 꼭 필요하면 Netlify/Cloudflare 암호 보호 사용.

## 배포 후 확인(필수)
폰 Chrome에서 배포 URL 접속 → **DEVICE-TEST.md** 절차대로:
- 에셋 HTTP 200: `.../models/starseed_sculpture.glb`, `.../models/alignment_test_facade.glb`
- "● AR 지원" → 별의 새싹/외벽 정합 각각 실행.

## 현재 상태
- ✅ 자립 빌드·로컬 정적 서버 검증(두 GLB HTTP 200) 완료.
- ⏳ **공개 배포는 미완료** — 실제 발행(제3자 저장소 push/공개)은 사용자 승인 후 진행.
  Netlify Drop은 사용자가 직접 `dist/` 업로드로 즉시 가능.
