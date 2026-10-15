# Operabilidad y pruebas por roles · 2026-10-15

## Dictamen

El núcleo permite una demostración y pruebas controladas de oficina/portal con
almacenamiento local. Todavía no está aceptado para ser la única herramienta de
una firma con información real: faltan capacidades cotidianas y comprobaciones
de operación y recuperación. Una suite correcta no sustituye esas verificaciones.

Azure y la aceptación de OneDrive con una cuenta real quedan fuera de esta revisión,
por indicación del usuario. No se cambió la configuración de esos servicios.

## Método y alcance

Tres agentes revisaron abogado, auxiliar y cliente; el coordinador revisó
administración y operación. Se incorporaron 15 recorridos de integración de API
con PostgreSQL real, identidades sintéticas y archivos locales temporales.
Se ejecutan en un solo proceso porque los fixtures comparten una BD desechable.
El correo se sustituye por un transporte de prueba en esos recorridos.

| Rol | Recorridos nuevos | Comprobaciones principales |
| --- | ---: | --- |
| Administración/jefe | 1 | Abrir cliente/asunto sin guía, encontrarlo, distribuir trabajo, transferir titular, conservar delegaciones y trabajo terminado, archivar sin borrar registros. |
| Abogado | 4 | Abrir a su cargo, buscar, gestionar tarea y agenda, nota/PDF privados, publicar/retirar, guardar borrador y avanzar guía, perder acceso tras transferencia. |
| Auxiliar/secretaría | 6 | Apertura atómica, responsable obligatorio, tarea delegada con conflicto de edición, agenda, soporte y nota internos, autorización profesional, borrador sin avance y límites administrativos. |
| Cliente | 4 | Consultar solo publicaciones propias, descargar contenido local autorizado, retirada efectiva en la siguiente consulta y en nuevos accesos al archivo, archivo de un asunto sin perder otro, comandos prohibidos y cookie revocada tras logout. |

Las pruebas viven en `backend/tests/test_aceptacion_*.py`. Incluyen éxitos y
rechazos 400/401/403/404/409/422 según el comando. Las pruebas existentes agregan
aislamiento entre firmas, concurrencia, recuperación de cargas y migraciones.

En navegador con API real se comprobaron la bandeja personal y de equipo, agenda,
listado, formulario de apertura y expediente general. El formulario se abrió y
cerró sin guardar; no se modificaron expedientes de la BD de desarrollo. El
expediente se inspeccionó en escritorio y a 390 px, sin desbordamiento horizontal
del documento ni errores/advertencias de consola capturados. Esto no verifica
gestos en un teléfono físico ni accesibilidad completa. Al cerrar el formulario
con Escape el foco no volvió al botón de apertura: queda pendiente de G03.

No se recorrieron los cuatro roles completos mediante navegador ni participaron
usuarios humanos. G06 y la aceptación de navegador de H03 siguen abiertos.

## Defecto reproducido y corregido

Cuando el administrador era titular del expediente, transferirlo a un abogado
movía el trabajo de la guía pero dejaba sus tareas manuales pendientes en la
bandeja anterior. La consulta del titular saliente solo admitía el rol abogado.

Ahora ambos tipos de titular transfieren su trabajo abierto. Las tareas delegadas
a otros miembros y las completadas/canceladas conservan su responsable. El
recorrido de administración falló antes del cambio; protege esa corrección y la
conservación de referencias tras archivar. No se cambiaron modelos ni dependencias.

## Qué se puede utilizar hoy

- Oficina: clientes, asuntos generales con guía opcional, búsqueda y detalle,
  responsables, tareas delegadas, actividad y publicación autorizada.
- Archivos locales: carga validada, acceso privado, descarga autorizada y
  reintentos recuperables sin duplicar archivo/documento/evento.
- Portal: consulta de los asuntos propios y de la evidencia publicada; los datos
  internos se mantienen fuera de su proyección.
- Administración: equipo, invitaciones, permisos, bajas y transferencia de trabajo.
  La activación y autenticación tienen pruebas; falta aceptar la entrega real del correo.

