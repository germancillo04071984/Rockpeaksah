@echo off
title Industrias Rockpeaks - Puente de Windows
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0RockpeaksBridgeWindows.ps1"
if errorlevel 1 (
  echo.
  echo Ha ocurrido un error. Revisa el mensaje anterior.
  pause
)
