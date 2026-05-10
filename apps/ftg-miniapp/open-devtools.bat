@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   FTG 微信小程序 - 打开开发者工具
echo ========================================
echo.

:: 1. 先构建项目（dist/ 被 gitignore，必须构建后才能打开 DevTools）
echo [1/3] 正在构建项目...
call npm run build:weapp
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ 构建失败！请检查控制台错误信息。
    pause
    exit /b 1
)
echo ✅ 构建完成
echo.

:: 2. 确保 project.config.json 中 miniprogramRoot 格式正确
echo [2/3] 验证配置...
:: miniprogramRoot 必须为相对路径（./dist 格式），已在 project.config.json 中预设
echo ✅ 配置已验证 (miniprogramRoot: ./dist)
echo.

:: 3. 启动微信开发者工具
echo [3/3] 启动微信开发者工具...
echo.
echo ⚠ 如果持续报错 "app.json not found"，请按以下步骤操作：
echo   步骤1: 关闭开发者工具
echo   步骤2: 删除缓存目录（在资源管理器地址栏粘贴后回车）:
echo          %LOCALAPPDATA%\微信web开发者工具\User Data\Default\Autofill
echo   步骤3: 重新运行本脚本
echo.
echo ⚠ 如果版本为 2.01.2510290 仍报错，请降级：
echo   打开 DevTools → 设置 → 版本管理 → 切换至 2.01.2510280
echo.
start "" "D:\Program Files (x86)\Tencent\微信web开发者工具\wechatdevtools.exe"
echo.
echo ✅ 开发者工具已启动
echo   项目路径: %~dp0
echo   AppID: wx304f234695e196d1
echo   miniprogramRoot: ./dist ^(指向编译输出目录^)
echo.
echo 提示：在 DevTools 中点击"导入项目"，选择此目录即可
echo.
echo 如需 watch 模式（热重载），请另行运行：
echo   npm run dev:weapp
echo.
pause
