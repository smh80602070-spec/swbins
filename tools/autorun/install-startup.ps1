# Register/unregister the saga autorun daemon + tray icon as Windows startup programs (per user, no admin).
# NOTE: keep comments ASCII-only (Windows PowerShell 5.1 misparses Korean without a BOM).
#   powershell -ExecutionPolicy Bypass -File tools\autorun\install-startup.ps1 [-Branch tools] [-At none] [-OnBoot 5] [-Port 8798] [-Uninstall] [-StartNow]
# Writes two .vbs launchers into shell:startup: daemon (hidden node) and tray (hidden STA powershell).
# Default: no daily time (-At none, the PC is not left on) and one run 5 min after the daemon starts (-OnBoot 5); the rest from the tray menu.
# Control page afterwards: http://127.0.0.1:<Port>  (start / stop / run now / latest log)
param(
    [string]$Branch = "tools",
    [string]$At = "none",
    [int]$OnBoot = 5,
    [int]$Port = 8798,
    [switch]$Uninstall,
    [switch]$StartNow
)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "saga-autorun.vbs"
$vbsTray = Join-Path $startup "saga-autorun-tray.vbs"
if ($Uninstall) {
    foreach ($f in @($vbs, $vbsTray)) { if (Test-Path $f) { Remove-Item $f -Force; Write-Output "removed $f" } }
    exit 0
}
$node = (Get-Command node -ErrorAction Stop).Source
$daemon = Join-Path $here "daemon.mjs"
$tray = Join-Path $here "tray.ps1"
$cfg = $env:CLAUDE_CONFIG_DIR
$cfgLine = ""
if ($cfg) { $cfgLine = 'sh.Environment("Process")("CLAUDE_CONFIG_DIR") = "' + $cfg + '"' }
# VBS string: "" is an escaped quote. Result: sh.Run """<node>"" ""<daemon>"" --branch ...", 0, False
$lines = @('Set sh = CreateObject("WScript.Shell")')
if ($cfgLine) { $lines += $cfgLine }
$lines += ('sh.Run """' + $node + '"" ""' + $daemon + '"" --branch ' + $Branch + ' --at ' + $At + ' --on-boot ' + $OnBoot + ' --port ' + $Port + '", 0, False')
Set-Content -Path $vbs -Value ($lines -join "`r`n") -Encoding ASCII
$ps = Join-Path $PSHOME "powershell.exe"
$linesTray = @('Set sh = CreateObject("WScript.Shell")')
$linesTray += ('sh.Run """' + $ps + '"" -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ""' + $tray + '"" -Port ' + $Port + '", 0, False')
Set-Content -Path $vbsTray -Value ($linesTray -join "`r`n") -Encoding ASCII
Write-Output "installed $vbs"
Write-Output "installed $vbsTray"
$cfgNote = ""
if ($cfg) { $cfgNote = " (CLAUDE_CONFIG_DIR=" + $cfg + ")" }
Write-Output ("runs at logon: node daemon.mjs --branch " + $Branch + " --at " + $At + " --on-boot " + $OnBoot + " --port " + $Port + $cfgNote + " + tray.ps1")
Write-Output ("control page: http://127.0.0.1:" + $Port)
if ($StartNow) {
    $up = $false
    try { Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Port + "/api/status") -TimeoutSec 2 | Out-Null; $up = $true } catch { }
    if ($up) { Write-Output "daemon already up on $Port (kill it first to apply new options)" } else { Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $vbs + '"'); Write-Output "daemon started" }
    $trayUp = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*tray.ps1*" }
    if ($trayUp) { Write-Output "tray already up" } else { Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $vbsTray + '"'); Write-Output "tray started" }
}
