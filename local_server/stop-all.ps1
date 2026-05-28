# =============================================================================
# 停止本地开发环境
# 1. 停止 Docker 基础设施（MySQL + Redis）
# 2. 提示关闭各 Server 终端
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  停止本地开发环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── 停止 Docker 基础设施 ──────────────────────────────────────────────────
Write-Host "[1/2] 停止 Docker 基础设施 (MySQL + Redis)..." -ForegroundColor Yellow

$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
docker compose -f "$composeDir\docker-compose.yml" down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker 基础设施已停止" -ForegroundColor Green
} else {
    Write-Host "⚠️ Docker 停止可能有异常，请检查" -ForegroundColor Yellow
}
Write-Host ""

# ─── 提示关闭 Server ───────────────────────────────────────────────────────
Write-Host "[2/2] 请手动关闭以下终端的进程（Ctrl+C）" -ForegroundColor Yellow
Write-Host "  - FTG Server      (port 3000)"
Write-Host "  - Game1 Server    (port 3004)"
Write-Host "  - Tavern Server   (port 3002)"
Write-Host "  - Dashboard Admin (port 3001)"
Write-Host "  - Dashboard Front (port 5173)"
Write-Host ""

Write-Host "✅ 环境停止完成" -ForegroundColor Green
Write-Host "数据卷已保留，下次启动数据不变" -ForegroundColor Gray
Write-Host "如需清空数据: docker compose -f .\local_server\docker-compose.yml down -v" -ForegroundColor DarkYellow
