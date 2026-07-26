@echo off
echo ===================================================
echo 🚀 Iniciando Entorno de Desarrollo de Asuntia
echo ===================================================

echo.
echo 1. Verificando Contenedores de Docker (PostgreSQL 16 + Mailpit)...
docker compose up -d

echo.
echo 2. Iniciando Backend FastAPI en puerto 8000 en ventana separada...
start "Asuntia Backend (FastAPI)" cmd /k "cd /d %~dp0backend && .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"

echo.
echo 3. Iniciando Frontend React + Vite en puerto 5173 en ventana separada...
start "Asuntia Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===================================================
echo ✅ Servicios Iniciados Correctamente!
echo - Frontend: http://localhost:5173
echo - Backend API: http://localhost:8000/docs
echo - Mailpit (Local Mail): http://localhost:8025
echo ===================================================
