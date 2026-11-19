@echo off
cd /d "%~dp0"
echo Starting Kampala Community Clinic...
echo MongoDB must already be running on localhost:27017.
call npm start
if errorlevel 1 pause
