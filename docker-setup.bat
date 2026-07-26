@echo off
echo ===================================================
echo   Levantando Stack Completo de Asuntia con Docker
echo ===================================================
echo.
echo 1. Construyendo y ejecutando contenedores Docker...
docker compose up -d --build

echo.
echo 2. Esperando que PostgreSQL este listo...
timeout /t 5 /nobreak > NUL

echo.
echo 3. Aplicando migraciones de Alembic y sembrando datos...
docker exec -it asuntia_backend alembic upgrade head
docker exec -it asuntia_backend python app/seed.py

echo.
echo ===================================================
echo   ¡Stack Docker de Asuntia iniciado con exito!
echo ===================================================
echo   - Backend API: http://localhost:8000/docs
echo   - Mailpit Web UI: http://localhost:8025
echo   - PostgreSQL: localhost:5432
echo ===================================================
pause
