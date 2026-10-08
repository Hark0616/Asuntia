# Plan funcional para el piloto de Asuntia

Fecha: 4 de octubre de 2026. Base examinada: `3801961`, rama `codex/mejoras-operacion-juridica`.

Este documento propone trabajo futuro. Las funciones descritas como pendientes todavía no están implementadas. Sustituye, para el siguiente ciclo, la prioridad de ampliar el repositorio con versionado documental.

Antes de implementarlo, revisar la [propuesta UX/UI del 8 de octubre](PROPUESTA_UX_PILOTO_2026-10-08.md), que concreta navegación, pantallas y recorridos por rol. Su estado es propuesta; incluye ajustes de interacción y alcance de agenda para la secretaria que deben resolverse junto con este plan.

## 1. Resultado que debe permitir el piloto

Una secretaria abre o asigna un expediente; su abogado encuentra el trabajo, registra lo ocurrido, incorpora documentos y programa reuniones o audiencias. El jefe consulta y ayuda a repartir la carga. El cliente entra y ve únicamente los avances y documentos autorizados de su expediente.

El piloto se plantea para una firma y un equipo pequeño, manteniendo el aislamiento entre firmas que ya existe. No necesita aceptar/rechazar asignaciones, versiones de archivos, generación con IA, sincronización con calendarios externos, mensajería ni cómputo automático de términos.

Conservaremos el control de ediciones simultáneas ya implementado: evita que dos personas se sobrescriban. No constituye un sistema de versiones documentales ni añade pasos al uso normal.

## 2. Estado actual y decisiones de alcance

| Recorrido | Situación comprobada | Decisión para el piloto |
| --- | --- | --- |
| Abrir un caso | Funciona con cliente existente o nuevo; se impone una ruta de siete pasos de insolvencia. | Incorporar seguimiento libre como opción inicial, con título reconocible; conservar la guía existente como opción específica. |
| Secretaria asigna | Puede asignar al abrir; después solo reasigna el administrador. | Permitirle asignar y reasignar asuntos existentes de su firma, conservando trazabilidad. |
| Documentos | Carga, búsqueda, archivo y visibilidad funcionan. | Consolidar almacenamiento persistente y apertura/descarga; no incorporar versiones. |
| Recorrido del caso | Se guardan respuestas de pasos, pero la vista de pasos cerrados no las muestra. | Mostrar lo registrado y una cronología de actuaciones, con acceso a soportes. |
| Cliente informado | Ve notas publicadas y documentos compartidos; no recibe el checklist interno. | Presentar esa historia autorizada como recorrido del caso, sin una segunda captura. |
| Agenda | Lista vencimientos y una fecha de audiencia por ruta. Sus enlaces abren el expediente. | Incorporar varias citas por asunto, acceso a la reunión y resumen; mantener vencimientos separados de citas. |
| Calendario | No existe vista de calendario. | Añadir mes y selección de día sobre los mismos datos de la agenda. |
| Acceso real | Hay autenticación, pero el frontend usa firma `demo`; el entorno local usa OTP fijo. | Configurar identidad de la firma, usuarios reales, correo y almacenamiento antes de admitir usuarios del piloto. |

## 3. Registro de casos nuevos

### Funcionamiento propuesto

1. Desde «Abrir asunto», elegir un cliente existente o crearlo en el mismo recorrido.
2. Solicitar título del asunto, cliente, responsable y fecha de apertura. El código interno sigue siendo automático; el radicado oficial se registra cuando existe.
3. Ofrecer «Seguimiento libre» por defecto. La guía de insolvencia queda como opción explícita compatible con ese tipo de asunto, sin asignarla automáticamente a una sociedad.
4. Al abogado se le asigna su propio caso; secretaria y administrador pueden seleccionar un responsable activo de la firma.
5. Abrir inmediatamente el expediente creado, desde donde ya se pueden agregar documentos, actuaciones, tareas y citas.

**Por qué:** la apertura debe registrar trabajo real aunque el procedimiento no coincida con la plantilla actual. Un título permite reconocer el caso; el código conserva su identificación. Crear un cliente dentro de la apertura evita repetir datos en dos módulos.

### Cambios previstos

