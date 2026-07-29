# AGENTS.md — Asuntia

Guía de arquitectura, convenciones y reglas no negociables para agentes de IA y desarrolladores en Asuntia.

## Stack Tecnológico

- **Frontend**: React 19 + Vite 6+ + React Compiler (`babel-plugin-react-compiler`) + TanStack Query v5 + Vanilla CSS (Variables CSS).
- **Backend**: FastAPI (Python 3.12+) + Pydantic v2 + SQLAlchemy 2.0 Async (`asyncpg`) + Alembic.
- **Base de Datos**: PostgreSQL 16 (Hosted en Supabase vía Connection Pooler Supavisor en puerto `6543` en producción; `postgres:16-alpine` en Docker local).
- **Autenticación**: JWT en Cookies `HttpOnly`, `Secure`, `SameSite=Lax` + OTP por correo (Mailpit en local, Resend/SES en producción).
- **Infraestructura**: Docker + Docker Compose, Redis + Celery/ARQ (cola de tareas asíncronas para Subfases 3 y 4).

## Reglas No Negociables (Leyes del Proyecto)

1. **Frontend Desacoplado**: El frontend NUNCA se conecta directamente a Supabase o a la Base de Datos. Prohibido usar `@supabase/supabase-js` o llamadas directas desde React. Toda petición pasa exclusivamente por la API REST de FastAPI (`/api/v1/...`).
2. **Multi-tenant con Patrón Repository (`BaseRepository`)**: Prohibido hacer consultas directas `session.execute()` en servicios o controladores HTTP. Toda lectura o escritura en BD DEBE pasar por la capa `repositories/` heredando de `BaseRepository(session, firma_id)`, donde los filtros por `.where(Model.firma_id == self.firma_id)` e `is_active == True` están inyectados y encapsulados por defecto.
3. **Procesamiento Asíncrono para Tareas Pesadas**: Ninguna tarea pesada (generación de PDFs, extracción de datos con IA, envío masivo de correos/WhatsApp, lecturas de OneDrive) debe ejecutarse dentro del ciclo síncrono de request/response HTTP. Va a Celery/ARQ.
4. **React Compiler Activo**: No usar `useMemo`, `useCallback` ni `React.memo` manualmente; el React Compiler lo automatiza. Si una librería externa no pura da conflicto, se aísla con la directiva `"use no memo"` en componentes frontera.
5. **Migraciones de BD Exclusivas vía Alembic**: Prohibido alterar el esquema de la base de datos a mano. Todos los cambios se realizan mediante scripts de migración versionados con `alembic revision --autogenerate`.
6. **Supabase es SOLO Hosting de PostgreSQL**: Se conecta mediante la cadena de conexión normal (`postgresql+asyncpg://...`). En producción se debe usar obligatoriamente el puerto del Connection Pooler (Supavisor / puerto `6543` en modo Transaction). No usar Supabase Auth, RLS como sustituto del backend, ni Supabase Storage.
7. **Dominio Raíz Compartido para Cookies & CORS**: En producción, frontend y backend deben compartir el dominio raíz (ej: `app.asuntia.com` y `api.asuntia.com` con `Domain=.asuntia.com`) con `CORSMiddleware` configurado explícitamente en FastAPI con `allow_credentials=True`.
8. **Seguridad e Inyección de Secretos**: Cero credenciales, claves privadas o archivos `.env` subidos a Git o empaquetados en imágenes Docker. Los secretos se inyectan vía `env_file` en Docker Compose o secretos de CI/CD.
9. **No Borrado Físico (Soft Deletes & Auditoría)**: Prohibido hacer `DELETE` físico de registros de negocio (asuntos, clientes, novedades, comprobantes). Todos los modelos heredan de `BaseModel` con `firma_id`, `created_at`, `updated_at` y `created_by_id`, manejando borrado lógico (`is_active=False`) o archivado histórico.
10. **Sin Falsas Promesas Jurídicas ni Sobre-explicaciones en UX**: Las comunicaciones y la interfaz deben ser sobrias, elegantes y concisas. Prohibido incluir párrafos extensos explicativos o patronizing copy en la UI. Toda aclaración o contexto adicional debe encapsularse exclusivamente en el componente de Tooltip `<Tooltip content="..." />` con el icono discreto `(i)` (hover en desktop / tap en móvil).
11. **Sinergia y Fuente Única de Verdad**: Cada dato, estado, acción y flujo debe tener un único propósito y una única fuente de captura. Prohibido pedir, guardar o mantener la misma información en más de un lugar, salvo que exista una necesidad legal o técnica explícita y documentada. Antes de añadir un campo, paso o vista, verificar si la información ya existe, puede derivarse o debe alimentar automáticamente los demás módulos.

