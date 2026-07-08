# Public Site Strategy

## Decision

`/` es la landing publica de la firma demo `Asuntia Insolvencia`.
La consulta de casos vive separada en `/consulta`, y los resultados siguen en `/cliente`.

El contenido publico no se hardcodea en componentes: se compone desde `WorkspaceData` con
`getFirmPublicSiteModel(data, firmId)`.

## Modelo

Entidades publicas por `firm_id`:

- `firms`: identidad del tenant, slug, subdominio, especialidad y contacto.
- `firm_public_sites`: texto principal, CTAs, confianza y asset visual.
- `firm_practice_areas`: rutas de ayuda.
- `firm_guides`: guias publicas con `status` draft/published y slug unico por firma.
- `firm_case_studies`: casos ejemplo anonimizados, nunca casos reales.
- `firm_value_props`: promesas y alcances comerciales.

## Rutas Publicas

- `/`: landing de firma.
- `/consulta`: formulario de consulta por codigo, correo, telefono o id.
- `/cliente`: portal de resultados, solo despues de resolver una consulta.
- `/guias/[slug]`: detalle de guia publicada.

## Reglas

- Todo bloque publico debe relacionarse por `firm_id`.
- Guias y casos ejemplo pueden relacionarse por `practice_area_id`.
- Guias `draft` no aparecen en landing ni renderizan pagina publica.
- Casos ejemplo no deben leer ni duplicar registros de `cases`.
- El CTA publico de seguimiento siempre apunta a `/consulta`.
- Multi-tenant por subdominio queda preparado en schema, pero no resuelve runtime todavia.

## Promocion A Supabase

Las migraciones ya crean las tablas esperadas para Supabase/PGlite.
Al conectar Supabase remoto, el siguiente paso es agregar RLS:

- Lectura anonima solo para contenido publico `published`.
- Lectura/escritura interna limitada por `profiles.firm_id`.
- Guías draft visibles solo a roles internos de la firma.
- Casos reales siguen protegidos por las reglas de cliente/firma, separados de marketing.
