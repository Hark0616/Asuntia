# Asuntia MVP Scope

## Objetivo

Validar el flujo principal del producto:

> Un cliente entra con un codigo de seguimiento, ve el tracking de su asunto, entiende el estado actual y consulta lo que se ha hecho.

La version actual es una demo funcional con persistencia en `localStorage`. No usa aun autenticacion real, base de datos externa ni almacenamiento real de archivos.

## Incluido

- Entrada principal en `/`.
- Acceso cliente por codigo, radicado, correo, telefono o id con captcha MVP.
- Portal de seguimiento en `/cliente` con lista de casos activos.
- Espacio interno de firma en `/firma`.
- Bandeja de trabajo priorizada para solicitudes, hitos y casos que requieren accion.
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

## No Incluido Todavia

- Login real.
- Captcha validado en servidor.
- Base de datos remota.
- Multi-tenant real.
- Subida real de documentos a storage.
- Notificaciones por correo.
- Supabase/Auth/Storage.
- Roles avanzados.
- Auditoria inmutable.
- Firma electronica.
- Integraciones externas.
- IA/OCR.

## Flujo De Firma

1. Entrar desde `/` con el acceso interno de firma.
2. Revisar la bandeja de trabajo.
3. Abrir un asunto pendiente desde la bandeja o seleccionar cliente.
4. Crear caso o abrir uno existente.
5. Cambiar estado.
6. Actualizar proximo paso.
7. Crear o actualizar hitos del proceso.
8. Habilitar evidencia de cliente para el hito que lo requiera.
9. Publicar avance visible al cliente o interno.
10. Crear solicitud.
11. Registrar documento.

## Flujo De Cliente

1. Entrar a `/`.
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
- El abogado puede crear y ajustar hitos.
- El abogado puede publicar avances.
- El abogado puede crear solicitudes.
- El cliente puede entrar con codigo y ver el asunto asociado.
- El cliente puede entrar con un dato propio y ver sus casos activos.
- El cliente puede entender el estado del caso sin explicacion adicional.
