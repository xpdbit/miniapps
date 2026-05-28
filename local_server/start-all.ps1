# =============================================================================
# 一键启动本地开发环境
# 1. 启动 Docker 基础设施（MySQL + Redis）
# 2. 在各 Server 目录自动执行 npm run dev
# =============================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动本地开发环境" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: 启动 Docker 基础设施 ──────────────────────────────────────────
Write-Host "[1/2] 启动 Docker 基础设施 (MySQL + Redis)..." -ForegroundColor Yellow

$composeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
docker compose -f "$composeDir\docker-compose.yml" --env-file "$composeDir\.env" up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 启动失败，请检查 Docker 是否运行" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker 基础设施已启动" -ForegroundColor Green
Write-Host "   MySQL:  localhost:3307"
Write-Host "   Redis:  localhost:6379"
Write-Host ""

# ─── Step 2: 等待 MySQL 就绪 ──────────────────────────────────────────────
Write-Host "等待 MySQL 就绪..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    $result = docker exec local-mysql mysqladmin ping -h localhost --silent 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MySQL 已就绪" -ForegroundColor Green
        break
    }
    $waited++
    Start-Sleep -Seconds 1
}
if ($waited -ge $maxWait) {
    Write-Host "⚠️ MySQL 未在 $maxWait 秒内就绪，请稍后手动检查" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Docker 基础设施就绪" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "请在以下目录各自打开终端，依次执行 npm run dev：" -ForegroundColor White
Write-Host ""

$repoRoot = Resolve-Path "$composeDir\.."

# ─── 输出各 Server 启动命令 ────────────────────────────────────────────────
$services = @(
    @{ Name = "FTG Server";      Dir = "apps\ftg\server";      Port = "3000";  Cmd = "npm run dev"; EnvInfo = "需 .env: FTG_DATABASE_URL=root:root_local@localhost:3307/food_theme_generator" }
    @{ Name = "Game1 Server";    Dir = "apps\game1\server";    Port = "3004";  Cmd = "npm run dev"; EnvInfo = "需 .env: GAME1_DATABASE_URL=root:root_local@localhost:3307/game1 + PORT=3004" }
    @{ Name = "Tavern Server";   Dir = "apps\tavern\server";   Port = "3002";  Cmd = "npm run dev"; EnvInfo = "需 .env: DATABASE_URL=root:root_local@localhost:3307/ai_tavern" }
    @{ Name = "Dashboard Admin"; Dir = "dashboard";            Port = "3001";  Cmd = "tsx server/server.ts"; EnvInfo = "需 .env: MINIAPPS_DATABASE_URL=root:root_local@localhost:3307/miniapps" }
    @{ Name = "Dashboard Front"; Dir = "dashboard";            Port = "5173";  Cmd = "npm run dev"; EnvInfo = "已配置 VITE_API_BASE_URL" }
)

foreach ($svc in $services) {
    $path = Join-Path -Path $repoRoot -ChildPath $svc.Dir
    Write-Host "  ┌─ $($svc.Name)" -ForegroundColor Cyan
    Write-Host "  │  Port: $($svc.Port)" -ForegroundColor Gray
    Write-Host "  │  Dir:  $path" -ForegroundColor Gray
    Write-Host "  │  Cmd:  cd $($svc.Dir) && $($svc.Cmd)" -ForegroundColor White
    Write-Host "  └─ $($svc.EnvInfo)" -ForegroundColor DarkYellow
    Write-Host ""
}

# ─── 可选：用 Windows Terminal 自动开分屏 ─────────────────────────────────
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  快捷操作" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  初始化数据库表: npm run db:push  (每个 Server 目录各执行一次)"
Write-Host "  停止环境:       .\local_server\stop-all.ps1"
Write-Host "  查看日志:       docker compose -f .\local_server\docker-compose.yml logs -f"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
