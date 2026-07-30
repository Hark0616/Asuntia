# Asuntia

Plataforma de gestión de asuntos legales para firmas de abogados y sus clientes.

## Stack

- Frontend: React 19, Vite, TypeScript y TanStack Query.
- Backend: FastAPI, Pydantic v2, SQLAlchemy 2 Async y Alembic.
- Base de datos: PostgreSQL 16.
- Desarrollo local: Docker Compose y Mailpit.

El frontend consume exclusivamente la API REST de FastAPI. PostgreSQL no se
expone directamente a React.

## Desarrollo local

### 1. Infraestructura y backend

```powershell
docker compose up -d --build
```

Este comando inicia:

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Mailpit: `http://localhost:8025`

`docker-compose.override.yml` monta el código de `backend/app` y las migraciones
en los contenedores locales. Uvicorn recarga los cambios sin conservar una copia
antigua del backend dentro de la imagen.

Para comprobar el estado:

```powershell
docker compose ps
docker compose logs backend --tail 50
```

### 2. Datos iniciales

La carga semilla reinicia los datos de demostración. Úsala solamente en una base
local que pueda reemplazarse:

```powershell
cd backend
.venv\Scripts\python.exe app/seed.py
```

Las migraciones se aplican automáticamente al iniciar Compose. También pueden
ejecutarse manualmente:

```powershell
cd backend
.venv\Scripts\alembic.exe upgrade head
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Aplicación: `http://localhost:5173`

## Verificación

```powershell
cd backend
.venv\Scripts\pytest.exe

cd ..\frontend
npm test
npm run build
```

## Accesos locales

Los usuarios de demostración se crean desde `backend/app/seed.py`. Las
credenciales de prueba no deben incluirse como valores precargados en la
interfaz ni utilizarse en producción.

## Documentación

- [Plan de ejecución](docs/ROADMAP_EJECUCION.md)
- [Alcance funcional](docs/SCOPE_FINAL.md)
- [Principios de ingeniería](docs/engineering-principles.md)
- [Estrategia de base de datos](docs/database-strategy.md)
