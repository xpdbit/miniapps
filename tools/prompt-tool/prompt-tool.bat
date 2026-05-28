@echo off
setlocal

set BAT_DIR=%~dp0
set BAT_DIR=%BAT_DIR:~0,-1%

:: 将 src 加入 PYTHONPATH
set PYTHONPATH=%BAT_DIR%\src;%PYTHONPATH%

:: 优先级1: pythonw — 无控制台窗口（PATH 发现）
where pythonw >nul 2>nul
if not errorlevel 1 (
    start "" pythonw -m prompt_tool %*
    goto :end
)

:: 优先级2: pythonw — 已知安装路径
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"
    "D:\Program Files\Python\pythonw.exe"
    "%ProgramFiles%\Python313\pythonw.exe"
    "C:\Python313\pythonw.exe"
) do (
    if exist "%%~p" (
        start "" "%%~p" -m prompt_tool %*
        goto :end
    )
)

:: 优先级3: py 启动器 — PowerShell 隐藏窗口
where py >nul 2>nul
if not errorlevel 1 (
    powershell -WindowStyle Hidden -NoProfile -Command "Start-Process py -ArgumentList '-3','-m','prompt_tool' -WindowStyle Hidden"
    goto :end
)

:: 优先级4: python — 有控制台窗口（最终回退）
where python >nul 2>nul
if not errorlevel 1 (
    start /B python -m prompt_tool %*
)

:end
endlocal
