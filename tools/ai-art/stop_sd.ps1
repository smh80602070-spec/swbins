# Stop ONLY the sd-webui started by start_sd.ps1 (PID file). Never kills other python/node/chrome processes.
param([string]$Swbins3 = "C:\swbins3")
$pidFile = Join-Path $Swbins3 "logs\sd-safe.pid"
try { Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:7860/sdapi/v1/interrupt" -TimeoutSec 3 | Out-Null } catch {}
try { Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:7860/sdapi/v1/unload-checkpoint" -TimeoutSec 5 | Out-Null } catch {}
if (Test-Path $pidFile) {
    $id = [int](Get-Content $pidFile -Raw).Trim()
    & taskkill /T /F /PID $id 2>&1 | Out-Null
    Remove-Item $pidFile -Force
    Write-Output "stopped pid $id (process tree)"
} else {
    Write-Output "no pid file - nothing started by start_sd.ps1"
}