## Pendientes que afectan al uso de una firma

| Prioridad | Pendiente e implicación | Evidencia / checklist |
| --- | --- | --- |
| Implementado después de esta revisión | Edición de perfiles por administración/secretaría y de título/radicado/fecha del asunto por administración o abogado titular. Incluye conflictos, permisos, sincronización y revocación de acceso cuando cambia correo/identificación. | [Entrega 15 del checklist](CHECKLIST_PRODUCTO_2026-10-14.md#15-corrección-de-clientes-y-asuntos-2026-10-15); E01 y contratos de identidad. |
| Antes del uso diario | Citas independientes: varias reuniones/audiencias, reprogramación, cancelación y participantes. La agenda actual deriva tareas y audiencia del flujo. | `services/agenda_service.py`, `repositories/agenda_repository.py`; F01–F04. |
| Antes de información real | Bitácora protegida de asignaciones, publicaciones y cambios sensibles. La actividad del expediente y los autores conservados no la sustituyen. | B08 y E02/E04. |
| Antes de información real | Publicación privada por defecto en todas las capas y revisión completa de concurrencia. Las nuevas pruebas demuestran defaults privados de las rutas actuales, pero el modelo `Novedad` conserva `default=True`. No se demostró una filtración en esos recorridos. | `models/novedad.py`, `schemas/novedad.py`; E04/B07. |
| Antes de usar archivos externos legados | Los vínculos Google heredados conservan URL del proveedor; retirar el registro de Asuntia no garantiza revocar una URL externa ya obtenida. | `schemas/documento.py:from_documento`, `DocumentosTab.tsx`; D04. |
| Antes de producción | Aceptar instalación completa con HTTPS, proxy, cookies/CORS, pooler PostgreSQL, migraciones y persistencia tras reinicio. Docker/proxy no se ejecutaron en este equipo. | C05, H04–H05. |
| Antes de producción | Ensayar restauración coordinada de BD/archivos y acordar pérdida/tiempo de recuperación. El volumen persistente no demuestra respaldo. | H06. |
| Antes de producción | Aceptar correo real y supervisar fallos; readiness de BD/almacenamiento y alertas operativas. `/health` solo confirma que responde el proceso. | C06, H07. |
| Aceptación final | Recorridos completos con personas de los cuatro perfiles, móvil/teclado y fallos de conexión; restauración accesible de lo archivado aún sin comando público. | G03–G06, B06/H03. |

La corrección de datos existentes ya está incorporada. Siguientes pendientes:
completar citas y su agenda, cerrar auditoría/publicación y ejecutar aceptación de despliegue y
recuperación. La conexión cloud se retoma cuando el usuario lo decida.

## Verificación de esta entrega

| Comprobación | Resultado |
| --- | --- |
| Recorridos nuevos + asignaciones y gestión de tareas | 48 pruebas correctas en 54,75 s después de corregir la transferencia. |
| Backend completo local | 410 pruebas correctas y una omitida en 280,94 s; Redis no está disponible en este equipo. La comprobación omitida sí se ejecuta en CI. |
| Frontend local | 148 pruebas correctas; `npm run build` correcto. |
| GitHub Actions, cambio `b32e512` | 411 pruebas de backend correctas en 116,65 s, con PostgreSQL y Redis reales; build y 148 pruebas de frontend correctos. [Ejecución](https://github.com/Hark0616/Asuntia/actions/runs/38750635300). |
| Navegador / API local | Bandejas, agenda, apertura sin guardar y expediente revisados; escritorio y 390 px, sin errores de consola capturados. API reiniciada con la corrección y `/health` responde 200. |

Avisos no bloqueantes: Vite señala el paquete principal de 500,57 kB; la prueba
con Redis en CI emite una deprecación interna de ARQ por `close()`.
No se añadieron dependencias, modelos ni migraciones.

El checklist conserva sus casillas abiertas hasta cumplir cada criterio completo;
estas simulaciones no cierran G06 ni aceptan por sí solas el despliegue.
