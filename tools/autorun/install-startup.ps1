# Register/unregister the saga autorun daemon as a Windows startup program (per user, no admin).
# NOTE: keep comments ASCII-only (Windows PowerShell 5.1 misparses Korean without a BOM).
#   powershell -ExecutionPolicy Bypass -File tools\autorun\install-startup.ps1 [-Branch tools] [-At 02:30] [-Port 8798] [-Uninstall] [-StartNow]
# It writes a .vbs launcher into shell:startup that runs `node daemon.mjs` hidden with the current CLAUDE_CONFIG_DIR.
# Control page afterwards: http://127.0.0.1:<Port>  (start / stop / run now / latest log)
param(
    [string]$Branch = "tools",
    [string]$At = "02:30",
    [int]$Port = 8798,
    [switch]$Uninstall,
    [switch]$StartNow
)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "saga-autorun.vbs"
if ($Uninstall) {
    if (Test-Path $vbs) { Remove-Item $vbs -Force; Write-Output "removed $vbs" } else { Write-Output "not installed" }
    exit 0
}
$node = (Get-Command node -ErrorAction Stop).Source
$daemon = Join-Path $here "daemon.mjs"
$cfg = $env:CLAUDE_CONFIG_DIR
$lines = @('Set sh = CreateObject("WScript.Shell")')
if ($cfg) { $lines += ('sh.Environment("Process")("CLAUDE_CONFIG_DIR") = "' + $cfg + '"') }
$lines += ('sh.Run """' + $node + '"" """' + $daemon + '"" --branch ' + $Branch + ' --at ' + $At + ' --port ' + $Port + '", 0, False')
Set-Content -Path $vbs -Value ($lines -join "`r`n") -Encoding ASCII
Write-Output "installed $vbs"
Write-Output ("runs at logon: node daemon.mjs --branch " + $Branch + " --at " + $At + " --port " + $Port + (if ($cfg) { " (CLAUDE_CONFIG_DIR=" + $cfg + ")" } else { "" }))
Write-Output ("control page: http://127.0.0.1:" + $Port)
if ($StartNow) { Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $vbs + '"'); Write-Output "started now" }
