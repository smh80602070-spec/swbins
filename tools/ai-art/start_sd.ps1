# Start ComfyUI (swbins3) in a SAFE way: hidden window, BELOW NORMAL priority (the PC stays responsive), PID file for a clean stop.
# NOTE: keep comments ASCII-only (Windows PowerShell 5.1 misparses Korean without a BOM).
#   powershell -ExecutionPolicy Bypass -File tools\ai-art\start_sd.ps1
#   powershell -ExecutionPolicy Bypass -File tools\ai-art\stop_sd.ps1
# Flags (AMD RX 7600 8GB, ROCm 7.2 Windows, 2026-10-07): pytorch attention + AOTriton, lowvram offload without pinned memory,
# fp32 VAE (bf16 VAE is slow on RDNA3). ComfyUI disables MIOpen on RDNA3 by itself (set COMFYUI_ENABLE_MIOPEN=1 for ESRGAN upscales).
param(
    [string]$Swbins3 = "C:\swbins3",
    [int]$WaitSeconds = 600,   # ROCm torch import + backend probing takes 5-6 min on this PC (measured 2026-10-07)
    [int]$Port = 8188
)
$ErrorActionPreference = "Stop"
$comfy = Join-Path $Swbins3 "comfyui"
$logs = Join-Path $Swbins3 "logs"
$pidFile = Join-Path $logs "comfy.pid"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Api-Up {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:$Port/system_stats" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}
if (Api-Up) { Write-Output "ComfyUI already up ($Port)"; exit 0 }

# refuse to start when memory is already tight (a start needs several GB and a hung start can freeze the PC)
$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
if ($freeGb -lt 8) { Write-Output "ABORT: only $freeGb GB RAM free (need 8+). Close heavy apps (Unity/Blender) first."; exit 2 }

$env:TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL = "1"
$env:PYTHONIOENCODING = "utf-8"
$py = Join-Path $comfy "venv\Scripts\python.exe"
$args = @("main.py", "--listen", "127.0.0.1", "--port", "$Port", "--disable-auto-launch",
          "--use-pytorch-cross-attention", "--disable-dynamic-vram", "--lowvram", "--disable-pinned-memory", "--fp32-vae",
          "--output-directory", (Join-Path $comfy "output"))
$p = Start-Process -FilePath $py -ArgumentList $args -WorkingDirectory $comfy -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logs "comfy.out.log") -RedirectStandardError (Join-Path $logs "comfy.err.log")
$p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
Set-Content -Path $pidFile -Value $p.Id
Write-Output "started pid $($p.Id), waiting for API (max $WaitSeconds s)"

$t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt $WaitSeconds) {
    Start-Sleep -Seconds 3
    if ($p.HasExited) { Write-Output "ABORT: process exited early, see $logs\comfy.err.log"; exit 3 }
    if (Api-Up) { Write-Output "READY http://127.0.0.1:$Port"; exit 0 }
}
Write-Output "TIMEOUT: API not up after $WaitSeconds s - stopping to protect the PC"
& taskkill /T /F /PID $p.Id | Out-Null
exit 4
