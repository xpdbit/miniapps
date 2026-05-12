@echo off
cd /d "%~dp0"
python gui\main.py
if not "%~1"=="" pause
