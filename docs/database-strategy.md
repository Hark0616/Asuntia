# Database Strategy: Local First, Supabase Ready

## Decision

Asuntia debe trabajar con migraciones versionadas desde el inicio.

La forma recomendada para emular produccion localmente es usar Supabase CLI con Docker:

- Supabase local para desarrollo.
- PostgreSQL local manejado por Supabase.
- Migraciones en `supabase/migrations`.
- Seed local para datos demo.
- Tipos generados desde el schema.
- Las mismas migraciones se aplican luego al proyecto remoto en Supabase.

## Por Que

Esto permite que el desarrollo local y la nube hablen el mismo idioma:

- Se prueba contra PostgreSQL real.
- Se versiona cada cambio de schema.
- Se evita crear tablas manualmente en el dashboard.
- Se reducen diferencias entre local y produccion.
- Se puede revisar cada migracion en GitHub.

## Flujo Recomendado

1. Crear o modificar migracion local.
2. Ejecutar Supabase local.
3. Aplicar migraciones localmente.
4. Correr pruebas.
5. Commitear migracion y codigo.
6. Aplicar la misma migracion al proyecto remoto.
7. Generar tipos actualizados.

Comandos esperados en la siguiente fase:

```bash
supabase init
supabase start
supabase migration new initial_schema
supabase db reset
supabase gen types typescript --local > src/lib/database.types.ts
supabase db push
```

## Fuente De Verdad

La fuente de verdad del schema debe ser el repositorio:

```text
supabase/migrations
```

No el dashboard de Supabase.

Si se hace un cambio manual en Supabase, debe convertirse despues en migracion para no perder trazabilidad.

## Modelo Inicial Esperado

Tablas base:

- `firms`
- `profiles`
- `clients`
- `cases`
- `case_updates`
- `requests`
- `documents`
- `audit_events`

Relaciones base:

- `clients.firm_id -> firms.id`
- `profiles.firm_id -> firms.id`
- `cases.client_id -> clients.id`
- `cases.firm_id -> firms.id`
- `case_updates.case_id -> cases.id`
- `requests.case_id -> cases.id`
- `documents.case_id -> cases.id`
- `audit_events.firm_id -> firms.id`

## Seguridad

Cuando se conecte Supabase, cada tabla sensible debe tener Row Level Security.

Reglas minimas:

- Un usuario solo puede leer datos de su firma.
- Un cliente solo puede leer sus casos autorizados.
- Avances internos no deben ser visibles para clientes.
- Documentos internos no deben ser visibles para clientes.
- Auditoria no debe ser editable desde cliente.

## Pendiente

Este MVP aun usa `localStorage` para validar UX. La siguiente fase tecnica debe reemplazar esa persistencia por Supabase local/remoto usando migraciones.

