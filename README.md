# 별 헤는 밤 — 프론트엔드

대전 원도심 근대건축 AR 야간 투어 (모바일 웹, React + Vite + three).
기획·화면·규칙은 `CLAUDE.md`, 서버 약속은 `docs/API.md`.

```
npm i
npm run dev        # 개발
npm run build      # 배포용 dist/
```

폰 시연(안드로이드 크롬, WebXR): `npm run build && npx vite preview --port 4173` → `adb reverse tcp:4173 tcp:4173` → 폰에서 `localhost:4173`.
서버 주소는 `.env` 의 `VITE_API_URL` (`.env.example` 참고). 없으면 예시 데이터로 동작.

백엔드 연동(Rest-Backend v0.1.0):
1. 백엔드 저장소 루트에서 `python -m uvicorn app.demo:app --app-dir backend --port 8000`
2. 이 폴더에 `.env` → `VITE_API_URL=http://localhost:8000` 후 `npm run dev` (5173 은 백엔드 CORS 기본 허용)
3. 서버 호출·응답 변환은 `src/lib/api.js` 한 곳에 있음 (session_id · 건물 h1/h2/h3 ↔ a/b/c · 체크인+완료)
