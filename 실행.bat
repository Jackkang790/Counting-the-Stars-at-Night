@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 별 헤는 밤 - 개발 서버 시작 (창을 닫으면 꺼집니다)
node node_modules\vite\bin\vite.js --port 5173 --open
pause
