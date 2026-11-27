@echo off
title Laurena Builder - Dev :2020
cd /d "%~dp0"
echo Starting Laurena Builder on http://localhost:2020 ...
npm run dev -- -p 2020
pause
