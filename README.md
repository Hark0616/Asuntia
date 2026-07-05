# Asuntia

MVP web para seguimiento de asuntos legales entre una firma de abogados y sus clientes.

## Stack

- Next.js
- React
- TypeScript
- Persistencia local para demo (`localStorage`)

## Ejecutar

```bash
npm install
npm run dev
```

## Verificar

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Las pruebas e2e levantan o reutilizan el servidor local en `http://localhost:3000` y validan los flujos principales de firma y cliente.

La primera version funciona como demo local sin base de datos externa. El objetivo es validar el flujo principal antes de conectar Supabase/Auth/Storage.

## Flujo MVP

- `/firma`: crear clientes, crear casos, cambiar estados, agregar avances, registrar solicitudes y documentos.
- `/cliente`: ingresar por codigo/radicado, ver tracking del asunto, hitos, solicitudes y documentos publicados.

`/` redirige a `/cliente`.

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