## Estructura del Proyecto (Monorepo Layout)

> **Nota de estructura**: El siguiente árbol es de referencia conceptual. El agente debe verificar contra la estructura real del archivo/directorio en el workspace antes de asumir rutas.

```text
asuntia/
├── docker-compose.yml           # Infraestructura local (PostgreSQL + Mailpit)
├── docker-compose.prod.yml      # Infraestructura de producción (VPS)
├── .env.example                 # Plantilla de variables de entorno (nunca .env en repo)
├── docs/                        # SCOPE_FINAL.md, ROADMAP_EJECUCION.md
│
├── backend/                     # FastAPI (Layered Architecture)
│   ├── app/
│   │   ├── main.py              # Entrypoint, middlewares, CORS, router v1
│   │   ├── config.py            # Settings (Pydantic BaseSettings)
│   │   ├── core/                # Security, DB async engine (get_db), deps, mail, exceptions
│   │   ├── models/              # SQLAlchemy 2.0 models (heredan de Base con firma_id)
│   │   ├── schemas/             # DTOs (Pydantic v2 con from_attributes = True)
│   │   ├── repositories/        # BaseRepository(session, firma_id) encapsulando multi-tenancy
│   │   ├── services/            # Lógica de negocio pura (Domain services)
│   │   ├── api/v1/endpoints/    # HTTP Controllers (endpoints por recurso)
│   │   └── workers/             # Tareas de Celery/ARQ (Subfase 3+)
│   ├── alembic/                 # Migraciones de BD
│   ├── pyproject.toml           # Dependencias Python
│   └── Dockerfile
│
└── frontend/                    # React 19 + Vite (Feature-Driven Architecture)
    ├── src/
    │   ├── main.tsx             # Entrypoint, TanStack Query client setup
    │   ├── App.tsx              # Router principal
    │   ├── styles/              # CSS global (`tokens.css`, reset)
    │   ├── components/          # UI primitives (`ui/`) y Layouts (`layout/`)
    │   ├── lib/                 # Axios (`withCredentials: true`), QueryClient
    │   ├── features/            # Módulos por dominio (`auth/`, `asuntos/`, `clientes/`, `portal-cliente/`)
    │   │   └── <feature>/       # components/, api/, hooks/
    │   ├── pages/               # Vistas de rutas (`auth/`, `oficina/`, `cliente/`)
    │   └── types/               # TypeScript interfaces (api, asunto, user)
    ├── vite.config.ts           # Config de Vite + React Compiler
    └── package.json
```

## Convenciones de Código y Patrones

### Backend (FastAPI + SQLAlchemy)
- **Patrón Repository**: Toda interacción con la BD se hace llamando a una clase en `app/repositories/` que extiende de `BaseRepository`. Esto garantiza que los filtros `firma_id` e `is_active` nunca se omitan.
- **Pydantic v2 + SQLAlchemy ORM**: Todos los esquemas Pydantic de respuesta (`*Response` o `*DTO`) DEBEN incluir `model_config = ConfigDict(from_attributes=True)` para permitir la serialización limpia de modelos SQLAlchemy Async.
- **Gestión Segura de Conexiones (`AsyncSession`)**: El generador `get_db` en `core/db.py` DEBE usar la estructura `try / yield session / except: await session.rollback() / finally: await session.close()` para evitar fuga de conexiones en `asyncpg` hacia Supavisor.
- **Evitar N+1**: Cargar explícitamente relaciones necesarias mediante `selectinload` o `joinedload` en los métodos del repositorio.
- **Validación DTO**: Validar todas las entradas y salidas de la API mediante esquemas Pydantic v2 separados (`*Create`, `*Update`, `*Response`).
- **Manejo Estandarizado de Excepciones**: Lanzar excepciones de negocio desde `services/` y capturarlas en controladores o handlers globales retornando JSON estructurado (`{"detail": "..."}`).
- **Estados HTTP Semánticos**: Usar `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity`.

