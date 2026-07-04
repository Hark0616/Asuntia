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

La primera version funciona como demo local sin base de datos externa. El objetivo es validar el flujo principal antes de conectar Supabase/Auth/Storage.

## Flujo MVP

- Vista firma: crear clientes, crear casos, cambiar estados, agregar avances, registrar solicitudes y documentos.
- Vista cliente: ingresar por nombre/correo demo, ver casos asociados, estado actual, timeline visible, solicitudes y documentos publicados.

## Siguiente fase tecnica

- Supabase Auth para login real.
- Supabase Postgres para datos multi-tenant.
- Supabase Storage o Cloudflare R2 para documentos.
- Auditoria persistente.
- Deploy en Vercel.
