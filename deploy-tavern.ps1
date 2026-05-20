# =============================================================================
# AI Tavern 一键部署修复脚本
# 修复 502 Bad Gateway：路径别名 + 数据库 + Nginx + 环境变量
# 使用方法：在 PowerShell 中运行 .\deploy-tavern.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$SERVER = "root@mnapp.top"
$REPO = "E:\.Code\.miniapps"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " AI Tavern 一键部署修复" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: 复制 tavern-server 修复后的源码
Write-Host "`n[1/6] 复制 tavern-server 源码到服务器..." -ForegroundColor Yellow
scp -r "$REPO\apps\tavern\server\src" "${SERVER}:/opt/ftg/apps/tavern/server/"
if ($LASTEXITCODE -ne 0) { throw "SCP src failed" }
scp -r "$REPO\apps\tavern\server\prisma" "${SERVER}:/opt/ftg/apps/tavern/server/"
scp "$REPO\apps\tavern\server\tsconfig.json" "${SERVER}:/opt/ftg/apps/tavern/server/"
scp "$REPO\apps\tavern\server\package.json" "${SERVER}:/opt/ftg/apps/tavern/server/"
Write-Host "  ✅ 源码复制完成" -ForegroundColor Green

# Step 2: 复制 Nginx 配置
Write-Host "`n[2/6] 复制 Nginx 配置..." -ForegroundColor Yellow
scp "$REPO\deploy\nginx\nginx.conf" "${SERVER}:/opt/ftg/deploy/nginx/"
Write-Host "  ✅ Nginx 配置复制完成" -ForegroundColor Green

# Step 3: 复制环境变量
Write-Host "`n[3/6] 复制环境变量..." -ForegroundColor Yellow
scp "$REPO\deploy\.env" "${SERVER}:/opt/ftg/deploy/"
Write-Host "  ✅ .env 复制完成" -ForegroundColor Green

# Step 4: 复制部署脚本
Write-Host "`n[4/6] 复制部署脚本..." -ForegroundColor Yellow
scp "$REPO\deploy\scripts\deploy-tavern.sh" "${SERVER}:/opt/ftg/deploy/scripts/"
scp "$REPO\deploy\scripts\deploy.sh" "${SERVER}:/opt/ftg/deploy/scripts/"
scp "$REPO\deploy_commands.sh" "${SERVER}:/opt/ftg/"
scp "$REPO\recover_and_deploy.sh" "${SERVER}:/opt/ftg/"
Write-Host "  ✅ 脚本复制完成" -ForegroundColor Green

# Step 5: SSH 执行一键修复
Write-Host "`n[5/6] SSH 执行一键修复..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no $SERVER "bash /opt/ftg/deploy/scripts/deploy-tavern.sh" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  SSH 执行可能有问题，请检查服务器" -ForegroundColor Yellow
}
Write-Host "  ✅ 修复脚本执行完成" -ForegroundColor Green

# Step 6: 验证
Write-Host "`n[6/6] 验证修复结果..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host " 验证 API 端点:" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Cyan

$endpoints = @(
    "https://mnapp.top/api/tavern/health",
    "https://mnapp.top/api/tavern/api/v1/market/featured",
    "https://mnapp.top/api/tavern/api/v1/market/tags",
    "https://mnapp.top/api/tavern/api/v1/market?page=1&pageSize=20&sort=latest"
)

foreach ($url in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        $status = $response.StatusCode
        $emoji = if ($status -eq 200) { "✅" } else { "❌" }
        Write-Host "  $emoji $url → $status" -ForegroundColor $(if ($status -eq 200) { "Green" } else { "Red" })
    }
    catch {
        Write-Host "  ❌ $url → $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
