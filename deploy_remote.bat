@echo off
chcp 65001 >nul
title mnapp.top 部署与修复工具
color 0F

:menu
cls
echo =============================================
echo  mnapp.top 部署与修复工具
echo =============================================
echo.
echo  服务器 IP: 47.94.108.150
echo  当前状态: HTTPS 域名被阿里云备案(ICP)阻断
echo.
echo  [1] DevTools 测试（已构建 IP 直连版，可直接在开发者工具中运行）
echo  [2] 部署 Dashboard + SSL 自动配置
echo  [3] 恢复模式（容器全部停止后恢复）
echo  [4] SSL 一键修复（先确保已完成 ICP 备案）
echo  [5] 复制最新配置文件到服务器
echo.
echo  [Q] 退出
echo.
set /p choice="请选择 (1/2/3/4/5/Q): "

if "%choice%"=="1" goto devtools
if "%choice%"=="2" goto deploy
if "%choice%"=="3" goto recover
if "%choice%"=="4" goto sslfix
if "%choice%"=="5" goto copyconfig
if /i "%choice%"=="Q" exit /b

goto menu

:devtools
cls
echo =============================================
echo  DevTools 测试说明
echo =============================================
echo.
echo  已构建 IP 直连版本（无需 ICP 备案即可测试）
echo.
echo  操作步骤：
echo    1. 打开微信开发者工具
echo    2. 导入项目（目录: apps/ftg-miniapp）
echo    3. 确保「详情」→「本地设置」中：
echo       - 不校验合法域名、TLS 版本及 HTTPS 证书 ☑
echo    4. 点击编译/预览
echo.
echo  API 地址: https://47.94.108.150/api/v1
echo.
echo  注意：
echo  - 此版本仅限本地开发测试
echo  - 生产上传前需要切换到域名版本
echo.
pause
goto menu

:deploy
cls
echo =============================================
echo  部署 Dashboard + SSL 自动配置
echo =============================================
echo.
echo  步骤 1: 复制最新配置到服务器（含 setup-ssl.sh）
echo  步骤 2: 构建 Dashboard 并重启容器
echo  步骤 3: 自动检测并配置 SSL 证书
echo.
set /p confirm="确认继续? (Y/N): "
if /i not "%confirm%"=="Y" goto menu

echo.
echo 执行部署...
ssh -o StrictHostKeyChecking=no root@47.94.108.150 "bash -s" < deploy_commands.sh
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 部署失败！请检查 SSH 连接。
    pause
    goto menu
)
echo.
echo 部署完成！
pause
goto menu

:recover
cls
echo =============================================
echo  恢复模式
echo =============================================
echo.
echo  用于服务器 Docker 容器全部停止后的恢复。
echo.
set /p confirm="确认继续? (Y/N): "
if /i not "%confirm%"=="Y" goto menu

ssh -o StrictHostKeyChecking=no root@47.94.108.150 "bash -s" < recover_and_deploy.sh
pause
goto menu

:sslfx
cls
echo =============================================
echo  SSL 一键修复
echo =============================================
echo.
echo  前置条件：
echo    1. ICP 备案已完成并生效
echo    2. 阿里云 AccessKey 有 AliyunDNSFullAccess 权限
echo.
echo  执行内容：
echo    - 通过 acme.sh + 阿里云 DNS-01 获取 Let's Encrypt 证书
echo    - 安装到 Nginx 并重启
echo    - 配置自动续期
echo.
set /p confirm="确认继续? (Y/N): "
if /i not "%confirm%"=="Y" goto menu

ssh -o StrictHostKeyChecking=no root@47.94.108.150 "bash /opt/ftg/deploy/scripts/setup-ssl.sh"
echo.
echo SSL 配置完成！
echo 验证: curl -I https://mnapp.top/api/ftl/health
pause
goto menu

:copyconfig
cls
echo =============================================
echo  复制配置文件到服务器
echo =============================================
echo.
echo  将本地 deploy/ 目录下的最新配置复制到服务器...
echo.

set DEPLOY_DIR=E:\.Code\.miniapps\deploy

echo  [1] 部署脚本
echo  [2] Nginx 配置与证书
echo  [3] SSL 配置脚本 + 阿里云凭证
echo  [4] 全部
echo.
set /p cfgChoice="请选择 (1/2/3/4): "

set SCP_TARGET=root@47.94.108.150:/opt/ftg/deploy/

if "%cfgChoice%"=="1" (
    echo 复制部署脚本...
    scp "%DEPLOY_DIR%\scripts\deploy.sh" root@47.94.108.150:/opt/ftg/deploy/scripts/
    scp "%DEPLOY_DIR%\scripts\setup-ssl.sh" root@47.94.108.150:/opt/ftg/deploy/scripts/
    goto copy_done
)
if "%cfgChoice%"=="2" (
    echo 复制 Nginx 配置...
    scp "%DEPLOY_DIR%\nginx\nginx.conf" root@47.94.108.150:/opt/ftg/deploy/nginx/
    scp "%DEPLOY_DIR%\nginx\entrypoint.sh" root@47.94.108.150:/opt/ftg/deploy/nginx/
    goto copy_done
)
if "%cfgChoice%"=="3" (
    echo 复制 SSL 配置和阿里云凭证...
    scp "%DEPLOY_DIR%\scripts\setup-ssl.sh" root@47.94.108.150:/opt/ftg/deploy/scripts/
    scp "%DEPLOY_DIR%\nginx\aliyun-credentials.ini" root@47.94.108.150:/opt/ftg/deploy/nginx/
    goto copy_done
)
if "%cfgChoice%"=="4" (
    echo 复制全部配置...
    scp "%DEPLOY_DIR%\nginx\nginx.conf" root@47.94.108.150:/opt/ftg/deploy/nginx/
    scp "%DEPLOY_DIR%\nginx\entrypoint.sh" root@47.94.108.150:/opt/ftg/deploy/nginx/
    scp "%DEPLOY_DIR%\scripts\setup-ssl.sh" root@47.94.108.150:/opt/ftg/deploy/scripts/
    scp "%DEPLOY_DIR%\scripts\deploy.sh" root@47.94.108.150:/opt/ftg/deploy/scripts/
    scp "%DEPLOY_DIR%\nginx\aliyun-credentials.ini" root@47.94.108.150:/opt/ftg/deploy/nginx/
    scp "%DEPLOY_DIR%\.env" root@47.94.108.150:/opt/ftg/deploy/
    goto copy_done
)
goto menu

:copy_done
if %ERRORLEVEL% EQU 0 (
    echo.
    echo 复制完成！
) else (
    echo.
    echo 复制失败！请检查 SSH 连接和路径。
    echo 可能需要在服务器先创建目录：
    echo   ssh root@47.94.108.150 "mkdir -p /opt/ftg/deploy/scripts /opt/ftg/deploy/nginx"
)
pause
goto menu
