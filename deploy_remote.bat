@echo off
chcp 65001 >nul
echo ==========================================
echo  FTG Dashboard 远程部署脚本
echo ==========================================
echo.
echo [1] 正常部署（构建 + 推送 + 重启容器）
echo [2] 恢复模式（服务器容器全部停止后恢复）
echo.
set /p choice="请选择 (1/2): "

if "%choice%"=="1" (
    echo.
    echo 执行正常部署...
    ssh -o StrictHostKeyChecking=no root@47.94.108.150 "bash -s" < deploy_commands.sh
)
if "%choice%"=="2" (
    echo.
    echo 执行恢复部署...
    ssh -o StrictHostKeyChecking=no root@47.94.108.150 "bash -s" < recover_and_deploy.sh
)

echo.
echo ==========================================
echo  部署完成! 访问 https://47.94.108.150/
echo  默认管理员: admin / Admin123!
echo ==========================================
pause
