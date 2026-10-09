@echo off
title Fuzail Ahmed - 3D Portfolio
cd /d "%~dp0"
where python >nul 2>nul && (python serve.py 8080 & goto :eof)
where py >nul 2>nul && (py serve.py 8080 & goto :eof)
echo Python was not found. Install Python 3 or run: npx serve -l 8080
pause
