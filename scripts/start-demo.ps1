<#
  Starts the whole presence-verification demo: face service (:5001), mock backend (:4000), demo page (:5173).
  Run from anywhere:   powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1
  Only the face service (for the backend developer):
                       powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -FaceServiceOnly
  Stop it with:        powershell -ExecutionPolicy Bypass -File scripts\stop-demo.ps1
#>
param([switch]$FaceServiceOnly)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $PSScriptRoot ".logs"
New-Item -ItemType Directory -Force $logs | Out-Null

$py = Join-Path $root "ai-service\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  throw "ai-service\.venv is missing. Do the one-time setup in docs\HOW-TO-RUN.md first."
}

$ports = if ($FaceServiceOnly) { @(5001) } else { @(5001, 4000, 5173) }
foreach ($port in $ports) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $port is already in use. Run scripts\stop-demo.ps1 first (or close whatever uses it)."
  }
}

# --- face service: secrets + models -----------------------------------------------------------
$envFile = Join-Path $root "ai-service\.env"
if (-not (Test-Path $envFile)) {
  Write-Host "Creating ai-service\.env with fresh random secrets (never commit this file)..."
  $apiKey = (& $py -c "import secrets;print(secrets.token_urlsafe(32))").Trim()
  $fernet = (& $py -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())").Trim()
  Set-Content -Path $envFile -Encoding ascii -Value "FACE_VERIFICATION_KEY=$apiKey`nTEMPLATE_ENCRYPTION_KEY=$fernet`nPORT=5001`n"
}
$modelDir = Join-Path $root "ai-service\models"
if (-not (Test-Path (Join-Path $modelDir "face_recognition_sface_2021dec.onnx"))) {
  Write-Host "Downloading face models (about 39 MB, one time)..."
  & $py (Join-Path $root "ai-service\scripts\download_models.py")
  if ($LASTEXITCODE -ne 0) { throw "Model download failed." }
}
$key = ((Get-Content $envFile | Where-Object { $_ -like "FACE_VERIFICATION_KEY=*" }) -split "=", 2)[1].Trim()

# --- node dependencies --------------------------------------------------------------------------
$nodeDirs = if ($FaceServiceOnly) { @() } else { @("mock-backend", "presence-verification") }
foreach ($dir in $nodeDirs) {
  $p = Join-Path $root $dir
  if (-not (Test-Path (Join-Path $p "node_modules"))) {
    Write-Host "Installing $dir dependencies..."
    Push-Location $p; npm install --no-audit --no-fund | Out-Null; Pop-Location
  }
}

# --- start ---------------------------------------------------------------------------------------
function Launch($file, $arguments, $workDir, $name) {
  Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $workDir -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs "$name.log") -RedirectStandardError (Join-Path $logs "$name.err.log")
}
$ai = Launch $py "wsgi.py" (Join-Path $root "ai-service") "ai-service"

if ($FaceServiceOnly) {
  "$($ai.Id)" | Set-Content (Join-Path $logs "pids.txt")
  $ok = $false
  for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
    try { $ok = (Invoke-WebRequest "http://127.0.0.1:5001/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ok) { throw "The face service did not start. Look in scripts\.logs\ for the error." }
  Write-Host "  OK  face service   http://127.0.0.1:5001"
  Write-Host ""
  Write-Host "Face service is running. In the backend's .env set:"
  Write-Host "  FACE_VERIFICATION_URL=http://127.0.0.1:5001"
  Write-Host "  FACE_VERIFICATION_KEY=$key"
  Write-Host "Stop it: scripts\stop-demo.ps1"
  return
}

# Demo timings so nobody waits 30 minutes: 30 s interval, 2 min window.
$env:FACE_VERIFICATION_KEY = $key
$env:FACE_VERIFICATION_URL = "http://127.0.0.1:5001"
$env:VERIFICATION_INTERVAL_SECONDS = "30"
$env:VERIFICATION_WINDOW_SECONDS = "120"
$env:VERIFICATION_MAX_ATTEMPTS = "3"
$env:PORT = "4000"
$mock = Launch "node" "src/server.js" (Join-Path $root "mock-backend") "mock-backend"
$web = Launch "node" "node_modules/vite/bin/vite.js" (Join-Path $root "presence-verification") "demo-page"
"$($ai.Id),$($mock.Id),$($web.Id)" | Set-Content (Join-Path $logs "pids.txt")

# --- wait until all three answer -------------------------------------------------------------------
$targets = @{ "face service" = "http://127.0.0.1:5001/health"; "mock backend" = "http://127.0.0.1:4000/health"; "demo page" = "http://localhost:5173/" }
foreach ($name in $targets.Keys) {
  $ok = $false
  for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
    try { $ok = (Invoke-WebRequest $targets[$name] -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ok) { throw "$name did not start. Look in scripts\.logs\ for the error." }
  Write-Host ("  OK  {0,-13} {1}" -f $name, $targets[$name])
}

Write-Host ""
Write-Host "Demo is running. Open http://localhost:5173  (use 'localhost': browsers only allow the camera there or on https)"
Write-Host "Login: intern@demo.local / demo123      Admin: admin@demo.local / demo123"
Write-Host "Logs: scripts\.logs\      Stop: scripts\stop-demo.ps1"
