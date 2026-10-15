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
