# Starts DB, backend and mobile in one go. Usage: .\start.ps1
$root = $PSScriptRoot

# 1. Database
Write-Host "Starting database..." -ForegroundColor Cyan
docker compose -f "$root\docker-compose.yml" up -d --wait
if ($LASTEXITCODE -ne 0) { Write-Host "Docker failed. Is Docker Desktop running?" -ForegroundColor Red; exit 1 }

# 2. Backend (python -m avoids broken .exe launchers if the project folder was moved)
$py = "$root\backend\venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "Creating backend venv..." -ForegroundColor Cyan
    python -m venv "$root\backend\venv"
    & $py -m pip install -r "$root\backend\requirements.txt"
}
if (-not (Test-Path "$root\backend\.env")) { Copy-Item "$root\backend\.env.example" "$root\backend\.env" }

Push-Location "$root\backend"
& $py -m alembic upgrade head
Pop-Location
if ($LASTEXITCODE -ne 0) { Write-Host "Migration failed." -ForegroundColor Red; exit 1 }

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; & '$py' -m uvicorn app.main:app --reload --host 0.0.0.0"

# 3. Mobile
if (-not (Test-Path "$root\mobile\node_modules")) { Push-Location "$root\mobile"; npm install; Pop-Location }
if (-not (Test-Path "$root\mobile\.env")) { Copy-Item "$root\mobile\.env.example" "$root\mobile\.env" }

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mobile'; npm start"

Write-Host "Done. Backend: http://localhost:8000/docs  |  Expo opens in its own window." -ForegroundColor Green
