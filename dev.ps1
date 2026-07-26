# Script PowerShell para iniciar todo el entorno de desarrollo de Asuntia
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "🚀 Iniciando Entorno de Desarrollo de Asuntia" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Levantar contenedores Docker
Write-Host "`n1. Verificando Contenedores Docker (PostgreSQL + Mailpit)..." -ForegroundColor Yellow
docker compose up -d

# 2. Iniciar Backend FastAPI
Write-Host "`n2. Iniciando Backend FastAPI en puerto 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"

# 3. Iniciar Frontend Vite
Write-Host "`n3. Iniciando Frontend React + Vite en puerto 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "✅ Servicios Iniciados Correctamente!" -ForegroundColor Green
Write-Host "- Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "- Backend API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "- Mailpit (Mail local): http://localhost:8025" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
