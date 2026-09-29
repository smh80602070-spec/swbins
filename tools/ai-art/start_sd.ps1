# Start sd-webui (swbins3) in a SAFE way: hidden window, BELOW NORMAL priority (the PC stays responsive), PID file for a clean stop.
# NOTE: keep comments ASCII-only (Windows PowerShell 5.1 misparses Korean without a BOM).
#   powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.ps1
#   powershell -ExecutionPolicy Bypass -File tools\ai-art\stop_sd.ps1
param(
    [string]$Swbins3 = "C:\swbins3",
    [int]$WaitSeconds = 480
)
$ErrorActionPreference = "Stop"
$sd = Join-Path $Swbins3 "sd-webui"
$logs = Join-Path $Swbins3 "logs"
$pidFile = Join-Path $logs "sd-safe.pid"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Api-Up {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:7860/sdapi/v1/options" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}
if (Api-Up) { Write-Output "sd-webui already up (7860)"; exit 0 }

# refuse to start when memory is already tight (a start needs several GB and a hung start can freeze the PC)
$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
if ($freeGb -lt 8) { Write-Output "ABORT: only $freeGb GB RAM free (need 8+). Close heavy apps (Unity/Blender) first."; exit 2 }

# this shell may inherit NoDefaultCurrentDirectoryInExePath=1, which stops "call webui.bat" (relative) from being found
Remove-Item Env:NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue
$p = Start-Process -FilePath "cmd.exe" -ArgumentList ("/c call `"" + (Join-Path $sd "webui-user.bat") + "`"") -WorkingDirectory $sd `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logs "sd-safe.out.log") -RedirectStandardError (Join-Path $logs "sd-safe.err.log")
$p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
Set-Content -Path $pidFile -Value $p.Id
Write-Output "started pid $($p.Id), waiting for API (max $WaitSeconds s)"

$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $WaitSeconds) {
    Start-Sleep -Seconds 5
    if ($p.HasExited) { Write-Output "ABORT: process exited early, see $logs\sd-safe.err.log"; exit 3 }
    if (Api-Up) {
        # child python processes inherit nothing - lower their priority too
        Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $p.Id -or $_.Name -eq "python.exe" -and $_.CommandLine -like "*launch.py*" } | ForEach-Object {
            try { (Get-Process -Id $_.ProcessId).PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal } catch {}
        }
        Write-Output "READY http://127.0.0.1:7860"
        exit 0
    }
}
Write-Output "TIMEOUT: API not up after $WaitSeconds s - stopping to protect the PC"
& taskkill /T /F /PID $p.Id | Out-Null
exit 4
