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

## Cierre, expiración y recuperación de sesión

El JWT vence según `ACCESS_TOKEN_EXPIRE_MINUTES`; no se renueva silenciosamente.
`POST /auth/logout` invalida todos los tokens vigentes de esa identidad y elimina
su cookie. Si la cookie ya es inválida o no existe, el cierre sigue siendo 204.
Si falla el cierre por conexión, la interfaz informa el fallo y permite reintentar;
no confirma que el servidor haya cerrado la sesión.

Un 401 de un recurso protegido cancela las consultas, limpia la caché y vuelve
al formulario correspondiente con un mensaje breve. Los errores de contraseña,
OTP y activación permanecen en su formulario. Cada petición lleva una generación
local de sesión: al salir, expirar o ingresar de nuevo, se descartan las respuestas
anteriores para impedir que repueblen la caché o naveguen a datos del usuario
anterior. El JWT permanece en la cookie HttpOnly y no se reintentan mutaciones.
Iniciar sesión de nuevo tampoco reenvía la operación fallida: el usuario revisa
su resultado antes de decidir si corresponde repetirla.

El despliegue de esta revisión exige volver a ingresar: las cookies antiguas sin
`user_revision` ya no autorizan acciones. La revocación se valida en cada petición;
una vista ya abierta detecta cambios externos cuando vuelve a consultar la API.

La evidencia adicional está en `backend/tests/test_busqueda_asuntos.py`,
`backend/tests/test_firma_acceso.py` y las pruebas de `ListaExpedientes`, acceso y
navegación del frontend. `.github/workflows/quality.yml` ejecuta build, pruebas de
ambas aplicaciones y migraciones reales en PostgreSQL 16 desde cada push o PR.

## Autenticación, límites y recuperación

Los presupuestos de autenticación viven en `auth_rate_limits`, separados de las
identidades y expedientes. Cada clave es un HMAC del propósito y la identidad
normalizada o IP; no guarda correo, documento ni dirección en texto. El UPSERT
condicional de PostgreSQL concede cupos atómicamente entre procesos y conserva
los límites al reiniciar la API. Incluye identidades inexistentes de la firma para
que la respuesta de límite no confirme si una cuenta existe.

La ventana predeterminada es de 15 minutos: ocho solicitudes de ingreso de oficina,
tres de OTP, tres de recuperación y doce verificaciones por identidad. El límite
por IP es de 120 solicitudes por propósito y firma. Admitir una solicitud consume
presupuesto aunque sus credenciales sean correctas. La respuesta 429 informa
`Retry-After`, expuesto mediante CORS y traducido por la interfaz al tiempo de
espera. Se usa el peer que entrega el servidor ASGI; no se interpreta directamente
`X-Forwarded-For`. El proxy de despliegue debe limitar tráfico antes de resolver
la firma y configurar explícitamente sus proxies de confianza; C05 sigue abierto.

Emitir y verificar OTP toma primero el bloqueo de firma y luego el del desafío.
Solo existe un código activo por usuario tras una emisión. Cinco códigos errados
agotan el desafío; consumirlo, vencerlo o renovar el código invalida los anteriores.
Emisión, revocación y consumo se confirman como una sola transacción. En desarrollo
se conserva el código local `12345`; staging y producción generan seis dígitos
aleatorios. El vencimiento proviene de `OTP_TTL_MINUTES`, también usado por el
correo y `expires_in_seconds` de la respuesta pública.

`POST /auth/password/request` recibe firma y correo de oficina. La respuesta es
igual para cuentas activas, ausentes, de portal o firmas desconocidas; no devuelve
usuarios ni enlaces. Las solicitudes de acceso aplican el mismo mínimo temporal
de respuesta, y el ingreso verifica un hash de contraseña sustituto cuando no hay
cuenta. El correo individual se despacha después de enviar la respuesta HTTP.

