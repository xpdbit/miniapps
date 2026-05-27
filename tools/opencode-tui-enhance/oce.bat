@echo off
setlocal

set BAT_DIR=%~dp0
set BAT_DIR=%BAT_DIR:~0,-1%

:: 将 src 加入 PYTHONPATH
set PYTHONPATH=%BAT_DIR%\src;%PYTHONPATH%

:: 无控制台启动：优先 pythonw（常见安装路径），回退 python
for %%p in (
    "D:\Program Files\Python\pythonw.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"
    "%ProgramFiles%\Python313\pythonw.exe"
    "C:\Python313\pythonw.exe"
) do (
    if exist "%%~p" (
        start "" "%%~p" -m opencode_tui_plus %*
        goto :wait_gui
    )
)

:: pythonw 未找到，回退 python（有控制台窗口）
where python >nul 2>nul
if not errorlevel 1 (
    python -m opencode_tui_plus %*
    goto :end
)

echo [oce] Python not found. Please install Python and try again.
pause
goto :end

:wait_gui
:: 等待 GUI 窗口出现（最多 15 秒），避免 CLI 立即退出造成"闪退"假象
powershell -NoProfile -Command ^
    "$sw=[Diagnostics.Stopwatch]::StartNew(); " ^
    "while ($sw.Elapsed.TotalSeconds -lt 15) { " ^
    "    $procs=Get-Process -Name pythonw -ErrorAction SilentlyContinue; " ^
    "    $found=$false; " ^
    "    foreach($p in $procs) { " ^
    "        try { if ($p.MainWindowHandle -ne 0 -and $p.MainWindowTitle -like '*oce*') { $found=$true; break } } catch {} " ^
    "    }; " ^
    "    if ($found) { exit 0 }; " ^
    "    Start-Sleep -Milliseconds 500 " ^
    "}" >nul 2>nul
goto :end

:end
endlocal
