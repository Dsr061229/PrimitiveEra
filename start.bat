@echo off
REM 原始纪元 · 一键启动（可选，直接双击 index.html 也能玩）
REM 手机试玩：确保手机与电脑同一 WiFi，浏览器访问 http://<电脑IP>:8080
cd /d "%~dp0"
where npx >nul 2>nul
if %errorlevel%==0 (
  start http://localhost:8080
  npx -y http-server -p 8080 -c-1
) else (
  echo 未检测到 Node.js，直接为你打开 index.html ...
  start index.html
)