- Reutilizar `AperturaAsuntoModal`, `Asunto` y la apertura transaccional existente.
- Añadir título del asunto y soportar la modalidad de seguimiento libre. La ruta persistida determina si hay pasos; no crear una segunda bandera que diga lo mismo.
- En seguimiento libre, no crear siete pasos ni una tarea ficticia para completarlos. Mostrar accesos a las acciones del expediente cuando aún no hay actividad.
- Mantener los asuntos existentes y su información; no convertirlos automáticamente ni inferir títulos o hechos procesales.
- Una fecha de apertura anterior permite incorporar un caso en curso. Su historia se registra con actuaciones fechadas, sin completar artificialmente una ruta.

**Listo cuando:** abogado abre su caso; secretaria abre uno para otro abogado; el caso aparece bajo el responsable correcto; se puede trabajar sin una ruta predeterminada; errores o doble envío no dejan cliente y expediente a medias ni crean duplicados.

## 4. Asignación por secretaria y recepción del abogado

### Funcionamiento propuesto

- La secretaria ve el responsable actual, elige el nuevo y guarda la asignación desde el expediente.
- El caso aparece de inmediato en la lista del abogado. «Mis asuntos» muestra todos sus asuntos, incluidos los que aún no tienen tareas; «Mi trabajo» muestra pendientes.
- No se añade una aceptación obligatoria: recibir una asignación ya permite trabajar. La dirección puede corregir la distribución.
- En una reasignación, pasos y trabajo abierto propio del abogado saliente pasan al nuevo responsable. Las tareas delegadas a la secretaria u otro administrador conservan su asignación.
- Registrar internamente quién reasignó, cuándo y entre qué responsables. El evento se deriva de la operación; nadie tiene que volver a escribirlo como nota.
- La secretaria conserva capacidad operativa, pero publicar al cliente y completar decisiones de la guía siguen siendo acciones del responsable o administrador.

**Por qué:** la asignación forma parte de la coordinación cotidiana que el usuario espera de la secretaria. Un circuito de aceptación añadiría un estado y una espera sin aportar valor al piloto. La transferencia debe impedir trabajo abandonado o acceso persistente del abogado saliente.

### Cambios previstos

- Extender la autorización de la asignación de asuntos en API y UI; reutilizar `AsignacionService` y sus bloqueos transaccionales.
- Validar responsable activo y misma firma; conservar las reglas que impiden al abogado repartirse casos ajenos.
- Invalidar las listas del expediente, asuntos, trabajo y agenda tras el cambio. Ante otra reasignación simultánea, mostrar conflicto antes de sobrescribir.
- Registrar un evento privado en el historial existente, sin un módulo nuevo de auditoría. El responsable del cliente y el del asunto siguen siendo conceptos distintos: reasignar un expediente no modifica los demás del cliente.

**Listo cuando:** secretaria asigna un caso existente, el nuevo abogado accede y el anterior pierde el acceso que ya no le corresponde; no quedan tareas propias bajo el responsable saliente; otra firma, un cliente o un usuario inactivo no pueden intervenir.

## 5. Documentos para el trabajo diario

### Funcionamiento propuesto

- Cargar desde el expediente, indicando un nombre reconocible y tipo de documento.
- Mantener la carga privada por defecto. Abogado o administrador decide compartirla con el cliente.
- Ofrecer «Ver» y «Descargar». Si el navegador no puede previsualizar un formato, permitir la descarga sin presentar un visor vacío como éxito.
- Conservar búsqueda por nombre y tipo y una organización sencilla. En asuntos libres, evitar obligar a clasificar un documento dentro de una fase exclusiva de insolvencia.
- Archivar documentos cargados por error. Una nueva carga es un documento nuevo; no habrá reemplazos ni árbol de versiones.

**Por qué:** el piloto necesita encontrar y abrir los soportes, antes que reproducir todas las funciones de Drive. Compartir debe ser una decisión explícita, y la persistencia del archivo debe sobrevivir a reinicios y despliegues.

### Cambios previstos

