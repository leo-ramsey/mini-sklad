@echo off
rem Mini-sklad: double-click to start. Close this window to stop the site.
chcp 65001 >nul
cd /d "%~dp0"

rem Node.js: from PATH, or from the standard install folder (right after install PATH may be stale).
set "NODE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE=%ProgramFiles%\nodejs\node.exe"
if not "%NODE%"=="node" if not exist "%NODE%" (
  echo Node.js не найден. Установите его с https://nodejs.org ^(кнопка LTS^) и запустите этот файл снова.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Создан файл .env. Впишите в него пароли, сохраните ^(Ctrl+S^) и закройте Блокнот.
  notepad ".env"
)

echo Запускаю Мини-склад... Сайт: http://localhost:8000
echo Чтобы остановить сайт, закройте это окно.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
"%NODE%" --env-file-if-exists=.env server.mjs
pause
