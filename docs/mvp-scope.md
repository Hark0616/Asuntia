# Asuntia MVP Scope

## Objetivo

Validar el flujo principal del producto:

> Un cliente entra con un codigo de seguimiento, ve el tracking de su asunto, entiende el estado actual y consulta lo que se ha hecho.

La version actual es una demo funcional local-first con PGlite y fallback a `localStorage`.
No usa aun autenticacion real, base de datos externa ni almacenamiento real de archivos.

## Incluido

- Landing publica de firma en `/`, seed/data-driven para la demo de insolvencia.
- Consulta publica de caso en `/consulta`.
- Guias publicas publicadas en `/guias/[slug]`.
- Acceso cliente por codigo, radicado, correo, telefono o id con captcha MVP.
- Portal de seguimiento en `/cliente` con lista de casos activos.
- Login demo de firma en `/firma/login`.
- Espacio interno de firma en `/firma`.
- Roles demo para socia, administracion, abogada, asistente y cliente.
- Workspace de solo lectura para asistente.
- Bandeja de trabajo priorizada para solicitudes, hitos y casos que requieren accion.
- Panel de estado del sitio publico dentro de `/firma`.
- Creacion de clientes.
- Creacion de casos.
- Estados de caso.
- Proximo paso visible para cliente.
- Hitos verticales del asunto.
- Gestion de hitos desde el espacio de firma.
- Carga de evidencia cuando la firma la habilita para el hito actual.
- Timeline con avances internos o visibles al cliente.
- Solicitudes de informacion.
- Cambio de estado de solicitudes.
- Registro basico de documentos.
- Auditoria interna en datos locales.
- Datos demo precargados.
- Persistencia local para pruebas.
- Modelo publico tenant-ready por `firm_id`: sitio, areas, guias, casos ejemplo y propuestas de valor.

## No Incluido Todavia

- Login real.
- Captcha validado en servidor.
- Base de datos remota.
- Multi-tenant real.
- Resolucion runtime por subdominio/host.
- Editor CMS para contenido publico.
- Subida real de documentos a storage.
- Notificaciones por correo.
- Supabase/Auth/Storage.
- RLS y permisos avanzados en servidor.
- Auditoria inmutable.
- Firma electronica.
- Integraciones externas.
- IA/OCR.

## Flujo De Firma

1. Entrar desde `/firma/login` o desde el acceso interno visible en el sitio publico.
2. Revisar la bandeja de trabajo.
3. Revisar el panel de sitio publico para verificar landing, consulta y conteos publicados.
4. Abrir un asunto pendiente desde la bandeja o seleccionar cliente.
5. Crear caso o abrir uno existente.
6. Cambiar estado.
7. Actualizar proximo paso.
8. Crear o actualizar hitos del proceso.
9. Habilitar evidencia de cliente para el hito que lo requiera.
10. Publicar avance visible al cliente o interno.
11. Crear solicitud.
12. Registrar documento.

## Flujo De Cliente

1. Entrar a `/consulta` desde el CTA del sitio publico.
2. Ingresar codigo de seguimiento, correo, telefono o id de cliente, por ejemplo `AS-2026-001` o `laura@constructoranorte.co`.
3. Completar captcha MVP.
4. Abrir tracking del asunto en `/cliente`.
5. Cambiar entre casos activos cuando el dato identifica un cliente.
6. Revisar hito actual, hitos completados y proximos hitos.
7. Desplegar hitos completados para ver detalle.
8. Subir evidencia si el hito actual lo permite.
9. Revisar solicitudes, documentos y avances publicados.

## Modelo De Datos Inicial

- `clients`: clientes de la firma.
- `firms`: firma tenant con slug, subdominio, especialidad y contacto.
- `firm_public_sites`: landing 1:1 por firma.
- `firm_practice_areas`: rutas de ayuda publicas por firma.
- `firm_guides`: guias/blog liviano con estado `draft` o `published`.
- `firm_case_studies`: casos ejemplo anonimizados, separados de `cases`.
- `firm_value_props`: propuestas de valor del sitio publico.
- `profiles`: usuarios, roles y vinculo opcional con cliente.
- `cases`: asuntos legales asociados a clientes.
- `milestones`: hitos asociados a casos.
- `updates`: eventos de timeline.
- `requests`: solicitudes de informacion.
- `documents`: documentos registrados.
- `audit`: eventos basicos de trazabilidad.

## Proximo Hito Tecnico

Conectar Supabase:

- `auth.users` para login.
- Tabla `firms`.
- Tablas publicas de firma: `firm_public_sites`, `firm_practice_areas`, `firm_guides`, `firm_case_studies`, `firm_value_props`.
- Tabla `profiles`.
- Tabla `clients`.
- Tabla `cases`.
- Tabla `case_milestones`.
- Tabla `case_updates`.
- Tabla `requests`.
- Tabla `documents`.
- Tabla `audit_events`.
- Row Level Security por firma y cliente.
- Storage con buckets por firma/caso.

## Criterio De Demo

La demo se considera suficiente para mostrar a una firma pequena cuando:

- El abogado puede crear un cliente.
- El abogado puede crear un caso.
- El abogado puede abrir asuntos pendientes desde una bandeja priorizada.
- La firma puede mostrar una landing publica coherente con guias y casos ejemplo.
- La firma puede ver en su workspace el estado del sitio publico.
- El abogado puede crear y ajustar hitos.
- El abogado puede publicar avances.
- El abogado puede crear solicitudes.
- El cliente puede entrar a `/consulta` con codigo y ver el asunto asociado.
- El cliente puede entrar con un dato propio y ver sus casos activos.
- El cliente puede entender el estado del caso sin explicacion adicional.
