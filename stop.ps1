# Stops backend, Expo and the database. Usage: .\stop.ps1
$root = $PSScriptRoot

# Free the backend and Expo ports
foreach ($port in 8000, 8081, 19000, 19001, 19002) {
    Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

docker compose -f "$root\docker-compose.yml" down
Write-Host "Everything stopped." -ForegroundColor Green
