# Estrategia de datos: PostgreSQL, FastAPI y Alembic

**Actualizada:** 14 de octubre de 2026. Alineada con `AGENTS.md` y el [checklist vigente del producto](CHECKLIST_PRODUCTO_2026-10-14.md).

Esta revisión sustituye las instrucciones antiguas de Supabase CLI, migraciones en `supabase/migrations` y persistencia del producto en `localStorage`. No describían la arquitectura actual y no deben utilizarse para cambios nuevos.

## Decisión

- PostgreSQL 16 es la base de datos. Localmente se usa PostgreSQL en Docker o el entorno PostgreSQL de desarrollo documentado para el equipo.
- Supabase proporciona exclusivamente hosting de PostgreSQL. En producción la conexión SQLAlchemy/asyncpg utiliza el pooler Supavisor en modo Transaction, puerto `6543`, según las reglas del proyecto.
- Toda interacción de negocio pasa por FastAPI. El frontend no usa SDK de Supabase, acceso SQL, Supabase Auth, Storage ni RLS como sustituto de autorización del backend.
- Las consultas y escrituras de negocio viven en repositorios derivados de `BaseRepository`, con alcance por firma y conservación histórica. Las consultas personalizadas y sus relaciones deben mantener esos invariantes.
- Los cambios de esquema se gestionan únicamente con Alembic en `backend/alembic/versions/`. Los modelos actuales describen el estado deseado; la cadena de migraciones describe cómo llegar a él conservando datos.
- Los contratos que consume React son DTO de la API. Mantener sincronizados modelos SQLAlchemy, esquemas Pydantic e interfaces TypeScript; no generar un cliente de acceso a tablas para el navegador.

## Flujo de cambio

1. Definir el significado del dato, su fuente única, relaciones y permisos. Comprobar si ya existe o puede derivarse.
2. Modificar el modelo y sus contratos Pydantic/TypeScript correspondientes.
3. Desde `backend/`, ejecutar `alembic revision --autogenerate -m "descripcion_cambio"` contra el entorno de desarrollo.
4. Inspeccionar la revisión: renombres, backfills, nulabilidad, índices, restricciones y efectos sobre datos existentes no se dan por resueltos por la autogeneración.
5. Aplicar `alembic upgrade head` en una base de prueba aislada. Verificar instalación vacía y actualización con datos representativos; no usar la base operativa como fixture destructiva.
6. Ejecutar `pytest`, las pruebas frontend pertinentes y `npm run build`. Las pruebas que usan `Base.metadata.create_all` no sustituyen las pruebas de la cadena Alembic.
7. Registrar código, contratos, migración y pruebas juntos. Preparar respaldo, promoción y recuperación antes de aplicar en un entorno operativo; no usar `downgrade` a ciegas si una migración puede perder datos.

No se altera el esquema manualmente en el dashboard ni se ejecutan `supabase db push` o `supabase db reset` como mecanismo de migración de Asuntia. Credenciales y archivos `.env` no se incluyen en Git ni en imágenes.

## Integridad y autorización

El asunto es la referencia común de tareas, citas, documentos y novedades. Una guía procesal es opcional. Agenda, bandeja y portal proyectan esa información sin mantener copias editables independientes. Este es el contrato objetivo; el checklist identifica las partes que aún requieren implementación o migración.

Cada operación valida pertenencia a firma, acceso al asunto y estado activo de los recursos relacionados. Las restricciones de BD refuerzan unicidad y relaciones; no sustituyen permisos del servidor. El cliente consulta únicamente sus asuntos y recursos autorizados. Las publicaciones y retiros de acceso requieren trazabilidad.

Los registros de negocio se archivan o desactivan; no se borran físicamente por una acción operativa. Revisar las cascadas ORM/FK existentes forma parte del checklist: no asumir que la presencia de `is_active` ya garantiza conservación en todas las vías.

## Operación y estado de verificación

El entorno de producción ya declara un volumen de archivos. Eso no demuestra que exista respaldo ni que se pueda restaurar la relación entre metadatos y contenido. La aceptación requiere recuperación ensayada de BD y almacenamiento, controles de acceso y monitoreo de fallos.

Los detalles pendientes de transacciones, identidad del asunto, aislamiento, migraciones, archivos y operación se mantienen en el [checklist del producto](CHECKLIST_PRODUCTO_2026-10-14.md), evitando una segunda lista de estado que pueda divergir.
