@echo off
rem lanyard CLI shim for the installed Windows app (resources\cli\lanyard.cmd).
rem Runs the bundled CLI with the app's own Electron binary in Node mode,
rem so no separate Node.js install is needed. Add this folder to PATH.
setlocal
set "LANYARD_APP_EXE=%~dp0..\..\Lanyard.exe"
set "ELECTRON_RUN_AS_NODE=1"
"%LANYARD_APP_EXE%" "%~dp0..\app.asar\bin\lanyard.js" %*
exit /b %ERRORLEVEL%
