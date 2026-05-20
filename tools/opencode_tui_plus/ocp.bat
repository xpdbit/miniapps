@echo off
chcp 936 >nul
setlocal enabledelayedexpansion

:: ============================================
:: ocp.bat - opencode TUI Plus 启动器
:: 用于直接双击或在命令行中运行 ocp
:: 编码：CP936 (GBK) - 确保中文在 cmd 中正常显示
:: ============================================

:: 获取当前脚本所在目录（支持带空格的路径）
set "BAT_DIR=%~dp0"
set "BAT_DIR=%BAT_DIR:~0,-1%"

:: 设置 Python 环境变量，确保 UTF-8 输出在终端正确显示
set PYTHONIOENCODING=utf-8

:: 运行 ocp
python -m opencode_tui_plus %*
if not errorlevel 1 goto :end

:: 如果启动失败（python 不在 PATH），尝试常见安装路径
echo [ocp] 未找到 python，尝试常见安装路径...
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "%ProgramFiles%\Python313\python.exe"
) do (
    if exist "%%~p" (
        "%%~p" -m opencode_tui_plus %*
        goto :end
    )
)
echo [ocp] 错误：找不到 Python，请确保已安装并加入 PATH。
echo [ocp] 安装后可直接运行：pip install -r "%~dp0requirements.txt"
pause

:end
endlocal
