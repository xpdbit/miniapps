@echo off
python "%~dp0local_server\local_dev.py"
if %ERRORLEVEL% NEQ 0 pause
