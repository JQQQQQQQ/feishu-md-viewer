@echo off
setlocal

rem Windows 一键入口：构建并刷新当前 Chrome 中的 Feishu MD Viewer。
node "%~dp0reload-extension.mjs" %*
exit /b %ERRORLEVEL%