### Frontend (React + Vite)
- Patrón Feature-Driven: Cada funcionalidad compleja vive en `src/features/<nombre>/` encapsulando componentes, llamadas a API y custom hooks.
- Consultas y mutaciones de servidor mediante **TanStack Query** (`useQuery`, `useMutation`).
- Cliente HTTP (`axios`) configurado globalmente con `withCredentials: true` para el transporte de cookies JWT.
- Estilos con **Vanilla CSS** usando Custom Properties (Variables CSS) centralizadas en `styles/tokens.css`. Prohibido definir colores o espaciados quemados (hardcoded) en componentes individualmente. Evitar TailwindCSS a menos que el usuario lo solicite explícitamente.
- Paleta visual profesional: Colores desaturados, badges pasteles, tipografía sobria, inspirada en dashboards legales modernos (definida y gobernada mediante `styles/tokens.css`).

## Reglas de Trabajo para Agentes de IA

Cuando un agente de IA realice cambios en este proyecto, DEBE cumplir los siguientes pasos:

1. **Sincronización de Esquemas**: Al crear o modificar un modelo SQLAlchemy en `backend/app/models/`, crear inmediatamente el esquema Pydantic correspondiente en `backend/app/schemas/` (con `from_attributes=True`) y la interfaz TypeScript equivalente en `frontend/src/types/`.
2. **Migración de Base de Datos**: Ejecutar `alembic revision --autogenerate` siempre que cambie un modelo de BD antes de solicitar la verificación.
3. **Verificación Estricta antes de Terminar**: Nunca dar por completado un cambio sin ejecutar la verificación de compilación del frontend (`npm run build`) y las pruebas del backend (`pytest`).
4. **Preservar Comentarios y Documentación**: Mantener todos los docstrings y comentarios existentes que no hayan sido obsoleteados explícitamente por el cambio.
5. **Actualización e Incremento Obligatorio de Pruebas Unitarias**: Cada vez que se agregue una nueva funcionalidad, endpoint REST, regla de negocio o modelo, el agente DEBE actualizar e incrementar la suite de pruebas unitarias en `backend/tests/`. Es OBLIGATORIO incluir tanto el flujo exitoso (*happy path*) como casos borde (*edge cases*), validaciones fallidas (errores HTTP 400, 401, 404, 422) y situaciones que no deberían ocurrir (borrados inexistentes, campos nulos no permitidos, accesos no autorizados).
6. **Gestión e Inclusión Obligatoria de Dependencias**: Cada vez que un agente o desarrollador instale una nueva librería o paquete en el Backend (Python) o Frontend (Node/React), es OBLIGATORIO registrar e incluir inmediatamente la nueva dependencia en `backend/pyproject.toml`, `backend/requirements.txt` y `frontend/package.json` respectivamente.
7. **Diseño Sobrio y Sin Sobre-explicaciones**: Al crear o modificar vistas e interfaces del frontend, el agente DEBE mantener una redacción concisa, elegante y directa. Prohibido agregar textos explicativos largos o patronizing copy en la UI; si un campo o sección requiere contexto adicional, usar el componente `<Tooltip content="..." />` con el icono discreto `(i)` (hover en desktop / tap en móvil).

## Comandos Frecuentes

### Desarrollo Local
- **Infraestructura local**: `docker compose up -d` (PostgreSQL en :5432, Mailpit en :8025 / SMTP :1025)
- **Backend (FastAPI)**: `cd backend && uvicorn app.main:app --reload --port 8000`
- **Frontend (Vite)**: `cd frontend && npm run dev`
- **Mailpit (Mail Catcher local)**: Abrir `http://localhost:8025` en el navegador

### Base de Datos y Migraciones (Alembic)
- **Crear migración**: `cd backend && alembic revision --autogenerate -m "descripcion_cambio"`
- **Aplicar migraciones**: `cd backend && alembic upgrade head`
- **Revertir última migración**: `cd backend && alembic downgrade -1`

### Pruebas y Linter
- **Backend Tests (pytest)**: `cd backend && pytest`
- **Frontend Tests (Vitest)**: `cd frontend && npm test`
- **Frontend Build (Vite)**: `cd frontend && npm run build`

## Contexto de Producto y Fases

Para entender el alcance funcional de cada subfase y el contexto del proyecto:
- **Fuente primaria de contexto**: Consúltese `@docs/ROADMAP_EJECUCION.md` para el plan de subfases y decisiones del stack.
- **Limitación de tokens**: El archivo `@docs/SCOPE_FINAL.md` es un documento masivo de referencia legada. El agente **TIENE PROHIBIDO** leer o cargar `@docs/SCOPE_FINAL.md` completo por defecto para evitar sobrecarga de ventana de contexto y alucinaciones, salvo que el usuario lo solicite explícitamente en su prompt.
