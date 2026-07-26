Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Levantando Stack Completo de Asuntia con Docker  " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Construyendo y ejecutando contenedores Docker..." -ForegroundColor Yellow
docker compose up -d --build

Write-Host ""
Write-Host "2. Esperando que PostgreSQL este listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "3. Aplicando migraciones de Alembic y sembrando datos de prueba..." -ForegroundColor Yellow
docker exec -it asuntia_backend alembic upgrade head
docker exec -it asuntia_backend python app/seed.py

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  ¡Stack Docker de Asuntia iniciado con exito!      " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  - Backend API: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  - Mailpit Web UI: http://localhost:8025" -ForegroundColor White
Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
