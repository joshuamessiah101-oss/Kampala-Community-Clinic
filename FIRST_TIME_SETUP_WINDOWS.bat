@echo off
setlocal
cd /d "%~dp0"
echo.
echo =============================================
echo  KAMPALA COMMUNITY CLINIC - FIRST TIME SETUP
 echo =============================================
echo MongoDB must already be running on localhost:27017.
echo.
call npm install
if errorlevel 1 goto fail
call npm run setup:admin
if errorlevel 1 goto fail
call npm run seed
if errorlevel 1 goto fail
call npm test
if errorlevel 1 goto fail
call npm start
if errorlevel 1 goto fail
goto end
:fail
echo.
echo Setup stopped. Read README.md or the error message above.
pause
:end
endlocal
