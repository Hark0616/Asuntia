# ROADMAP DE EJECUCIÓN — Asuntia

> **Documento derivado de:** [SCOPE_FINAL.md](file:///c:/Users/H/Documents/Code/Asuntia/docs/SCOPE_FINAL.md)
> **Fecha:** 2026-07-26
> **Propósito:** Descomponer el alcance monolítico en subfases estrictas, financieramente viables y técnicamente ejecutables. Cada subfase debe poder facturarse, entregarse y operar de forma independiente.

---

## Principios rectores de este roadmap

1. **Cada subfase es un producto funcional.** No se entrega "la mitad de algo". Cada subfase genera valor real desde el día 1 de su despliegue.
2. **Cada subfase se factura por separado.** El cliente paga por valor recibido, no por promesas futuras.
3. **La complejidad se posterga, no se elimina.** Todo lo que aparece en SCOPE_FINAL.md tiene su lugar, pero no todo cabe en la primera entrega.
4. **La Regla de Oro de la Subfase 1:** Portal de lectura para el cliente + tablero de actualización manual para la oficina. Nada más.
5. **Arquitectura desacoplada desde el día cero.** El frontend nunca toca la base de datos. Toda lógica de negocio vive en el backend.

---

## Arquitectura técnica definitiva

> **Decisión cerrada el 2026-07-26.** Este stack no es provisional ni sugerido. Es la base sobre la que se construyen todas las subfases.

### Stack definitivo

| Capa | Tecnología | Versión mínima | Razón de elección |
|------|-----------|----------------|-------------------|
| **Frontend** | React + Vite + React Compiler | React 19+, Vite 6+ | SPA pura. Sin SSR innecesario. Conversión a PWA sin fricción en Subfase 4. Se aloja en cualquier CDN (Cloudflare Pages, Netlify, servidor propio). |
| **Optimización de renders** | React Compiler (`babel-plugin-react-compiler`) | Estable desde React 19 | Memoización automática de componentes y hooks. Elimina la necesidad de `useMemo`, `useCallback` y `React.memo` manuales. Crítico para un ERP con tablas densas (expedientes, acreedores, líneas de tiempo) donde re-renders innecesarios degradan la experiencia. Se activa como plugin de Babel en `vite.config.ts`. |
| **Estilos** | Vanilla CSS con custom properties | CSS3 | Control total. Sin dependencia de framework CSS. Variables de diseño centralizadas. |
| **Estado y caché del cliente** | TanStack Query (React Query) | v5+ | Cache inteligente, sincronización con el backend, invalidación automática. Elimina la necesidad de gestión de estado global compleja. |
| **Backend / API** | FastAPI (Python) | Python 3.12+, FastAPI 0.115+ | Async nativo, tipado con Pydantic, documentación OpenAPI automática. Ecosistema Python disponible para IA en Subfase 4 sin microservicios adicionales. |
| **ORM / Base de datos** | SQLAlchemy 2.0 + Alembic | SQLAlchemy 2.0+ | ORM maduro, async, migraciones versionadas. No se usa el SDK de Supabase. Si mañana se cambia de proveedor, se cambia una URL de conexión. |
| **Base de datos** | PostgreSQL (alojado en Supabase) | PostgreSQL 16+ | Supabase se usa **estrictamente como hosting de PostgreSQL**. No se usan: RLS de Supabase, Supabase Auth, Supabase Realtime, Supabase Storage, ni el SDK de cliente de Supabase. Si se hace `pg_dump` y se mueve a RDS, DigitalOcean, o un contenedor propio, todo sigue funcionando. |
| **Autenticación** | Implementación propia (FastAPI) | — | JWT + bcrypt para la oficina. OTP por correo para clientes (enviado desde el backend vía SMTP). Control total, sin vendor lock-in. |
| **Cola de tareas** | Celery o ARQ + Redis | — | Para tareas pesadas en Subfase 4: procesamiento de documentos, envío masivo, extracción de datos con IA. No se usa en Subfase 1, se prepara la infraestructura en Subfase 3. |
| **Contenedores** | Docker + Docker Compose | — | Todo el stack se levanta con un solo comando. Reproducible, portable, independiente de proveedor. |
| **Hosting de producción** | VPS propio o cloud ligero | — | El backend corre como contenedor Docker en un VPS (DigitalOcean, Hetzner, Railway). No se depende de Vercel ni de serverless. Sin timeouts, sin cold starts. |

### Reglas de hierro de la arquitectura

Estas reglas no son negociables. Se aplican desde la primera línea de código hasta la última subfase:

1. **El frontend NUNCA habla directo a la base de datos.** Toda request pasa por la API de FastAPI. No hay `supabase.from()` en React. No hay queries SQL en el navegador. No hay excepciones.
2. **Multi-tenant desde la tabla cero.** Cada tabla operativa tiene `firma_id`. Aunque hoy hay una sola oficina, el aislamiento de datos existe desde la primera migración. Retrofit de multi-tenancy es carísimo.
3. **Las tareas pesadas van en un queue.** Ninguna request HTTP debe tardar más de unos segundos. Si algo necesita más (procesar PDF, enviar 50 WhatsApps, leer correos masivos), va a Celery/ARQ.
4. **Supabase es PostgreSQL y nada más (con Connection Pooling).** Se conecta vía `asyncpg` o `psycopg` a través de SQLAlchemy. Para evitar el agotamiento de conexiones en producción ("Too many clients"), SQLAlchemy se conectará obligatoriamente al puerto del Connection Pooler de Supabase (Supavisor / puerto `6543` en modo Transaction) en lugar del puerto 5432 directo. No se usa ningún servicio adicional de Supabase.
5. **Docker desde el día uno.** Backend, base de datos y Redis (cuando se necesite) viven en un `docker-compose.yml`. El entorno local es idéntico al de producción.
6. **Migraciones versionadas con Alembic.** No se modifica la base de datos manualmente. Cada cambio de esquema es una migración con upgrade y downgrade.
7. **Entregabilidad de Email / OTP garantizada.** No se usará un servidor SMTP propio/pelado sin reputación. El OTP se enviará mediante un proveedor transaccional (Resend / AWS SES) con registros DNS estrictos (SPF, DKIM, DMARC) en el dominio oficial para evitar la carpeta de Spam. En entorno **Local**, se incluye un contenedor Mailpit (`mailpit:latest`) para atrapar correos localmente sin enviar emails reales ni consumir cuota.
8. **Estrategia CORS y Autenticación Segura en mismo Dominio Raíz.** Para garantizar que las cookies `HttpOnly`, `Secure`, `SameSite=Lax` funcionen sin bloqueo de navegadores modernos (Safari ITP / Cross-Site rules), el frontend y la API compartirán el mismo dominio raíz en producción (ej. `app.asuntia.com` para frontend y `api.asuntia.com` para backend con cookie en `Domain=.asuntia.com`). `CORSMiddleware` en FastAPI habilitará `allow_credentials=True` restringido a los dominios del proyecto.
9. **Inyección Segura de Secretos.** Cero credenciales o claves privadas en imágenes Docker o en el repositorio. Los secretos (`JWT_SECRET`, credenciales DB, API keys) se inyectarán en producción mediante archivos `.env` restringidos en el VPS (vía `env_file` en `docker-compose.prod.yml`) o mediante secretos de CI/CD (GitHub Actions).
10. **Auditoría de Librerías y Compatibilidad con React Compiler.** Al iniciar el repositorio (Subfase 1), se fijará el inventario base de UI (`@radix-ui` / `shadcn/ui`, `lucide-react`, TanStack Table) y se ejecutará una suite de pruebas de compilación para validar compatibilidad. Si una librería externa rompe el React Compiler, se aislará en un componente frontera con `"use no memo"` antes de construir vistas complejas o tablas densas.

---

## Entornos de desarrollo

| Entorno | Base de datos | Backend | Frontend | Propósito |
|---------|--------------|---------|----------|-----------|
| **Local** | `postgres:16-alpine` en Docker | FastAPI en modo reload (`uvicorn --reload`) | Vite dev server (`npm run dev`) | Desarrollo diario. Arranca en segundos, sin peso innecesario. |
| **Staging** | PostgreSQL en Supabase (proyecto de staging) | FastAPI en contenedor Docker | Build estático en CDN | Pruebas con datos ficticios antes de cada release. |
| **Producción** | PostgreSQL en Supabase (proyecto de producción) | FastAPI en contenedor Docker (VPS) | Build estático en CDN | Datos reales. Solo se despliega desde la rama principal. |

> **¿Por qué PostgreSQL pelado en local en lugar de la imagen completa de Supabase?** Porque `supabase start` levanta ~15 contenedores (GoTrue, PostgREST, Realtime, Storage, Kong, etc.) y no se usa ninguno. El backend es FastAPI, la auth es propia, el storage será OneDrive. Un `postgres:16-alpine` arranca en 2 segundos, pesa nada, y da paridad exacta con lo que importa: el motor de base de datos. Para explorar datos se usa DBeaver, pgAdmin, o el plugin de VS Code.

### Evolución del stack por subfase

| Subfase | Se agrega | Se configura |
|---------|-----------|-------------|
| **1** | FastAPI, React+Vite, PostgreSQL, Docker Compose | Estructura de proyecto, modelos base, auth básica, API REST |
| **2** | Integración Microsoft Graph API (OneDrive), generación de PDF (WeasyPrint / ReportLab) | RBAC en backend, middleware de permisos, auditoría en DB |
| **3** | Redis + Celery/ARQ | Módulo financiero, agenda, búsqueda, bandeja de trabajo |
| **4** | Workers de IA (LLMs, NLP), WhatsApp Business API, Service Worker (PWA) | Procesamiento asíncrono, push notifications, sincronización offline |

### Estructura de proyecto prevista

```text
asuntia/
├── docker-compose.yml           # Infraestructura local (PostgreSQL + Mailpit)
├── docker-compose.prod.yml      # Infraestructura de producción (VPS)
├── .env.example                 # Plantilla de variables de entorno
│
├── docs/                        # Documentación técnica (SCOPE_FINAL, ROADMAP_EJECUCION)
│
├── backend/                     # FastAPI + Python 3.12+ (Arquitectura por Capas y Servicios)
│   ├── app/
│   │   ├── main.py              # Punto de entrada FastAPI, CORS, middlewares y routers globales
│   │   ├── config.py            # Pydantic BaseSettings (variables de entorno tipadas)
│   │   │
│   │   ├── core/                # Módulo transversal (Seguridad, Conexión BD, Mail)
│   │   │   ├── security.py      # Hashing de contraseñas, creación y verificación JWT
│   │   │   ├── db.py            # Conexión SQLAlchemy (AsyncEngine, sessionmaker)
│   │   │   ├── deps.py          # Inyección de dependencias (get_db, get_current_user)
│   │   │   └── mail.py          # Servicio de envío SMTP / OTP (Resend o Mailpit local)
│   │   │
│   │   ├── models/              # Tablas de Base de Datos (SQLAlchemy 2.0 ORM)
│   │   │   ├── base.py          # Clase Base con campos auditables (id, created_at, firma_id)
│   │   │   ├── firma.py         # Modelo Firma / Multi-tenant
│   │   │   ├── user.py          # Modelo Usuario (Oficina y Cliente)
│   │   │   ├── asunto.py        # Modelo Asunto / Expediente
│   │   │   └── estado.py        # Modelo Estado y Novedad
│   │   │
│   │   ├── schemas/             # Validadores DTO (Pydantic v2 schemas)
│   │   │   ├── auth.py          # Token, LoginRequest, OTPVerify
│   │   │   ├── cliente.py       # ClienteCreate, ClienteResponse
│   │   │   └── asunto.py        # AsuntoCreate, AsuntoUpdate, AsuntoResponse
│   │   │
│   │   ├── services/            # Lógica de Negocio pura (Domain Logic)
│   │   │   ├── auth_service.py  # Flujo de login y emisión de OTP
│   │   │   ├── asunto_service.py# Avance de estados y reglas de publicación
│   │   │   └── onedrive_service.py # Integración Graph API (Subfase 2)
│   │   │
│   │   ├── api/                 # Controllers / HTTP Endpoints
│   │   │   └── v1/
│   │   │       ├── api.py       # Router principal que agrupa v1
│   │   │       └── endpoints/   # auth.py, clientes.py, asuntos.py, estados.py
│   │   │
│   │   └── workers/             # Tareas asíncronas de fondo (Celery / ARQ en Subfase 3+)
│   │       └── tasks.py
│   │
│   ├── alembic/                 # Migraciones versionadas de BD
│   │   └── versions/
│   ├── pyproject.toml           # Dependencias (Poetry o UV)
│   ├── Dockerfile               # Imagen de producción (python:3.12-slim)
│   └── tests/                   # Pruebas automatizadas (pytest + httpx)
│
└── frontend/                    # React 19 + Vite (Feature-Driven Architecture)
    ├── src/
    │   ├── main.tsx             # Punto de entrada React (TanStack Query Setup)
    │   ├── App.tsx              # Enrutador principal
    │   ├── styles/              # CSS global, variables (`tokens.css`), reset
    │   ├── config/              # Constantes del entorno (API_URL, env vars)
    │   │
    │   ├── components/          # Componentes genéricos sin lógica de negocio
    │   │   ├── ui/              # Botones, Modales, Badges, Tablas base
    │   │   └── layout/          # Navbar, Sidebar, Header persistente del expediente
    │   │
    │   ├── lib/                 # Librerías externas configuradas
    │   │   ├── axios.ts         # Cliente HTTP (`withCredentials: true`)
    │   │   └── query-client.ts  # Instancia de TanStack Query
    │   │
    │   ├── features/            # Módulos de Negocio aislados
    │   │   ├── auth/            # Login / OTP (components, api, hooks)
    │   │   ├── asuntos/         # Expedientes, Timeline, Estado (components, api, hooks)
    │   │   ├── clientes/        # Gestión de Clientes (components, api, hooks)
    │   │   └── portal-cliente/  # Lectura rápida del cliente (components, pages)
    │   │
    │   ├── pages/               # Páginas/Rutas principales que ensamblan las features
    │   │   ├── auth/            # LoginPage.tsx, OTPPage.tsx
    │   │   ├── oficina/         # AsuntosListPage.tsx, AsuntoDetailPage.tsx
    │   │   └── cliente/         # ClientePortalPage.tsx
    │   │
    │   └── types/               # Definiciones TypeScript compartidas (api, asunto, user)
    ├── vite.config.ts           # Configuración Vite + React Compiler
    └── package.json
```

---

## Resumen ejecutivo de subfases

| Subfase | Nombre | Entregable central | Dependencias |
|---------|--------|-------------------|--------------|
| **1** | Tablero de Estado Base (MVP) | Cliente lee estado → Oficina actualiza estado | Ninguna |
| **2** | Gestión Documental | Carga de documentos, integración OneDrive, RBAC básico, generación de PDFs | Subfase 1 |
| **3** | Flujo Financiero y Liquidaciones | Honorarios, pagos a liquidadores, pasivos, control de saldos | Subfases 1 + 2 |
| **4** | Automatización e IA | Agendas automatizadas, extracción de datos, notificaciones WhatsApp | Subfases 1 + 2 + 3 |

---

## SUBFASE 1 — Tablero de Estado Base (El MVP Absoluto)

### Objetivo de negocio

Eliminar la pregunta número uno que ahoga a la oficina: **"¿Cómo va mi proceso?"**

El cliente entra a un portal web, ve el estado actual de su caso (en qué etapa está, cuál fue la última novedad, cuál es el siguiente paso), y sale. La oficina entra a un tablero interno, cambia ese estado, escribe una nota breve, y guarda. **Nada más.**

Este MVP demuestra valor inmediato: reduce llamadas y mensajes de WhatsApp del tipo "¿ya hay noticias?", centraliza la información de estado en un solo lugar, y da a la oficina un primer motivo tangible para usar la plataforma todos los días.

### Módulos incluidos

#### 1. Autenticación mínima viable

| Componente | Alcance |
|------------|---------|
| **Login del cliente** | Cédula + código OTP enviado al correo registrado (Google Auth / enlace mágico). Sin contraseñas. |
| **Login de la oficina** | Correo + contraseña. MFA no es obligatorio en esta fase (se añade en Subfase 2). |
| **Roles hardcodeados** | Tres roles fijos: Administrador, Abogado, Auxiliar. Sin panel de gestión de roles — se definen en código/configuración. |
| **Sesiones** | JWT con expiración configurable. Cierre de sesión manual. |

> **Referencia en SCOPE_FINAL.md:** Secciones 2.1, 8.8, 8.34, 9.9.2, 9.9.3, A-01 a A-04.
> Lo que se implementa aquí es el mínimo para que un cliente entre y un empleado entre. No se implementan: recuperación avanzada, estados excepcionales de acceso (A-05), bloqueo por intentos, detección de abuso ni acceso de superadministrador.

#### 2. Registro base de clientes y procesos

| Componente | Alcance |
|------------|---------|
| **Alta de cliente** | Nombre, cédula, correo, teléfono. Sin dirección postal, sin tipo de cliente (deudor/acreedor/fiador), sin campos jurídicos avanzados. |
| **Alta de proceso** | Radicado interno, tipo de proceso (insolvencia), cliente vinculado, abogado asignado, fecha de apertura. Sin evaluación de viabilidad, sin control de conflicto de interés, sin flujo guiado (O-04 completo). |
| **Relación cliente-procesos** | Un cliente puede tener múltiples procesos. Cada proceso tiene un solo cliente titular. |

> **Referencia:** Secciones 2.2, 3.7, 9.12.4 (O-04), 9.12.5 (O-05), 9.12.6 (O-06).
> Se implementa la estructura mínima. No se implementan: directorio unificado de personas, detección de duplicados, perfiles de persona con roles múltiples, relaciones entre personas, ni datos de contacto verificados.

#### 3. Portal del cliente (solo lectura)

| Pantalla | Contenido | Acciones del cliente |
|----------|-----------|---------------------|
| **Mis asuntos (C-01)** | Lista de procesos con estado visual (color/badge). Solo aparece si tiene más de un proceso. | Seleccionar un proceso. |
| **Resumen del asunto (C-02)** | Estado actual en lenguaje sencillo, última novedad con fecha, siguiente paso esperado, abogado responsable, fecha de última actualización. | Ninguna acción. Solo lectura. |
| **Mi proceso (C-03)** | Línea de tiempo cronológica inversa con las novedades publicadas. Cada entrada: título, fecha, descripción breve. | Ninguna acción. Solo lectura. |

> **Referencia:** Secciones 2.4, 9.9.7 (C-01), 9.9.8 (C-02), 9.9.9 (C-03).
> Se implementa la promesa principal: "el cliente entiende sin tener que preguntar". No se implementan: C-04 (documentos), C-05 (pagos), C-06 (mensajes y ayuda), C-07 (perfil), C-08 (notificaciones).

#### 4. Tablero de la oficina (escritura manual de estados)

| Pantalla | Contenido | Acciones de la oficina |
|----------|-----------|----------------------|
| **Lista de asuntos (O-03 simplificado)** | Tabla con: radicado, cliente, estado, última actualización, abogado responsable. Filtros por estado y por abogado. | Abrir un asunto. Crear nuevo asunto. |
| **Ficha del asunto (E-01 simplificado)** | Estado actual, última novedad, siguiente paso, abogado, fecha. | Cambiar estado (dropdown de estados predefinidos), escribir una novedad (texto libre + fecha), indicar siguiente paso, guardar. |
| **Gestión de estados** | Lista configurable de estados con nombre y color. | Crear, editar, reordenar estados (solo Administrador). |

> **Referencia:** Secciones 3.2.1, 8.5, 9.12.2 (O-01), 9.12.4 (O-03), 9.13.2 (E-01).
> Se implementa un CRUD de estados y novedades. No se implementan: bandeja de trabajo priorizada (O-01 completo), búsqueda global (O-02), creación guiada de asunto (O-04 completo), agenda (O-07), finanzas (O-08), directorios (O-09), centro de revisiones (O-10), centro de notificaciones (O-11).

#### 5. Mecanismo de publicación simple

| Componente | Alcance |
|------------|---------|
| **Publicar novedad** | Cuando la oficina escribe una novedad y marca "visible para el cliente", esa novedad aparece en C-03 del cliente. |
| **Visibilidad** | Campo booleano: `publicado_al_cliente = sí/no`. Sin flujo de borrador → revisión → validación → publicación. |

> **Referencia:** Secciones 9.7, 9.8, 9.17.2.
> Se implementa la versión más simple del contrato "registrar una vez, informar donde corresponda". No se implementa: el flujo completo de calidad (borrador, pendiente de revisión, validado, publicado, corregido, archivado), vista previa exacta del portal, ni política configurable de publicación (F-04).

#### 6. Catálogo de estados predefinido

Se entregan los 10 estados base definidos en la reunión:

| Estado | Color |
|--------|-------|
| Sin acción aún | Amarillo |
| Pendiente por hacer | Ámbar |
| Pendiente por corregir | Coral |
| Listo pero no se puede presentar | Ocre |
| Pendiente por presentar | Púrpura |
| Presentado | Azul claro |
| En espera de respuesta | Cian |
| Admitido | Verde menta |
| Activo | Verde |
| Cerrado / Archivado | Gris |

El administrador puede añadir o editar estados desde la interfaz.

> **Referencia:** Sección 3.2.1. Se respeta la nota de aplicación visual: badges de tono atenuado, no bloques de color sólidos estridentes.

### Límites de alcance — Qué NO se hace en la Subfase 1

Esta lista es exhaustiva e intencional. Cada ítem tiene su lugar en una subfase posterior.

| Funcionalidad excluida | Subfase destino | Justificación |
|------------------------|-----------------|---------------|
| Carga de documentos/evidencias por parte de la oficina o el cliente | **Subfase 2** | Requiere almacenamiento, integración OneDrive, clasificación y control de versiones. |
| Integración con OneDrive | **Subfase 2** | Complejidad de API, tenant, permisos heredados. |
| Generación de PDFs | **Subfase 2** | Depende de plantillas de documentos y datos estructurados. |
| RBAC configurable (panel de roles y permisos) | **Subfase 2** | Los 3 roles fijos son suficientes para el MVP. |
| MFA para personal interno | **Subfase 2** | Necesario para producción con datos reales, no para el MVP de validación. |
| Módulo de pagos/honorarios | **Subfase 3** | Flujo financiero completo es una subfase entera. |
| Pagos al liquidador | **Subfase 3** | Requiere el módulo financiero. |
| Vista de pagos del cliente (C-05) | **Subfase 3** | Sin módulo financiero no hay datos que mostrar. |
| Módulo de agenda/audiencias (O-07, E-10) | **Subfase 3** | No es vital para "leer un estado". Se gestiona manualmente. |
| Base de datos de acreedores | **Subfase 3** | Pertenece al modelado financiero y de obligaciones. |
| Base de datos de liquidaciones patrimoniales | **Subfase 3** | Idem. |
| Evaluación de viabilidad (E-02) | **Subfase 3** | Complejidad jurídica alta, no es necesaria para el MVP. |
| Módulo de bienes (E-04) | **Subfase 3** | Inventario patrimonial es parte del flujo financiero. |
| Módulo de ingresos y gastos (E-05) | **Subfase 3** | Idem. |
| Módulo de propuesta y acuerdo (E-11) | **Subfase 3** | Idem. |
| Módulo de liquidación (E-12) | **Subfase 3** | Idem. |
| Solicitudes y documentos del cliente (C-04) | **Subfase 2** | Depende de gestión documental. |
| Mensajes y ayuda (C-06) | **Subfase 4** | Requiere sistema de tickets y notificaciones. |
| Perfil y seguridad del cliente (C-07) | **Subfase 2** | Depende de RBAC y gestión de identidad robusta. |
| Notificaciones (C-08, O-11) | **Subfase 4** | Requiere infraestructura de notificaciones. |
| Auditoría (E-15, F-07) | **Subfase 2** | Necesaria para producción, no para validación de concepto. |
| Consola de superadministración (S-01 a S-08) | **Subfase 2** | No hay múltiples firmas ni necesidad de gobierno global en el MVP. |
| Búsqueda global (O-02) | **Subfase 2** | El volumen de datos del MVP no justifica búsqueda avanzada. |
| Desbloqueo secuencial de pasos | **Subfase 2** | El MVP permite cambio libre de estado para reducir fricción inicial. |
| Comunicaciones (E-14) | **Subfase 4** | Requiere integración con canales externos. |
| Procesos y cobros (E-06) | **Subfase 3** | Pertenece al modelado procesal avanzado. |
| Tareas y solicitudes internas (E-08) | **Subfase 2** | Coordinación interna se puede hacer fuera de la plataforma en el MVP. |
| Catálogos y plantillas (F-03) | **Subfase 2** | Solo hay un catálogo de estados en el MVP. |
| Privacidad, retención y solicitudes (F-05) | **Subfase 2** | Necesario para producción con datos reales. |
| Integraciones y almacenamiento (F-06) | **Subfase 2** | No hay integraciones en el MVP. |
| Política de publicación configurable (F-04) | **Subfase 2** | El MVP usa un booleano simple. |
| PWA / app instalable | **Subfase 4** | Primero validar el producto web. |
| Automatizaciones con IA | **Subfase 4** | Máxima complejidad, mínima prioridad. |
| Notificaciones por WhatsApp | **Subfase 4** | Requiere API de mensajería y costos recurrentes. |
| Tabla de retención documental | **Subfase 2** | Necesaria para datos reales, no para MVP. |
| Modelo completo de dominio (11 entidades+) | **Gradual** | El MVP usa un modelo simplificado. Se enriquece en cada subfase. |

### Criterio de éxito técnico

La Subfase 1 se considera exitosa cuando:

- [ ] Un cliente puede autenticarse con cédula + OTP por correo.
- [ ] Al entrar, ve la lista de sus procesos con estado visual diferenciado por color.
- [ ] Al seleccionar un proceso, ve: estado actual, última novedad, siguiente paso, abogado responsable y fecha de última actualización.
- [ ] Ve una línea de tiempo cronológica de novedades publicadas.
- [ ] No puede editar, subir, ni descargar nada. Solo lee.
- [ ] Un miembro de la oficina puede autenticarse con correo + contraseña.
- [ ] Puede ver la lista completa de asuntos con filtros por estado y abogado.
- [ ] Puede abrir un asunto, cambiar su estado (de un catálogo predefinido), escribir una novedad con fecha, marcarla como visible o no para el cliente, e indicar el siguiente paso.
- [ ] Los cambios se reflejan inmediatamente en el portal del cliente.
- [ ] El administrador puede crear, editar y reordenar estados del catálogo.
- [ ] La interfaz es responsive (mobile-first para el cliente, desktop-first para la oficina).
- [ ] No hay datos hardcodeados: todo es editable desde la interfaz de la oficina.

### Stack técnico de la Subfase 1

Se aplica la **arquitectura técnica definitiva** descrita al inicio de este documento. Para la Subfase 1 específicamente:

| Capa | Implementación en Subfase 1 |
|------|----------------------------|
| Frontend | React + Vite. Dos SPAs: portal del cliente (mobile-first) y tablero de la oficina (desktop-first). |
| Backend | FastAPI con 4-5 routers: auth, clientes, asuntos, novedades, estados. |
| Base de datos | PostgreSQL (Supabase hosting). ~6 tablas: firmas, usuarios, clientes, asuntos, novedades, estados. |
| Auth | JWT + bcrypt (oficina), JWT + OTP por correo (cliente). Implementación propia en FastAPI. |
| Infraestructura | Docker Compose local (PostgreSQL + backend). VPS + CDN en producción. |
| No se usa aún | Redis, Celery/ARQ, OneDrive API, WhatsApp API. |

---

## SUBFASE 2 — Gestión Documental

### Objetivo de negocio

Convertir a Asuntia de un tablero de estados en el **repositorio central del expediente**. La oficina deja de buscar documentos en carpetas de OneDrive, chats de WhatsApp y correos. Todo documento relacionado a un caso vive (o se enlaza desde) la plataforma. El cliente puede ver los documentos que se le han compartido explícitamente.

### Módulos incluidos

#### 1. Integración con OneDrive (M365 Personal / Gratuito y Business)

- Conexión OAuth2 (Microsoft Graph API) configurada para **cuentas personales (Microsoft Accounts / M365 Gratuito)** y cuentas organizacionales.
- **Soporte Híbrido (Sin costos iniciales):** Para desarrollo, pruebas, demos y el piloto inicial con la oficina, se utiliza la **cuenta actual de OneDrive que la oficina ya posee (M365 Gratuito o Personal)**. No se requiere comprar licencias ni tenants corporativos de Microsoft 365 Business para operar la Subfase 2.
- **Ruta de Escalabilidad:** La integración usará Microsoft Graph API con soporte para `common` endpoints, garantizando que si a futuro la firma decide migrar a un tenant M365 Business por política interna o cumplimiento de Habeas Data (Ley 1581), el cambio sea transparente y sin reescribir código.
- Navegación de carpetas existentes desde la plataforma mediante Graph API.
- Vinculación de archivos de OneDrive a un asunto sin duplicar el archivo.
- Carga de nuevos archivos a OneDrive desde la interfaz de Asuntia.

#### 2. Expediente documental por asunto (E-07)

- Clasificación de documentos por tipo: anexo del cliente, escrito de solicitud, auto admisorio, acta de audiencia, acta de acuerdo, acta de fracaso, poder, comunicación del juzgado, otro.
- Control de versiones: cada nueva versión conserva la anterior.
- Estados de revisión: recibido, en revisión, validado, requiere corrección, radicado, compartido con cliente.
- Metadatos: nombre funcional, fecha del documento, fecha de recepción, origen, responsable, visibilidad.

#### 3. Carga de evidencias desde la oficina

- Upload directo desde la interfaz (drag & drop).
- Validación de formato y tamaño.
- Asociación obligatoria a un asunto y tipo documental.
- Vista previa de documentos (PDF, imágenes).

#### 4. RBAC configurable (F-01, F-02)

- Panel de administración de equipo: invitar, suspender, retirar miembros.
- Definición de roles con permisos granulares: ver, crear, editar, eliminar, por módulo.
- La auxiliar NO puede eliminar registros (regla por defecto).
- Permisos efectivos visibles por usuario.
- MFA obligatorio para personal interno.

#### 5. Portal del cliente — Documentos (C-04 parcial)

- Sección "Tus documentos": lista de documentos compartidos explícitamente por la oficina.
- Cada documento muestra: nombre, tipo, fecha, estado, opción de ver/descargar.
- **No se habilita carga de documentos por el cliente en esta subfase** (decisión [P] Pendiente en SCOPE_FINAL.md).

#### 6. Generación de PDFs

- Exportación del resumen del asunto como PDF.
- Exportación de la línea de tiempo como PDF.
- Plantillas básicas para informes de estado.

#### 7. Auditoría básica (E-15 simplificado)

- Registro de quién modificó qué, cuándo y desde dónde.
- Vista de actividad por asunto.
- Sin exportación, sin investigación avanzada, sin eventos técnicos.

#### 8. Desbloqueo secuencial de estados

- Los estados siguen una secuencia lógica configurable.
- El avance desbloquea el siguiente paso.
- Excepciones autorizadas permiten saltar o retroceder con motivo documentado.

#### 9. Mejoras de autenticación y acceso

- Estados excepcionales de acceso (A-05): sesión vencida, sin permiso, invitación vencida.
- Recuperación de acceso (A-03): flujo básico de recuperación por correo.
- Bloqueo por intentos fallidos.
- Perfil y seguridad del cliente (C-07): datos básicos, sesiones activas, cierre de sesión.

### Límites de alcance — Qué NO se hace en la Subfase 2

| Funcionalidad excluida | Subfase destino |
|------------------------|-----------------|
| Módulo de pagos/honorarios | **Subfase 3** |
| Módulo de agenda/audiencias | **Subfase 3** |
| Bases de datos de acreedores, liquidaciones, acuerdos | **Subfase 3** |
| Evaluación de viabilidad (E-02) | **Subfase 3** |
| Bienes, ingresos, gastos, propuesta, liquidación | **Subfase 3** |
| Automatizaciones con IA | **Subfase 4** |
| Notificaciones por WhatsApp | **Subfase 4** |
| PWA / app instalable | **Subfase 4** |
| Consola de superadministración completa | **Subfase 4** |
| Carga de documentos por el cliente | **Pendiente de decisión** |
| Mensajes y ayuda (C-06) como sistema de tickets | **Subfase 4** |
| Comunicaciones centralizadas (E-14) | **Subfase 4** |
| Búsqueda global con indexación de contenido | **Subfase 3** |

### Criterio de éxito técnico

- [ ] La oficina puede subir documentos desde la interfaz y vincularlos a un asunto.
- [ ] Los documentos de OneDrive se pueden navegar y vincular sin duplicar archivos.
- [ ] Cada documento tiene tipo, versión, estado de revisión y visibilidad definidos.
- [ ] El cliente puede ver y descargar documentos marcados como "compartidos".
- [ ] El administrador puede gestionar roles y permisos desde un panel.
- [ ] La auxiliar no puede eliminar registros.
- [ ] MFA está activo para el personal interno.
- [ ] Se genera un PDF del resumen del asunto con la línea de tiempo.
- [ ] Toda modificación de datos queda registrada en el log de auditoría.
- [ ] Los estados siguen una secuencia lógica con excepciones documentadas.

---

## SUBFASE 3 — Flujo Financiero y Liquidaciones

### Objetivo de negocio

Convertir a Asuntia en el **centro de control financiero** de la oficina. Eliminar las "tablitas y chismitas de Excel" donde se rastrean pagos. El cliente puede ver cuánto debe, cuánto ha pagado y por qué concepto. La oficina puede controlar honorarios, gastos, pagos a liquidadores y saldos pendientes sin mezclar conceptos ni perder trazabilidad.

### Módulos incluidos

#### 1. Módulo financiero (O-08, E-13)

- **Categorías de pago claramente separadas:**
  - Honorarios de la oficina.
  - Anticipos.
  - Gastos y expensas del procedimiento.
  - Honorarios del liquidador (fijados por el juzgado).
  - Pagos a acreedores bajo acuerdo.
- **Por cada movimiento:** concepto, obligado, beneficiario, valor, fecha, método, soporte, persona que registró, persona que verificó, estado (reportado → pendiente de verificación → confirmado → rechazado → reversado).
- **Flujo operativo:** cliente envía comprobante por WhatsApp → auxiliar registra en la plataforma → administrador/abogado verifica → estado se actualiza.
- **Reversiones con motivo:** nunca borrado silencioso.

#### 2. Vista de pagos del cliente (C-05)

- Resumen por categoría: honorarios, gastos, pagos a terceros.
- Próxima obligación.
- Historial de movimientos con: concepto, valor, fecha, estado.
- Comprobantes visibles.
- Fecha de corte visible.
- **El cliente no realiza pagos desde la plataforma.**

#### 3. Agenda y audiencias (O-07, E-10)

- Calendario con vistas: día, semana, mes, lista.
- Tipos de evento: audiencia, término procesal, vencimiento, reunión, compromiso.
- Cada evento: tipo, asunto, fecha/hora, responsable, participantes, enlace/ubicación, estado de confirmación, recordatorio.
- Ciclo de audiencia: antes (preparación), durante/después (resultado), cierre (validación).
- Resumen post-audiencia: la abogada registra lo ocurrido y se vincula al asunto.
- Links de audiencias visibles para la oficina (internos).

#### 4. Base de datos de acreedores (E-03)

- Directorio unificado: NIT/cédula, nombre, correo, dirección, contacto.
- Relación por asunto: cada acreedor tiene obligaciones dentro de un expediente.
- Campos separados: capital, intereses, sanciones, saldo, fecha de corte.
- Estado de verificación por obligación.
- Detección de duplicados.

#### 5. Base de datos de liquidaciones patrimoniales

- Registro completo: radicado, nombre del proceso, juzgado, cliente, cédula, observaciones, última actuación, si fue aperturado, si pagó liquidador (con detalle completo, no solo Sí/No).
- Vinculación con el asunto correspondiente del módulo de solicitudes.
- Carpeta documental asociada (usa la infraestructura de Subfase 2).

#### 6. Registro de acuerdos / no acuerdos

- Bitácora de resultado por proceso: acuerdo, fracaso, liquidación.
- Observaciones y últimas actuaciones.
- Vinculación con el asunto fuente.

#### 7. Evaluación de viabilidad (E-02)

- Revisión guiada de requisitos jurídicos (Ley 2445 de 2025).
- Criterios: identificación, calidad (persona natural / pequeña comerciante), cesación de pagos, obligaciones, acreedores, exclusiones.
- Resultado: viable, no viable, viable con condición, información insuficiente.
- Solo un abogado habilitado aprueba la conclusión.

#### 8. Módulos patrimoniales

- **Bienes (E-04):** tipo, titularidad, valor, gravámenes, documentos, estado de verificación.
- **Ingresos y gastos (E-05):** fuentes de ingreso, gastos de subsistencia, personas a cargo, flujo mensual.
- **Procesos y cobros (E-06):** procesos judiciales/administrativos relacionados, medidas cautelares, estado.
- **Propuesta y acuerdo (E-11):** versiones de propuesta, acreencias, escenarios, votación, resultado.
- **Liquidación (E-12):** causal, autoridad, liquidador, inventario, acreencias, adjudicaciones, resultado.

#### 9. Búsqueda global (O-02)

- Búsqueda por: nombre, cédula, radicado, acreedor, documento.
- Resultados agrupados por tipo, con permisos respetados.

#### 10. Bandeja de trabajo completa (O-01)

- Términos vencidos y en riesgo.
- Audiencias próximas.
- Revisiones pendientes.
- Pagos por verificar.
- Asuntos sin siguiente acción.
- Personalización por rol.

### Límites de alcance — Qué NO se hace en la Subfase 3

| Funcionalidad excluida | Subfase destino |
|------------------------|-----------------|
| Automatizaciones con IA (lectura de correos, agendamiento automático) | **Subfase 4** |
| Notificaciones por WhatsApp (API de Meta/Twilio) | **Subfase 4** |
| Sincronización con Google Calendar | **Subfase 4** |
| PWA / app instalable | **Subfase 4** |
| Consola de superadministración completa (S-01 a S-08) | **Subfase 4** |
| Comunicaciones centralizadas (E-14) con integración de canales | **Subfase 4** |
| Sistema de mensajes y ayuda para el cliente (C-06 como tickets) | **Subfase 4** |
| Procesamiento de pagos en línea desde la plataforma | **Fuera de alcance** |
| Carga de documentos por el cliente | **Pendiente de decisión** |
| Multi-firma (varias firmas de abogados en una misma instancia) | **Fuera de alcance inicial** |

### Criterio de éxito técnico

- [ ] La oficina puede registrar obligaciones de pago separadas por categoría (honorarios, gastos, liquidador, terceros).
- [ ] Puede registrar pagos con soporte, concepto, fecha y estado.
- [ ] Las reversiones conservan el movimiento original.
- [ ] El cliente ve su resumen financiero con conceptos separados y fecha de corte.
- [ ] La agenda muestra audiencias, términos y vencimientos en vista de calendario.
- [ ] Después de cada audiencia, la abogada registra un resumen vinculado al asunto.
- [ ] La base de acreedores es un directorio unificado con relaciones por asunto.
- [ ] La evaluación de viabilidad guía los requisitos y conserva la conclusión profesional.
- [ ] La bandeja de trabajo prioriza acciones pendientes por tipo y urgencia.
- [ ] La búsqueda global encuentra asuntos, personas, documentos y actuaciones.

---

## SUBFASE 4 — Automatización e IA

### Objetivo de negocio

Pasar de un sistema operado manualmente a uno que **anticipa, automatiza y comunica** sin intervención humana en tareas repetitivas. La oficina deja de depender de la memoria para agendar, de los chats para recordar, y del envío manual de actualizaciones. Asuntia se convierte en un asistente proactivo.

### Módulos incluidos

#### 1. Agendas automatizadas

- Lectura automática de correos del Centro de Conciliación para extraer: nombre del cliente, fecha de audiencia, enlace virtual.
- Búsqueda automática del cliente en la base de datos.
- Creación automática de evento en la agenda de Asuntia.
- Sincronización bidireccional con Google Calendar.
- Recordatorios automáticos configurables (1 día antes, 1 hora antes).

#### 2. Extracción de datos con IA

- Análisis de documentos cargados (actas, autos, comunicaciones) para extraer: fechas, nombres, radicados, montos, decisiones.
- Sugerencia automática de siguiente estado y novedad (sujeta a validación humana).
- Detección de términos vencidos o por vencer.
- **La IA sugiere, el humano aprueba.** Nunca se publica al cliente sin validación.

#### 3. Notificaciones por WhatsApp

- Integración con WhatsApp Business API (Meta Cloud API).
- Notificaciones al cliente: actualizaciones de estado, recordatorios de audiencia, confirmaciones de pago.
- Notificaciones al equipo: agenda del día siguiente, alertas de términos, pagos pendientes.
- Plantillas de mensaje aprobadas y registradas.
- Evidencia de envío y entrega conservada en el expediente.

#### 4. Sistema de mensajes y ayuda (C-06)

- Preguntas frecuentes contextuales por tipo de asunto y estado.
- Solicitudes estructuradas: reportar dato incorrecto, pedir aclaración, notificar cambio de información.
- Historial de solicitudes y respuestas.
- Vinculación automática al asunto que el cliente estaba viendo.

#### 5. Notificaciones internas (O-11)

- Centro de notificaciones categorizado: acción requerida, asignación, término, revisión, finanzas, seguridad.
- Cada notificación enlaza al registro exacto.
- Agrupación de duplicados.
- Configuración de avisos por usuario.

#### 6. Comunicaciones centralizadas (E-14)

- Registro de comunicaciones por asunto: correo, WhatsApp, llamada, portal.
- Cada registro: participantes, canal, contenido, fecha, evidencia de entrega.
- Distinción entre comunicación informativa y evidencia procesal.

#### 7. Consola de superadministración (S-01 a S-08)

- Resumen global, gestión de firmas, usuarios globales.
- Soporte y acceso de emergencia con franja visible y auditoría.
- Salud del sistema e integraciones.
- Datos de demo y pruebas aislados.
- Configuración global de funciones habilitadas.

#### 8. PWA / App instalable

- Conversión de la aplicación web a Progressive Web App.
- Instalación desde navegador en Android e iOS.
- Funcionalidad offline para consulta de estado (cache de última sincronización).
- Push notifications nativas.

#### 9. Privacidad, retención y solicitudes (F-05)

- Políticas de tratamiento con versiones.
- Tabla de retención por categoría documental.
- Solicitudes de consulta, corrección, supresión.
- Eliminaciones programadas con bloqueos por deber legal.

#### 10. Catálogos y plantillas avanzados (F-03)

- Tipos y rutas de asunto configurables.
- Plantillas de comunicación con variables.
- Conceptos financieros configurables.
- Reglas de recordatorio por tipo de evento.
- Textos explicativos del portal personalizables.

### Límites de alcance — Qué NO se hace en la Subfase 4

| Funcionalidad excluida | Motivo |
|------------------------|--------|
| App nativa (compilada) para iOS/Android | La PWA cubre el 95% de los casos de uso. App nativa solo si hay demanda comprobada. |
| Inteligencia artificial autónoma (sin validación humana) | Riesgo jurídico inaceptable. La IA siempre sugiere, el abogado decide. |
| Procesamiento de pagos en línea (pasarela de pago) | La oficina recibe pagos por canales tradicionales. Integrar pasarela es un proyecto aparte. |
| Multi-firma (plataforma SaaS para múltiples firmas de abogados) | Requiere rediseño de modelo de negocio, pricing y soporte. Es un producto diferente. |
| Integración con Rama Judicial / SIPROJ | APIs externas no controladas, inestables, sin SLA. Se evalúa según disponibilidad. |
| Análisis predictivo de casos | Requiere volumen de datos y madurez de plataforma que no existirán al inicio. |

### Criterio de éxito técnico

- [ ] Los correos del Centro de Conciliación se procesan automáticamente y crean eventos de agenda.
- [ ] Google Calendar se sincroniza bidireccionalmente con la agenda de Asuntia.
- [ ] El equipo recibe la agenda del día siguiente por WhatsApp a una hora configurable.
- [ ] El cliente recibe notificaciones de actualización de estado por WhatsApp.
- [ ] Cada notificación externa tiene evidencia de envío/entrega en el sistema.
- [ ] La IA extrae datos de documentos cargados y sugiere actualizaciones (con >80% de precisión en campos clave).
- [ ] Ninguna sugerencia de IA se publica al cliente sin validación humana.
- [ ] La aplicación es instalable como PWA desde navegador móvil.
- [ ] El push notification funciona en Android y iOS.
- [ ] La consola de superadministración permite soporte temporal auditado.
- [ ] Las solicitudes de privacidad del titular se gestionan desde un módulo dedicado.

---

## Dependencias entre subfases

```
Subfase 1 ──────► Subfase 2 ──────► Subfase 3 ──────► Subfase 4
(Tablero)         (Documentos)      (Finanzas)         (IA + Auto)
                                    
Cada subfase se construye sobre la anterior.
No se puede saltar a la Subfase 3 sin haber entregado la 2.
La Subfase 4 solo tiene sentido con datos reales y flujos estabilizados.
```

## Estimación de complejidad relativa

| Subfase | Complejidad | Tiempo estimado | % del proyecto total |
|---------|-------------|-----------------|---------------------|
| 1 | Baja | 3–4 semanas | ~15% |
| 2 | Media | 5–7 semanas | ~25% |
| 3 | Alta | 8–12 semanas | ~35% |
| 4 | Muy alta | 10–16 semanas | ~25% |

> Estas estimaciones son **relativas**, no compromisos de entrega. Se refinan al iniciar cada subfase con alcance cerrado.

## Decisiones pendientes que afectan todas las subfases

Estas decisiones de SCOPE_FINAL.md siguen abiertas y deben resolverse antes de pasar de demo a producción (pueden resolverse durante la ejecución de la Subfase 1):

| Decisión pendiente | Impacto |
|-------------------|---------|
| Mecanismo definitivo de autenticación del cliente | Subfase 1 |
| ¿El cliente sube documentos a la plataforma? | Subfase 2 |
| ¿El cliente puede ver el escrito de solicitud? | Subfase 2 |
| Propietario del tenant de OneDrive y región de datos | Subfase 2 |
| Política de retención y eliminación | Subfase 2 |
| Permisos exactos de la auxiliar en finanzas | Subfase 3 |
| Canales de notificación autorizados | Subfase 4 |
| Proveedor de WhatsApp Business API | Subfase 4 |
| Datos reales vs. datos de demo | Todas |
| Razón social, NIT y jurisdicción de la oficina | Todas |
| Rutas procesales incluidas en la primera versión | Subfase 3 |

---

> **Este roadmap es un documento vivo.** Se actualiza al inicio de cada subfase con los aprendizajes de la anterior. Cada subfase comienza con un kick-off de alcance cerrado antes de escribir código.