- Reutilizar `DocumentoAsunto`, `DocumentosTab`, el proveedor local y las comprobaciones de acceso existentes.
- Para este piloto, usar un volumen persistente en el servidor, con copia de seguridad probada de archivos y BD. Mantener descargas a través de FastAPI; no exponer una carpeta pública del servidor.
- Validar nombre seguro, archivo no vacío, formatos admitidos y tamaño máximo. Propuesta inicial: PDF, imágenes y documentos de oficina, hasta 20 MB por archivo, con límite configurable.
- Evitar cargar un archivo ilimitado en memoria; cancelar correctamente una subida fallida y comprobar que archivo y metadatos no queden desincronizados.
- Las integraciones cloud existentes quedan fuera del recorrido obligatorio: hoy la previsualización del backend no cubre esos archivos y sus enlaces dependen de permisos externos.

**Listo cuando:** un PDF y un documento de oficina se cargan, consultan y descargan; un archivo privado no es accesible por el cliente aunque conozca su ID; los archivos permanecen después de reiniciar; una carga inválida falla sin crear un documento aparente.

## 6. Estado, recorrido y resumen del expediente

### Funcionamiento propuesto

La cabecera muestra título, cliente, abogado y estado del expediente. Debajo, un resumen derivado: última actuación, próximo pendiente y próxima cita. Si no existen, se indica su ausencia sin inventar una siguiente acción.

La historia del caso se registra mediante actuaciones: título, contenido, fecha del hecho cuando se conoce y soportes vinculados. También conserva la fecha y el autor del registro. La secretaria puede capturar; el abogado revisa y decide qué compartir.

Los pasos ya completados se despliegan para consultar sus respuestas, fecha de finalización y responsable. El recorrido libre usa la cronología y las tareas; la guía utiliza además sus pasos. No hay porcentaje automático de «éxito» del caso.

**Por qué:** saber lo que se escribió importa más que saber que una casilla fue completada. La fecha de un hecho y la de su registro pueden ser diferentes, especialmente al incorporar casos antiguos. El resumen debe aprovechar lo existente para evitar otro campo que alguien tenga que mantener actualizado.

### Cambios previstos

- Mostrar `AsuntoPaso.datos` usando sus definiciones de campos, con etiquetas y valores legibles; no mostrar JSON ni exponer datos internos al cliente.
- Reutilizar `Novedad` para actuaciones y notas. Incorporar fecha del hecho opcional; no convertir automáticamente fechas de registro antiguas en fechas procesales.
- Permitir relacionar una actuación con documentos ya cargados, mediante referencias, sin duplicar archivos ni solicitar otra carga.
- Filtrar en la cronología actuaciones, documentos y cambios operativos. Los eventos derivados se generan desde su origen.
- Para corregir un hecho ya publicado, registrar una aclaración vinculada; no sobrescribir silenciosamente la historia que el cliente ya recibió. No se construye un editor con historial de versiones.

**Listo cuando:** un abogado retoma un caso y puede identificar qué ocurrió, cuándo, con qué soporte y qué sigue; puede leer las respuestas de un paso completado; un caso libre no exige inventar pasos jurídicos para registrar actividad.

## 7. Avances y documentos visibles para el cliente

### Funcionamiento propuesto

- El cliente entra con su identificación y un código recibido por correo, y selecciona su asunto si tiene varios.
- Ve el último avance autorizado y una cronología de avances anteriores: ese es el recorrido público del caso.
- El abogado publica la misma actuación registrada en el expediente, sin redactar un segundo informe para el portal. Puede retirar su visibilidad sin borrar el registro interno.
- Los formularios, instrucciones y borradores internos permanecen privados. El estado de un checklist no se comunica automáticamente como un hecho del procedimiento.
- «Compartido con el cliente» significa acceso al cliente autenticado de ese asunto; no significa archivo público en Internet.
- Una nota puede referenciar un documento privado, pero el portal solo ofrece el enlace cuando el documento también está compartido. Publicar una nota no publica por accidente todos sus adjuntos.

**Por qué:** el cliente necesita una historia comprensible y veraz, mientras la firma necesita capturar trabajo provisional. Publicar contenido existente mantiene una sola fuente de información. La autorización del documento debe ser explícita y comprobada también al descargarlo.

### Cambios previstos

- Extender las proyecciones públicas actuales solo con los campos autorizados necesarios para la cronología y los soportes compartidos.
- Conservar los filtros por firma, asunto, cliente, actividad y visibilidad en todas las lecturas y descargas.
- Mantener y comprobar la conexión entre perfil del cliente y usuario del portal. Añadir habilitación de acceso para clientes existentes cuando falte, sin crear otro perfil del mismo cliente.
- Mostrar dentro de la oficina qué contenido está compartido. La revisión previa utiliza la proyección pública; no simula datos diferentes de los que recibirá el cliente.

