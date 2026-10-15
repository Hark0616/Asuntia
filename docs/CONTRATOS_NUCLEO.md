# Contratos del núcleo

Primera entrega del [checklist de producto](CHECKLIST_PRODUCTO_2026-10-14.md).
Este documento describe contratos implementados y límites pendientes; no cierra por
sí solo A02 ni A03.

## Expediente e identidad

- `id` identifica el expediente y su URL, independientemente de listas o filtros.
- `titulo` es el nombre del asunto, obligatorio para nuevas aperturas.
- `codigo_interno` se asigna en servidor y es único por firma, incluso después de
  archivar. La restricción de PostgreSQL resuelve colisiones concurrentes.
- `radicado` se mantiene como alias de compatibilidad del código interno, sin una
  segunda columna ni captura. Nunca significa radicado oficial.
- `radicado_oficial` es opcional. Los valores históricos del código interno no se
  copian a él. Para guías existentes, la captura de radicación alimenta este dato;
  el JSON del paso conserva la evidencia histórica de esa actuación.
- Un cliente puede tener varios asuntos y conserva su identidad al archivar uno.
- El responsable debe ser un abogado o administrador activo de la misma firma.
- `fecha_apertura` es una fecha civil; no representa una cita ni un vencimiento.

Ejemplo: «Revisión de contrato de arrendamiento», código `AS-2026-A1B2C3`,
sin radicado oficial y sin guía. Tiene tareas, documentos y actividad normales.

## Guía opcional

Una apertura sin `ruta_codigo` no crea pasos ni tareas automáticas de insolvencia.
`paso_actual` y `flujo_estado` son nulos. La guía se puede incorporar después,
una sola vez, mediante un comando autorizado y serializado por expediente.
La guía disponible es `insolvencia_persona_natural:v2`; se conservan las rutas
históricas existentes. Una ruta desconocida se rechaza, nunca se sustituye.

`estado_id` expresa el estado registrado por la firma. Los pasos, `etapa_actual`
y `siguiente_paso` describen la guía y no se capturan por separado. Sin guía no se
asigna automáticamente un estado de insolvencia. La consolidación de los estados
operativos de B03 permanece pendiente.

## Apertura y permisos

Cliente nuevo, identidad opcional de portal, expediente, pasos y tarea inicial se
confirman juntos. Los repositorios de esta apertura hacen `flush`; el servicio
confirma el caso de uso. Cualquier fallo previo al commit revierte el conjunto.
Un código suministrado duplicado produce 409; una colisión de código generado
se reintenta dentro de un savepoint sin perder el cliente pendiente.

| Acción afectada | Administrador | Abogado | Auxiliar | Cliente |
| --- | --- | --- | --- | --- |
| Abrir asunto | Sí | Solo a su cargo | Con abogado responsable | No |
| Consultar detalle | Firma | Solo a su cargo | Firma | Solo asuntos propios y DTO público |
| Incorporar guía | Sí | Solo a su cargo | No | No |
| Cambiar responsable | Sí | No | No | No |
| Archivar asunto | Sí | No | No | No |

Archivar usa `is_active=False`, conserva código y referencias y retira el asunto
de consultas normales y del portal. La reactivación no tiene todavía un comando
público: debe definirse con B06 antes de ofrecerla en interfaz. La matriz completa
de publicación, retiro y equipo sigue en A03; se conservan sus controles actuales.

El detalle por UUID aplica los mismos filtros de firma, archivo y rol que la
consulta histórica por código. El portal nunca serializa el DTO interno.

## Evidencia

Los contratos de API viven en `backend/app/schemas/asunto.py` y los tipos de
expediente en `frontend/src/types/asunto.ts`. Las pruebas de apertura general,
guía opcional, colisiones, rollback y accesos están en
`backend/tests/test_expediente_general.py`. La migración conserva códigos,
pasos y tareas existentes; los títulos históricos se derivan de la ruta conocida
o del código cuando no existe un título previo. Ante códigos históricos repetidos
en una firma, aborta con diagnóstico para evitar renombrarlos silenciosamente.

## Búsqueda y acceso por firma

`GET /asuntos/busqueda` recibe `pagina`, `por_pagina` (1–100), `q`, `cliente_id`,
`responsable_id`, `estado_id` y `sin_responsable`. Devuelve `items`, `total`,
`pagina` y `por_pagina`; el total y la página provienen de una misma consulta e
instantánea PostgreSQL. El orden es `created_at DESC, id DESC`. Las páginas se
actualizan con los datos actuales: al archivar o crear asuntos puede cambiar su
contenido y el usuario puede regresar a la primera página. No son una exportación
congelada ni un mecanismo para reintentar comandos de escritura.

