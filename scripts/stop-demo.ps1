<#
  Stops what start-demo.ps1 started. Only touches the processes it launched (from scripts\.logs\pids.txt).
  Run:   powershell -ExecutionPolicy Bypass -File scripts\stop-demo.ps1
#>
$pidFile = Join-Path $PSScriptRoot ".logs\pids.txt"
if (Test-Path $pidFile) {
  foreach ($id in (Get-Content $pidFile).Split(",")) {
    if ($id) { Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $pidFile -Force
}
Start-Sleep -Seconds 1
foreach ($port in 5001, 4000, 5173) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Port $port is still in use by something this script did not start."
  } else {
    Write-Host "Port $port free"
  }
}