El enlace de recuperación usa un secreto aleatorio de 256 bits y UUID; solo el
HMAC queda en `AuthChallenge` con propósito `office_password_reset`. Vence según
`PASSWORD_RESET_TTL_MINUTES` (30 por defecto). Se construye desde `FRONTEND_URL`,
nunca desde Host u Origin del request. El secreto está en el fragmento del enlace,
se retira del historial al abrirlo y solo se envía al comando de confirmación.
Renovar el enlace invalida el anterior.

`POST /auth/password/confirm` valida firma, propósito, vigencia, intentos y cuenta
de oficina activa. Confirma en una transacción la contraseña Argon2 y el consumo
del enlace; revoca sesiones y otros enlaces de recuperación. No activa usuarios
retirados ni abre una sesión. Elimina la cookie del navegador y la interfaz limpia
su caché antes de volver al ingreso. El administrador que modifica roles o retira
acceso invalida también los desafíos pendientes para que no sobrevivan a una
reincorporación. Una notificación de cambio se manda sin incluir la contraseña.

La política sigue los criterios de respuestas uniformes, tokens aleatorios con
caducidad y un solo uso, y nuevo ingreso después del cambio de la
[guía de recuperación de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
La evidencia de esta implementación está en `test_auth_seguridad.py`,
`test_auth_mail.py` y las pruebas de `RecuperarAcceso` y `App`.

## Correo transaccional de acceso

El transporte usa timeout, hasta dos intentos por defecto y TLS con validación de
certificado (`starttls` o `ssl`) en producción. Usuario y contraseña SMTP se
configuran juntos. Producción exige `FRONTEND_URL` con HTTPS. El vencimiento del
correo y la API proviene de la misma configuración. Los fallos se registran con
propósito, número de intento y categoría de error; nunca destinatarios, códigos,
enlaces, contraseñas ni contenido de excepciones SMTP.
Los parámetros SQL se ocultan también en desarrollo y en excepciones de BD para
evitar que las operaciones de identidad registren correos o hashes de credenciales.

Los correos individuales de autenticación usan `BackgroundTasks` y un thread para
SMTP; no bloquean el event loop ni la respuesta. No es una cola durable: si el
proceso termina antes del envío, el usuario debe solicitar otro enlace o código.
Los envíos masivos siguen reservados a workers. C06 permanece parcial hasta
configurar y verificar un proveedor real y su operación. Las pruebas comprueban
entrega SMTP en un servidor local controlado, TLS previo al login, reintentos y
logs sin secretos; no prueban recepción en bandejas de producción.

## Carga documental acotada

Cada archivo admite hasta 20 MiB y la solicitud multipart completa hasta 21 MiB.
El límite HTTP cuenta los bytes recibidos, incluso sin `Content-Length` o con una
longitud falsa, antes de que multipart termine de escribir el spool. Un exceso
responde 413; una interrupción cierra los temporales del parser. Nginx configura
el mismo máximo de solicitud y 30 segundos de inactividad del cuerpo. La ejecución
real del proxy permanece dentro de la aceptación pendiente del despliegue H05.

La incorporación lee bloques de hasta 64 KiB, rechaza archivos vacíos y comprueba
extensión, MIME y marcadores del contenedor antes de aprovisionar carpetas o
escribir metadatos. Se admiten PDF, PNG, JPEG, GIF, WEBP, DOCX, XLSX y TXT UTF-8
sin controles binarios. Un MIME ausente/genérico puede normalizarse al formato comprobado; uno
específico incompatible se rechaza. Office requiere contenedor OOXML reconocible,
con máximo de 2000 entradas y 100 MiB declarados sin compresión; se rechazan
entradas cifradas, rutas inseguras, VBA, ActiveX y objetos incrustados reconocibles.
HTML, SVG, ejecutables, Office legado/con macros y otros contenedores no están
habilitados en este recorrido. Esta comprobación no
es un antivirus ni una validación estructural completa.

PDF y Office pueden contener acciones y adjuntos: se sirven como descarga, también
los históricos, hasta disponer de inspección asíncrona. Imágenes y texto conservan
previsualización en iframe restringido. Las respuestas autenticadas llevan
`nosniff`, CSP sandbox, política sin referencia y `Cache-Control: private, no-store`.
La interfaz muestra los rechazos de la API y conserva el archivo y los campos para
corregir o reintentar; valida también el tamaño antes de enviar.

El almacenamiento local usa una raíz estable (`LOCAL_STORAGE_PATH`, por defecto
`backend/storage`), comprueba contención tras resolver rutas y no utiliza el nombre
recibido como clave física. Rechaza rutas, controles y nombres reservados. Las
nuevas carpetas incorporan firma y UUID del expediente; cada archivo tiene nombre
aleatorio. La escritura corre en un thread, usa temporal privado y renombre al
terminar, y retira el temporal si falla. Los metadatos de un archivo ausente generan
error en vez de un documento ficticio. La carpeta del expediente, el documento y
su evento se confirman juntos en BD, sin commit intermedio al crear carpetas.

D01 y D03 siguen pendientes de aceptación integral. Las cargas actuales conservan
nombre original y SHA-256; las locales usan claves relativas por firma/asunto y
una intención durable para recuperar reintentos, como se detalla a continuación.
Quedan las referencias absolutas históricas y la reconciliación de pendientes
abandonados. D04 sigue abierto por
las vías cloud heredadas; sus enlaces no tienen todavía el contrato de acceso
privado que exige el núcleo. Este bloque no amplía la integración de proveedores.

### Recuperación de cargas locales (2026-10-15)

El cargador envía `operation_id` UUID junto al archivo validado. PostgreSQL guarda
primero la intención, ligada a firma, asunto y usuario, con huella de contenido y
campos. Solo entonces se escribe en `documentos/<firma>/<asunto>/<operación>.<ext>`
dentro de la raíz privada. Esta clave nueva es relativa y puede conservarse al
trasladar la raíz; las referencias absolutas anteriores siguen siendo legibles
en su ubicación existente y no se migran implícitamente.

Repetir UUID y solicitud recupera el mismo documento; otro contenido, nombre,
tipo, visibilidad o asunto produce 409. La firma se bloquea y la sesión y el
acceso al asunto se revalidan antes de escribir. El documento, su evento y la
confirmación de la operación se guardan juntos. La pérdida de confirmación del
commit se resuelve consultando el resultado real. Una operación iniciada conserva
el destino local aunque luego cambie el predeterminado.

La escritura y la comprobación SHA-256 se ejecutan en threads con lecturas
acotadas. Un archivo ya escrito se verifica y reutiliza sin sobrescribirlo; un
temporal interrumpido se puede rehacer. No se borra el original para compensar
un error de BD cuyo resultado sea incierto. Si falla la incorporación, el archivo
no aparece en la lista ni en actividad hasta completar ambos registros. Si el
documento ya fue archivado, o su archivo falta o cambió, repetir la carga no lo
recrea ni inventa un éxito.

La carga local devuelve 201 con el documento y no necesita Redis. Los trabajos
locales no se despachan al worker cloud. Un fallo recuperable devuelve 503 y el
formulario conserva datos y UUID para repetir explícitamente la solicitud. Los
pendientes se pueden recuperar durante 24 horas; los resultados confirmados
conservan su deduplicación. Los clientes anteriores que no envían UUID siguen
admitidos, pero no pueden recuperar una respuesta perdida sin ese identificador.
La consulta autenticada de la operación devuelve solo estado y UUID del documento.

No hay eliminación automática de originales ni de pendientes abandonados: esa
reconciliación y las referencias históricas siguen abiertas en D01/D03. El contrato
no sustituye respaldos ni verifica por sí solo la persistencia ante un fallo del disco.

## Decisión de almacenamiento por firma (2026-10-15)

**Implementación incorporada; pendiente de aceptación con la cuenta real:** la primera
firma ya trabaja en **OneDrive personal**, confirmado por el usuario. Local y
OneDrive deben resolver el recorrido documental de esta entrega; Google Drive podrá incorporarse mediante otro
adaptador. OneDrive personal dispone de autorización delegada, conexión persistente,
selección de carpetas y operaciones mediante ARQ. La guía de instalación y los
límites de aceptación están en [Almacenamiento OneDrive](ALMACENAMIENTO_ONEDRIVE.md).

- Local significa almacenamiento privado persistente del servidor de Asuntia,
  independiente de la carpeta sincronizada de un PC del equipo.
- La conexión se configura y autoriza por firma. Debe permitir elegir una carpeta
  existente y vincular sus archivos sin copiar ni reorganizar el archivo histórico.
  Las nuevas cargas usan el destino configurado, con límites y controles comunes.
- Cada documento conserva su UUID propio en Asuntia y la referencia a la conexión,
  cuenta y proveedor donde vive. Para OneDrive, la referencia comprende unidad y elemento
  (`drive_id` e `item_id`); la ruta y el nombre son metadatos. Un cambio de destino
  predeterminado no cambia la referencia de documentos ya incorporados. Reconectar
  otra cuenta no debe reinterpretar referencias previas como archivos de esa cuenta.
- El contrato común debe contemplar guardar, vincular, consultar metadatos y leer
  contenido autorizado, además de errores, integridad y estados recuperables. Un
  adaptador no debe inventar metadatos ni éxito cuando el proveedor está ausente.
- Asuntia conserva las relaciones con asunto/tarea/novedad y sus reglas de acceso.
  El proveedor conserva el archivo. Vincularlo no lo publica ni reproduce por
  defecto sus enlaces compartidos o sus permisos dentro del portal del cliente.
- Las credenciales quedan cifradas y accesibles solo al backend. Lecturas pesadas,
  exploración masiva y transferencias remotas se ejecutan mediante workers; la
  API expone estados y resultados, no bloquea el request esperando toda la operación.
- El acceso del portal se valida en Asuntia; no se entregan URLs preautorizadas del
  proveedor como sustituto de ese control. Desconectar o vencer la autorización
  debe mostrar un estado recuperable y permitir reconexión, sin desviar archivos
  a local en silencio ni publicar archivos pendientes de revisión.

La incorporación debe definir el comportamiento ante cambios externos, archivos
ausentes, permisos retirados y cambios de unidad/cuenta, sin prometer sincronización
en tiempo real. La sincronización completa de carpetas, migraciones automáticas
entre proveedores, edición colaborativa y versionado no se incorporan por esta
decisión. La primera conexión debe usar autorización delegada de la cuenta personal
existente, con renovación y revocación de credenciales. Elegir una carpeta delimita
el alcance operativo de Asuntia; no debe presentarse como un permiso de Microsoft
limitado a esa carpeta sin verificar que la autorización concedida lo sea.
La lectura comprueba el SHA-256 del contenido aprobado. Un cambio externo bloquea
la descarga; revisar cambios actualiza los metadatos y devuelve el documento a
privado, para publicarlo de nuevo mediante la acción existente. No se guardan versiones.
Falta verificar la autorización real y titularidad de la carpeta; ninguna cuenta
real ha sido conectada durante la implementación.

Referencias técnicas: Microsoft Graph distingue unidad y elemento y soporta
[OneDrive, OneDrive for Business y bibliotecas SharePoint](https://learn.microsoft.com/en-us/graph/api/resources/onedrive?view=graph-rest-1.0).
El [acceso por ID](https://learn.microsoft.com/en-us/graph/onedrive-addressing-driveitems)
conserva la referencia ante renombres y movimientos dentro de la unidad; las rutas
no ofrecen esa estabilidad. Las [descargas de contenido](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
se resuelven en el adaptador y no definen la identidad ni los permisos de Asuntia.