**Listo cuando:** una nota interna no aparece; al publicarla aparece el mismo texto; al retirarla deja de estar disponible; los documentos privados, archivados o de otro cliente nunca se entregan por API. Publicar una actuación con un soporte privado no expone ese soporte.

## 8. Reuniones y audiencias: una captura reutilizada

### Funcionamiento propuesto

Desde el expediente se registra una cita de tipo «Reunión» o «Audiencia»: título, inicio, fin opcional, modalidad, enlace de ingreso o lugar, y objetivo/contexto opcional. Se pueden registrar varias citas por asunto, sin depender de alcanzar un paso de la guía.

Cada cita admite estado «Programada», «Realizada» o «Cancelada». Reprogramar cambia su fecha con una anotación interna derivada. Realizarla permite registrar un resumen de lo ocurrido; cancelarla la conserva en el historial y la retira de las próximas citas.

Secretaria, responsable y administrador pueden programar según su acceso al asunto. Para mantener el alcance pequeño, el responsable de la cita se deriva del abogado del expediente; no se incorpora un gestor de invitados, disponibilidad o múltiples calendarios personales.

**Por qué:** una reunión es un evento a una hora concreta; una tarea es trabajo que vence. Reutilizar una tarea como reunión confundiría completado, cancelación y vencimiento. Además, una audiencia puede repetirse o reprogramarse, cosa que una sola fecha dentro de una ruta no representa.

### Cambios previstos

- Crear una entidad pequeña `Cita`, vinculada obligatoriamente al asunto y heredando firma, fechas de registro, autor y borrado lógico. Añadir repositorio, servicio, DTOs y tipos de frontend.
- Guardar instantes con zona horaria y presentar la agenda del piloto en hora de Colombia, etiquetada. No convertir fechas sin informar el criterio; validar fin posterior al inicio.
- Validar enlaces HTTP/HTTPS. «Ingresar» abre el enlace en otra pestaña; no consulta ni descarga automáticamente su contenido. Una cita presencial muestra dirección y una virtual sin enlace muestra «Sin enlace».
- El resumen de la cita reutiliza una `Novedad` vinculada por ID: una sola captura, editable internamente y publicable con las mismas reglas del resto de avances. Nace explícitamente privada, incluso si la registra el abogado; publicar es una acción separada. La cita no guarda otra copia del mismo resumen.
- Cuando una audiencia tiene un resultado estructurado ya capturado por la guía, conservarlo en la cita y consultarlo desde el paso. No ampliar el catálogo de resultados jurídicos en este hito ni pedir el mismo resultado en dos formularios.
- Migrar la audiencia existente: fecha/modalidad/enlace del paso de agenda y, cuando exista, resumen del paso de resultado se relacionan con una cita. Los pasos pasan a consultar esos datos por referencia; se retira su captura independiente.
- Trasladar también `resultado_audiencia.datos.resultado` y la confirmación `audiencia_agendada.datos.audiencia_realizada`. Adaptar la validación del workflow para consultar la cita: no debe seguir exigiendo claves JSON que ya no se capturan. Una confirmación legada válida sí puede acreditar que se registró como realizada; una fecha por sí sola no.
- La migración usa una referencia única al origen para no duplicar citas si se reintenta. No marcar como realizada una audiencia solo porque tiene fecha. Fechas o enlaces inválidos se preservan para revisión, sin inventar valores ni perder la captura anterior.

**Listo cuando:** se pueden crear dos audiencias y una reunión para el mismo asunto; reprogramar actualiza todas las vistas; cancelar no borra la historia; el enlace abre la reunión; registrar un resumen lo muestra en la cita y solo llega al cliente si se publica.

## 9. Agenda, calendario y resumen de trabajo

### Funcionamiento propuesto

