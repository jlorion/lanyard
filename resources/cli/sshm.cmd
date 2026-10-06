@echo off
rem sshm CLI shim for the installed Windows app (resources\cli\sshm.cmd).
rem Runs the bundled CLI with the app's own Electron binary in Node mode,
rem so no separate Node.js install is needed. Add this folder to PATH.
setlocal
set "SSHM_APP_EXE=%~dp0..\..\SSH Manager.exe"
set "ELECTRON_RUN_AS_NODE=1"
"%SSHM_APP_EXE%" "%~dp0..\app.asar\bin\sshm.js" %*
exit /b %ERRORLEVEL%
