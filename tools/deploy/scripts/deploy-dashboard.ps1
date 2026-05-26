# =============================================================================
# Dashboard 部署脚本 — 本地构建 → SCP 到服务器
# 用于将本地构建的 Dashboard SPA 文件部署到 ECS 服务器
# =============================================================================
# 使用方法：
#   在 PowerShell 中运行 .\deploy-dashboard.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$SERVER = "root@mnapp.top"
$REPO_ROOT = "E:\.Code\.miniapps"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Dashboard SPA 部署" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: 本地构建 Dashboard
Write-Host "`n[1/4] 本地构建 Dashboard..." -ForegroundColor Yellow
Set-Location "$REPO_ROOT\dashboard"
npm run build 2>&1
if ($LASTEXITCODE -ne 0) { throw "Dashboard 构建失败" }
Write-Host "  ✅ 构建完成" -ForegroundColor Green

# Step 2: 复制到本地 tools/deploy 目录（供提交到仓库）
Write-Host "`n[2/4] 复制到 tools/deploy/nginx/html/..." -ForegroundColor Yellow
if (Test-Path "$REPO_ROOT\tools\deploy\nginx\html") {
    Remove-Item -Recurse -Force "$REPO_ROOT\tools\deploy\nginx\html\*" -ErrorAction SilentlyContinue
}
Copy-Item -Recurse -Path "$REPO_ROOT\dashboard\dist\*" -Destination "$REPO_ROOT\tools\deploy\nginx\html"
$FILE_COUNT = (Get-ChildItem -Recurse "$REPO_ROOT\tools\deploy\nginx\html" -File).Count
Write-Host "  ✅ 复制完成，共 $FILE_COUNT 个文件" -ForegroundColor Green

# Step 3: SCP 到服务器
Write-Host "`n[3/4] SCP 到服务器 ${SERVER}..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no $SERVER "mkdir -p /opt/ftg/deploy/nginx/html"
scp -r "$REPO_ROOT\tools\deploy\nginx\html\*" "${SERVER}:/opt/ftg/deploy/nginx/html/"
if ($LASTEXITCODE -ne 0) { throw "SCP 失败" }
Write-Host "  ✅ SCP 完成" -ForegroundColor Green

# Step 4: 验证
Write-Host "`n[4/4] 验证部署..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host " 验证 Dashboard:" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "https://mnapp.top/" -TimeoutSec 10 -UseBasicParsing
    $status = $response.StatusCode
    $emoji = if ($status -eq 200) { "✅" } else { "❌" }
    Write-Host "  $emoji HTTPS https://mnapp.top/ → $status" -ForegroundColor $(if ($status -eq 200) { "Green" } else { "Red" })
} catch {
    Write-Host "  ❌ HTTPS https://mnapp.top/ → $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "浏览器访问: https://mnapp.top/" -ForegroundColor White
