# Asuntia MVP Scope

## Objetivo

Validar el flujo principal del producto:

> Un cliente entra, ve sus casos asociados, entiende el estado actual y consulta lo que se ha hecho.

La version actual es una demo funcional con persistencia en `localStorage`. No usa aun autenticacion real, base de datos externa ni almacenamiento real de archivos.

## Incluido

- Vista de firma.
- Vista de cliente.
- Creacion de clientes.
- Creacion de casos.
- Estados de caso.
- Proximo paso visible para cliente.
- Timeline con avances internos o visibles al cliente.
- Solicitudes de informacion.
- Cambio de estado de solicitudes.
- Registro basico de documentos.
- Auditoria interna en datos locales.
- Datos demo precargados.
- Persistencia local para pruebas.

## No Incluido Todavia

- Login real.
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

1. Entrar en modo `Firma`.
2. Seleccionar cliente.
3. Crear caso o abrir uno existente.
4. Cambiar estado.
5. Actualizar proximo paso.
6. Publicar avance visible al cliente o interno.
7. Crear solicitud.
8. Registrar documento.

## Flujo De Cliente

1. Entrar en modo `Cliente`.
2. Buscar por nombre, contacto o correo.
3. Abrir portal demo.
4. Ver lista de casos.
5. Abrir detalle.
6. Revisar estado, proximo paso, timeline, solicitudes y documentos visibles.

## Modelo De Datos Inicial

- `clients`: clientes de la firma.
- `cases`: asuntos legales asociados a clientes.
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
- El abogado puede publicar avances.
- El abogado puede crear solicitudes.
- El cliente puede entrar y ver solo sus casos.
- El cliente puede entender el estado del caso sin explicacion adicional.