- «Mi agenda» ofrece lista y calendario mensual. Ambos muestran las mismas citas y vencimientos; seleccionar un día abre su detalle.
- Agenda, calendario y detalle de citas son exclusivos de la oficina, también en la API. Publicar el resumen entrega al portal únicamente la actuación autorizada; no publica automáticamente el enlace de reunión ni el contexto interno de la cita.
- La lista ofrece «Hoy», «Próximos 7 días» y un intervalo personalizado. La dirección conserva «Equipo» y puede filtrar por abogado.
- Cada evento muestra asunto, cliente, fecha/hora, tipo, estado y responsable. Las citas ofrecen «Ingresar» o lugar, «Ver detalle» y «Abrir expediente» como acciones diferentes.
- El detalle reúne objetivo, resumen registrado y documentos vinculados. Una cita sin resumen muestra esa situación; no genera texto con IA.
- El resumen superior muestra próximas citas, tareas vencidas y trabajo pendiente a partir de los datos consultados. Los vencimientos se distinguen visualmente de las reuniones.
- En móvil, la lista será la vista inicial; el calendario permitirá seleccionar un día sin comprimir todas las acciones dentro de una celda.

**Por qué:** el calendario sirve para ubicarse en el tiempo; la lista permite actuar y leer contexto. Distinguir «abrir expediente» de «ingresar a reunión» resuelve la carencia actual sin obligar a buscar un enlace dentro de un formulario.

### Cambios previstos

- Extender `AgendaService` para reunir citas y vencimientos, manteniendo las autorizaciones existentes. La UI no construye una agenda consultando tablas directamente.
- La cita es la fuente de fecha/enlace y la nota vinculada es la fuente del resumen. La respuesta de agenda es una proyección; no se crea una tabla adicional de calendario.
- Incorporar filtros por responsable, intervalo y tipo. Añadir paginación en servidor: si un período supera el límite, el calendario no puede presentarse como completo ocultando eventos.
- Los contadores se calculan sobre todo el intervalo autorizado, no sobre la primera página. Reutilizar los componentes actuales y CSS con tokens; sin arrastrar eventos para reprogramar en este piloto.
- No integrar Google/Outlook, recurrencias ni alertas automáticas. Los enlaces existentes de Meet, Teams o Zoom se pueden pegar y abrir sin una integración con sus cuentas.

**Listo cuando:** lista y calendario coinciden; una reprogramación mueve el evento y no deja una copia; el abogado solo ve sus asuntos; dirección ve el equipo; una fecha con más elementos que el límite puede consultarse completa; enlaces, cancelaciones y resumen funcionan también en móvil.

## 10. Prueba completa y preparación para usuarios reales

### Recorrido de aceptación

1. Secretaria crea un cliente con portal y un asunto libre para el abogado A.
2. Abogado A entra y lo encuentra, aunque todavía no tenga tareas; sube un PDF privado y registra una actuación.
3. Secretaria captura otra actuación y programa una reunión; abogado revisa y publica una nota y un documento.
4. Cliente recibe un OTP real, entra y consulta exactamente lo autorizado. Se verifica además que no puede abrir un documento privado ni el asunto de otro cliente.
5. Abogado consulta lista y calendario, ingresa por el enlace y registra el resumen de la reunión.
6. Secretaria reprograma una segunda cita y después reasigna el asunto al abogado B. La agenda cambia una sola vez y la transferencia respeta trabajo propio y delegado.
7. Dirección consulta el conjunto. Dos usuarios editan a la vez y el segundo recibe un conflicto recuperable, sin pérdida silenciosa de información.
8. Reiniciar la aplicación y restaurar una copia de prueba; comprobar que documentos, citas e historial siguen vinculados.

**Por qué:** probar botones aislados no demuestra que la oficina pueda trabajar. Este recorrido prueba los relevos entre personas, la única captura de cada dato y la información que llega al cliente.

### Condiciones para abrir el piloto

- Sustituir `firma_slug: 'demo'` por configuración de la firma del piloto; crear usuarios de oficina y clientes sin depender del seed de demostración.
- Configurar dominio, HTTPS, cookies, CORS y secretos fuera de Git según las reglas del proyecto.
- Usar OTP aleatorio y correo transaccional real. La API actual captura fallos SMTP sin mostrarlos: añadir registro operativo y manejo de entrega fallida sin revelar si un documento de identidad existe. Respetar caducidad, intentos y uso único.
- Evitar SMTP bloqueante dentro de la petición: adaptar el envío a I/O asíncrona; reservar la cola para cargas pesadas o masivas. No introducir una cola solo para generar PDFs o notificaciones que este piloto no necesita.
- Configurar volumen persistente, copias de BD y archivos, y comprobar una restauración. No abrir el piloto usando solo una carpeta efímera del proceso.
- Entregar una guía corta por rol y registrar incidencias con reproducción concreta. Propuesta de muestra: una secretaria, dos abogados, dirección y un pequeño grupo de clientes; empezar con casos de prueba antes de incorporar expedientes reales.

