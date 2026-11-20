@echo off
cd /d "%~dp0backend"
call npm ci
if errorlevel 1 exit /b 1
call npm run seed
if errorlevel 1 exit /b 1
call npm start