Los resúmenes solo contienen identidad, cliente, responsable y estado; nunca
descargan pasos, tareas, documentos o novedades. El abogado siempre consulta su
alcance, aunque solicite un filtro de otro responsable. Las relaciones visibles
se restringen a la misma firma y a registros activos. La lista histórica sin
paginación se conserva por compatibilidad; la interfaz de oficina usa la búsqueda
y obtiene el detalle únicamente por UUID. El directorio de clientes cuenta asuntos
sin cargar sus historias y respeta el alcance del abogado.

La lista guarda filtros y página en la URL. Abrir un resultado y volver conserva
esa consulta. La lista de otros asuntos del mismo cliente tiene su propia página
(`asuntos_pagina`) y no altera los filtros de la consulta global. Una solicitud
fallida no se presenta como una lista vacía ni muestra resultados de otra página.

El ingreso requiere `firma_slug` explícito en contraseña, solicitud OTP y verificación
OTP. La captura es compartida por ambos formularios; puede iniciarse desde
`?firma=identificador` o `VITE_FIRMA_SLUG`, sin valor implícito de demostración.
La configuración no concede permisos: el backend valida firma activa, usuario y
credenciales. Cada petición autenticada vuelve a validar la firma; una baja de la
firma invalida también sus sesiones existentes. La recuperación de contraseña y
la recuperación global de la interfaz ante 401 continúan en C03–C04.

## Ciclo de vida del equipo

Solo administración consulta `/equipo/gestion`, crea invitaciones y cambia el
acceso. Los selectores de trabajo siguen consultando únicamente miembros activos.
El alta crea una identidad inactiva; email y documento normalizados no pueden
duplicar otra identidad de oficina de la firma, incluidas las bajas. Para una
reincorporación se invita al miembro existente y se conserva su UUID e historia.

La invitación devuelve una única vez un secreto aleatorio de 256 bits, conserva
su HMAC y vence en 24 horas. Administración copia y comparte el enlace; no se
afirma que se haya enviado correo. El secreto viaja en el fragmento del enlace,
se retira del historial al abrir la vista y solo se envía al comando de activación.
La activación exige contraseña de 12–128 caracteres, consume el enlace una sola
vez y no abre ni sustituye una sesión. Renovar, cancelar o cambiar el rol invalida
las invitaciones anteriores. Las respuestas con secretos llevan `no-store`.

La baja transfiere, dentro de la misma transacción, clientes y asuntos activos,
tareas abiertas del saliente y el trabajo de guía de sus asuntos. Conserva
delegaciones manuales a otros miembros, tareas completadas/canceladas, archivos
y autores históricos. Si hay trabajo, se exige un reemplazo activo de la misma
firma, administrador o abogado. Un abogado solo recibe tareas de asuntos que ya
gestiona o recibe en esa transferencia; para trabajo disperso se elige un
administrador. La baja no borra registros ni elimina el historial del saliente.

Al pasar a auxiliar se transfiere el trabajo profesional. Al pasar a abogado se
transfieren solo tareas de asuntos ajenos, conservando sus clientes y asuntos.
Promover a administrador mantiene las asignaciones. Se impide quitar el último
administrador activo y modificar el propio acceso: otro administrador debe hacerlo.
Los cambios exigen `expected_updated_at` para rechazar pantallas obsoletas con 409.

Los comandos de equipo y los que asignan trabajo toman primero un bloqueo de
la fila de firma, revalidan al actor y luego bloquean expediente/tarea. Así una
baja no compite con una nueva asignación y dos administradores no pueden retirar
simultáneamente el último control. El bloqueo solo dura la transacción SQL.
El JWT incluye la revisión `User.updated_at`; cada petición exige que coincida
con la revisión actual. Cambiar rol, retirar acceso o reincorporar invalida los
tokens anteriores incluso si el rol vuelve a ser el mismo. Este sello revoca
sesiones; no sustituye el historial de auditoría pendiente en B08.

La evidencia adicional está en `backend/tests/test_busqueda_asuntos.py`,
`backend/tests/test_firma_acceso.py` y las pruebas de `ListaExpedientes`, acceso y
navegación del frontend. `.github/workflows/quality.yml` ejecuta build, pruebas de
ambas aplicaciones y migraciones reales en PostgreSQL 16 desde cada push o PR.