No se fija una fecha de lanzamiento antes de comprobar correo, almacenamiento y el recorrido completo. El despliegue se prepara como una entrega específica una vez cerradas estas condiciones.

## 11. Orden de implementación y entregas a Git

| Hito | Entrega concreta | Dependencias y motivo del orden |
| --- | --- | --- |
| P1 | Apertura libre, título del asunto y asignación por secretaria. | Resuelve entrada y distribución; los siguientes recorridos necesitan casos utilizables. |
| P2 | Respuestas históricas, actuaciones con fecha y soportes, resumen derivado y cronología pública. | Crea una historia consultable sin duplicarla y ofrece el mecanismo reutilizable para resumir citas. |
| P3 | Citas múltiples con enlace, estados, resumen vinculado y migración de audiencias existentes. | Establece la fuente de los datos antes de diseñar el calendario. |
| P4 | Agenda con detalle e ingreso, calendario mensual, filtros y paginación. | Consume P3; no construye una segunda captura de reuniones. |
| P5 | Carga documental consolidada, acceso real al portal, configuración de firma, correo y copias. | La preparación de infraestructura puede avanzar en paralelo; la verificación integrada requiere los recorridos anteriores. |
| P6 | Ensayo por roles, correcciones, guía de uso y preparación del entorno piloto. | Solo se considera listo cuando las personas pueden completar el circuito de principio a fin. |

Cada hito tendrá commits coherentes de implementación y pruebas, seguidos de documentación de alcance verificado. Se suben a la rama de trabajo tras pasar sus controles; un commit o un PR no equivale a un despliegue aprobado.

## 12. Reglas técnicas y definición de terminado

- Toda persistencia pasa por repositorios con firma y actividad; autorización también en servidor, no solo ocultando botones.
- Cualquier cambio de modelo incluye DTO Pydantic, interfaz TypeScript y migración Alembic autogenerada y revisada. El traspaso de audiencias requiere un backfill explícito dentro de una migración versionada, con prueba de datos anteriores y conservación de referencias.
- No borrar registros de negocio físicamente. Las operaciones relacionadas se guardan juntas y las consultas cargan sus relaciones sin N+1.
- Antes de cerrar cada hito: `pytest`, `npm run build` y pruebas de frontend correspondientes. Casos mínimos: éxito, datos inválidos, sesión ausente, permisos, otra firma, datos archivados y conflicto de edición cuando aplique.
- Para citas y calendario: fechas con zona, límites de día/mes, dos citas el mismo día, cancelación, reprogramación, datos legados y más resultados que una página.
- Para publicación: nota interna, publicación, retiro y descarga directa por ID; el cliente no puede conseguir información privada mediante otra ruta de API.
- Verificación visual acotada en escritorio y móvil, más recorrido real entre los roles. Un error de consulta no se representa como ausencia de datos.

## 13. Fuentes revisadas y límites de este plan

La propuesta se apoya en `asuntos.py`, `documentos.py`, `auth.py`, `AsignacionService`, `WorkflowService`, `AgendaService`, los modelos `Asunto`, `AsuntoPaso`, `Tarea`, `Novedad`, el proveedor local y las vistas de apertura, flujo, portal y agenda. Hubo una revisión paralela de arquitectura y de UX, enfocada en reducir capturas duplicadas y mantener pequeño el piloto. La decisión de habilitar reasignación a la secretaria responde al recorrido solicitado por el usuario, por encima de la restricción administrativa anterior. Se elige mes y lista, sin añadir una vista semanal, para contener el alcance.

Es un plan funcional y técnico, no una validación de las rutas jurídicas de cada especialidad. La guía de insolvencia existente requiere su revisión específica antes de promoverla como una guía exhaustiva; el seguimiento libre permite trabajar sin prometer esa cobertura.
