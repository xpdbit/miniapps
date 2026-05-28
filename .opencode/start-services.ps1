# Define processes to start
$processes = @(
    @{
        Name = "Tavern Server"
        FileName = "cmd.exe"
        Arguments = '/c cd /d E:\.Code\.miniapps\apps\tavern\server && npm run dev'
        WorkingDirectory = "E:\.Code\.miniapps\apps\tavern\server"
        HealthUrl = "http://localhost:3002/health"
        HealthMethod = "Invoke-RestMethod"
        TimeoutSec = 3
    },
    @{
        Name = "Game1 Server"
        FileName = "cmd.exe"
        Arguments = '/c cd /d E:\.Code\.miniapps\apps\game1\server && npm run dev'
        WorkingDirectory = "E:\.Code\.miniapps\apps\game1\server"
        HealthUrl = "http://localhost:3004/health"
        HealthMethod = "Invoke-RestMethod"
        TimeoutSec = 3
    },
    @{
        Name = "Vite Frontend"
        FileName = "cmd.exe"
        Arguments = '/c cd /d E:\.Code\.miniapps\dashboard && npm run dev'
        WorkingDirectory = "E:\.Code\.miniapps\dashboard"
        HealthUrl = "http://localhost:5173"
        HealthMethod = "Invoke-WebRequest"
        TimeoutSec = 5
    }
)

Write-Host "=== Starting all 3 services in parallel ===" -ForegroundColor Cyan
Write-Host ""

# Store Process objects
$procs = @{}

foreach ($svc in $processes) {
    Write-Host "Launching $($svc.Name)..." -NoNewline
    $p = [System.Diagnostics.Process]::new()
    $p.StartInfo.FileName = $svc.FileName
    $p.StartInfo.Arguments = $svc.Arguments
    $p.StartInfo.WorkingDirectory = $svc.WorkingDirectory
    $p.StartInfo.UseShellExecute = $false
    $p.StartInfo.CreateNoWindow = $true
    $p.StartInfo.RedirectStandardOutput = $true
    $p.StartInfo.RedirectStandardError = $true
    
    $started = $p.Start()
    if ($started) {
        Write-Host " PID=$($p.Id)" -ForegroundColor Green
        $procs[$svc.Name] = @{ Process=$p; Config=$svc }
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== All 3 launched. Waiting 25 seconds for startup... ===" -ForegroundColor Yellow
Start-Sleep -Seconds 25
Write-Host ""

$results = @{}

foreach ($svc in $processes) {
    $name = $svc.Name
    if (-not $procs.ContainsKey($name)) {
        $results[$name] = @{ Status = "FAILED"; Detail = "Process did not start" }
        continue
    }
    
    $procInfo = $procs[$name]
    $p = $procInfo.Process
    
    # Check if process is still running
    $stillRunning = !$p.HasExited
    Write-Host "Checking $name (PID=$($p.Id), Running=$stillRunning) ... " -NoNewline
    
    # Try health check
    $healthy = $false
    $detail = ""
    try {
        if ($svc.HealthMethod -eq "Invoke-RestMethod") {
            $response = Invoke-RestMethod -Uri $svc.HealthUrl -TimeoutSec $svc.TimeoutSec -ErrorAction Stop
            $healthy = $true
            $detail = "OK - $(if ($response -is [string]) { $response } else { $response | ConvertTo-Json -Compress })"
        } else {
            $response = Invoke-WebRequest -Uri $svc.HealthUrl -TimeoutSec $svc.TimeoutSec -UseBasicParsing -ErrorAction Stop
            $healthy = ($response.StatusCode -eq 200)
            $detail = "HTTP $($response.StatusCode)"
        }
    } catch {
        $detail = $_.Exception.Message
    }
    
    if ($healthy) {
        Write-Host "HEALTHY ($detail)" -ForegroundColor Green
        $results[$name] = @{ Status = "HEALTHY"; Detail = $detail }
    } else {
        Write-Host "UNHEALTHY ($detail)" -ForegroundColor Red
        $results[$name] = @{ Status = "UNHEALTHY"; Detail = $detail }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ""

foreach ($svc in $processes) {
    $name = $svc.Name
    $r = $results[$name]
    if ($r.Status -eq "HEALTHY") {
        Write-Host "  [PASS] $name - $($r.Detail)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $name - $($r.Detail)" -ForegroundColor Red
    }
}

Write-Host ""
$pass = ($results.Values | Where-Object { $_.Status -eq "HEALTHY" }).Count
$total = $processes.Count
Write-Host "Result: $pass/$total services healthy" -ForegroundColor $(if ($pass -eq $total) { "Green" } else { "Yellow" })
