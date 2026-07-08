# Asuntia

MVP web para seguimiento de asuntos legales entre una firma de abogados y sus clientes.

## Stack

- Next.js
- React
- TypeScript
- Persistencia local con PGlite y respaldo de UI en `localStorage`

## Ejecutar

```bash
npm install
npm run dev
```

## Verificar

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:visual
```

Las pruebas e2e levantan o reutilizan el servidor local en `http://localhost:3000` y validan los flujos principales de firma y cliente.
Las pruebas unitarias validan reglas de seleccion del workspace y que las migraciones de `supabase/migrations` apliquen en PGlite.
Las pruebas visuales guardan capturas base de las superficies principales para revisar cambios de UI en GitHub.

La primera version funciona como demo local sin base de datos externa. PGlite ejecuta localmente las mismas migraciones versionadas que luego se promueven a Supabase. El objetivo es validar el flujo principal antes de conectar Supabase/Auth/Storage.

## Flujo MVP

- `/`: entrada principal con consulta por codigo, radicado, correo, telefono o id de cliente, captcha MVP y acceso interno de firma.
- `/cliente`: portal aislado con casos activos del cliente, seguimiento del asunto, hitos, solicitudes y documentos publicados.
- `/firma`: espacio interno aislado con bandeja de trabajo para priorizar pendientes, crear clientes, crear casos, gestionar hitos, cambiar estados, agregar avances, registrar solicitudes y documentos.

El captcha actual es de demo y se valida en cliente. En produccion debe reemplazarse por Turnstile/hCaptcha con verificacion del lado servidor.

## Siguiente fase tecnica

- Supabase Auth para login real.
- Supabase Postgres para datos multi-tenant.
- Supabase Storage o Cloudflare R2 para documentos.
- Auditoria persistente.
- Deploy en Vercel.

## Documentacion De Producto Y Tecnologia

- [Alcance MVP](docs/mvp-scope.md)
- [Principios de ingenieria](docs/engineering-principles.md)
- [Estrategia de base de datos](docs/database-strategy.md)
- [Handoff de sesion 2026-07-05](docs/session-handoff-2026-07-05.md)
