# saga autorun tray icon (K-0074): shows daemon state in the notification area and controls it.
# Needs no install: WinForms NotifyIcon from Windows PowerShell 5.1. Run with -STA (install-startup.ps1 does).
#   powershell -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File tools\autorun\tray.ps1 [-Port 8798]
# Colors: green = waiting, blue = session running, gray = stopped (STOP file), red = daemon not reachable.
# Menu: open control page / run now / start / stop / daemon on / daemon off / quit tray.
param([int]$Port = 8798)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = "http://127.0.0.1:$Port"
$vbs = Join-Path ([Environment]::GetFolderPath("Startup")) "saga-autorun.vbs"
$stopFile = Join-Path $here "STOP"

function Get-Status { try { Invoke-RestMethod -Uri "$base/api/status" -TimeoutSec 2 } catch { $null } }
function Post-Api($p) { try { Invoke-WebRequest -Method Post -Uri "$base$p" -TimeoutSec 8 -UseBasicParsing | Out-Null } catch { } }
function New-DotIcon([System.Drawing.Color]$c) {
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush $c), 1, 1, 14, 14)
    $g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 60, 60)), 1), 1, 1, 13, 13)
    $g.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$icons = @{
    wait = New-DotIcon ([System.Drawing.Color]::FromArgb(60, 170, 90))
    run  = New-DotIcon ([System.Drawing.Color]::FromArgb(50, 120, 220))
    stop = New-DotIcon ([System.Drawing.Color]::FromArgb(150, 150, 150))
    down = New-DotIcon ([System.Drawing.Color]::FromArgb(210, 60, 60))
}

$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = $icons.down
$ni.Text = "saga autorun"
$ni.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$mStatus = $menu.Items.Add("상태 확인 중...");  $mStatus.Enabled = $false
$menu.Items.Add("-") | Out-Null
$mOpen = $menu.Items.Add("제어 페이지 열기")
$mRun  = $menu.Items.Add("지금 한 번 실행")
$mStart = $menu.Items.Add("시작 (STOP 해제)")
$mStop  = $menu.Items.Add("중지 (STOP)")
$menu.Items.Add("-") | Out-Null
$mUp   = $menu.Items.Add("데몬 켜기")
$mDown = $menu.Items.Add("데몬 끄기")
$menu.Items.Add("-") | Out-Null
$mQuit = $menu.Items.Add("트레이 종료 (데몬은 둠)")
$ni.ContextMenuStrip = $menu

$mOpen.add_Click({ Start-Process $base })
$ni.add_DoubleClick({ Start-Process $base })
$mRun.add_Click({ Post-Api "/api/run"; Refresh })
$mStart.add_Click({ Post-Api "/api/start"; if (Test-Path $stopFile) { Remove-Item $stopFile -Force }; Refresh })
$mStop.add_Click({ Post-Api "/api/stop"; if (-not (Test-Path $stopFile)) { Set-Content -Path $stopFile -Value (Get-Date -Format s) }; Refresh })
$mUp.add_Click({ if (Test-Path $vbs) { Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $vbs + '"') } else { $ni.ShowBalloonTip(3000, "saga autorun", "install-startup.ps1 -StartNow 를 먼저 실행", [System.Windows.Forms.ToolTipIcon]::Warning) }; Start-Sleep -Seconds 2; Refresh })
$mDown.add_Click({
    try { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force } } catch { }
    Start-Sleep -Milliseconds 500; Refresh
})
$mQuit.add_Click({ $timer.Stop(); $ni.Visible = $false; $ni.Dispose(); [System.Windows.Forms.Application]::Exit() })

function Refresh {
    $s = Get-Status
    if ($null -eq $s) {
        $ni.Icon = $icons.down; $text = "saga autorun: 데몬 꺼짐"
        $mRun.Enabled = $false; $mStart.Enabled = $false; $mStop.Enabled = $false; $mUp.Enabled = $true; $mDown.Enabled = $false
    } else {
        $next = ""
        try { $next = ([DateTime]$s.next).ToString("MM-dd HH:mm") } catch { }
        if ($s.running) { $ni.Icon = $icons.run; $text = "saga autorun: 세션 실행 중 (pid $($s.running))" }
        elseif ($s.paused) { $ni.Icon = $icons.stop; $text = "saga autorun: 중지됨 (STOP)" }
        else { $ni.Icon = $icons.wait; $text = "saga autorun: 대기, 다음 $next" }
        if ($s.lastRun) { $text += " / 마지막 exit " + $s.lastExit }
        $mRun.Enabled = -not $s.running; $mStart.Enabled = [bool]$s.paused; $mStop.Enabled = (-not $s.paused) -or [bool]$s.running
        $mUp.Enabled = $false; $mDown.Enabled = $true
    }
    if ($text.Length -gt 63) { $text = $text.Substring(0, 63) }
    $ni.Text = $text
    $mStatus.Text = $text
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.add_Tick({ Refresh })
$timer.Start()
Refresh
[System.Windows.Forms.Application]::Run()
