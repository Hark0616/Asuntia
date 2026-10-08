# Propuesta UX/UI para el piloto de Asuntia

**Fecha:** 8 de octubre de 2026. **Base revisada:** `7d71a1c`, rama `codex/mejoras-operacion-juridica`.

**Estado:** propuesta para revisión, anterior a la implementación. Complementa el [plan funcional del piloto](PLAN_PILOTO_2026-10-04.md); no describe funciones ya entregadas ni cambia todavía la interfaz. Los ejemplos de pantalla usan datos ficticios.

La [evaluación de seis especialistas y filosofía UX](FILOSOFIA_UX_EVALUACIONES_2026-10-08.md) fundamenta los refinamientos incorporados aquí: continuidad dentro del expediente, herramientas visibles, instrucciones operativas, foco y recuperación. Este documento sigue siendo la especificación de pantallas; el informe conserva el razonamiento y las diferencias entre evaluadores.

## 1. Decisión de producto

Asuntia debe sentirse como un lugar de trabajo compartido: encontrar un expediente, entenderlo y actuar desde ahí. El abogado conserva el control profesional; la secretaria puede organizar y capturar; el jefe puede consultar y distribuir; el cliente recibe una vista sencilla de lo autorizado.

La dirección recomendada es **minimalismo operativo**: pocas decisiones por pantalla, acciones reconocibles, información suficiente y detalle disponible cuando se necesita. El principal cambio es de organización, no de color.

Tomamos de la referencia Apple la jerarquía, las etiquetas consistentes, la legibilidad y el cuidado de las interacciones. Sus guías recomiendan usar alineación para comunicar jerarquía y lenguaje orientado a acciones para facilitar la navegación. La aplicación concreta a Asuntia es una propuesta propia. Fuentes: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) y [Writing](https://developer.apple.com/design/human-interface-guidelines/writing).

Conservamos la identidad verde y sobria del producto. La dirección no necesita imitar ventanas de macOS ni añadir transparencias, animaciones decorativas o gestos exclusivos de Apple. Es una aplicación web que debe funcionar igualmente bien en Windows, Android y dispositivos Apple.

**Supuesto de uso pendiente de confirmar:** oficina principalmente en computador; cliente principalmente en celular. Todo el circuito del equipo también debe poder completarse en móvil. La propuesta puede ajustarse si el trabajo de oficina resulta ser mayoritariamente móvil.

## 2. Qué se revisó y qué se encontró

Se revisaron el plan funcional, PRODUCT.md, las rutas y composición de App, apertura, asignación, guía, tareas, agenda, documentos, actividad, portal, acceso, configuración y contratos públicos. Dos revisiones paralelas cubrieron operación por roles y portal/móvil. También se inspeccionaron capturas existentes de agenda, tareas y portal. Estas capturas corresponden a la implementación anterior al plan; no representan el diseño propuesto.

Es una auditoría de código y de interfaz, no una prueba de usabilidad con personas. Las mejoras esperadas son hipótesis que se comprobarán con el ensayo de la sección 16.

| Situación actual | Efecto probable | Cambio recomendado |
| --- | --- | --- |
| Se elige cliente antes de llegar a su asunto. | Se busca por la estructura del sistema, aunque se recuerde el caso. | Lista principal de expedientes, buscable por asunto y cliente. |
| Estado editable, guía, tareas, documentos y notas aparecen en una secuencia larga. | Conocer la historia exige atravesar controles de edición. | Separar Resumen, Documentos y Actividad. |
| La guía de insolvencia domina el expediente. | Parece obligatorio seguir siete pasos para cualquier caso. | Seguimiento libre inicial; guía solo cuando corresponda. |
| Los casos reciben el mismo nombre visual de insolvencia. | Se distinguen por código y contexto, con poca identidad propia. | Título reconocible capturado al abrir. |
| La agenda vive dentro de Mi trabajo. | Cuesta localizarla y conservar el punto de navegación. | Agenda como destino con URL y filtros propios. |
| Abrir una fecha conduce al expediente, no al enlace de audiencia. | La acción urgente requiere buscar de nuevo. | Ingresar, Ver cita y Abrir expediente como acciones distintas. |
| La apertura muestra datos complementarios del cliente de inmediato. | Registrar un caso sencillo parece una ficha administrativa extensa. | Datos esenciales primero; Más datos opcional. |
| Cambiar el selector de responsable guarda inmediatamente. | Se puede transferir al explorar opciones. | Seleccionar y Guardar asignación explícitamente. |
| Documentos usa carpetas y tipos propios de insolvencia. | Un asunto libre debe adaptar su material a una ruta ajena. | Lista general con tipo y búsqueda; categorías jurídicas opcionales. |
| Compartir documentos depende de un icono que cambia visibilidad. | La consecuencia puede pasar inadvertida. | Acción rotulada y revisión breve del destinatario. |
| El portal ya separa contenido autorizado del trabajo interno. | Existe una base adecuada para una consulta sencilla. | Conservar esa separación y mejorar identificación y lectura. |
| Acceso y configuración muestran referencias al entorno demo y a proveedores técnicos. | Se mezcla operación diaria con preparación del sistema. | Entrada con identidad de la firma; configuración fuera del trabajo cotidiano. |

Hay además un problema de orientación en el manejo actual de selección: una URL de asunto no encontrado puede conservar el asunto seleccionado anteriormente. La propuesta exige una pantalla de no disponible; nunca reutilizar silenciosamente otro expediente.

## 3. Navegación: tres lugares estables

```text
OFICINA
Trabajo              Qué necesito atender
Expedientes          Dónde está el caso y qué contiene
Agenda               Qué ocurre, cuándo y cómo ingresar

Dentro de Expedientes: Directorio de clientes
En el menú de usuario: Cuenta, configuración autorizada y salir

CLIENTE
Su asunto → avances y documentos compartidos
Selector de asunto únicamente cuando tiene varios
```

Los tres destinos de oficina mantienen nombre y posición para abogado, secretaria y jefe. Cambian los datos y permisos, no el mapa de la aplicación. Cada pantalla muestra claramente su alcance: mis expedientes, mis tareas o equipo, según corresponda.

En escritorio, barra lateral estrecha con icono y texto. La lista de clientes deja de ocupar esa barra. En móvil, navegación inferior de tres destinos con texto, respetando el área segura y sin tapar los botones del contenido. El cliente no recibe la navegación interna.

Cada destino, pestaña de expediente, filtro de alcance y detalle importante tiene un enlace estable. Volver conserva búsqueda, filtros y posición. Una actualización de datos conserva el contexto. El filtro «Expediente: …» debe verse cuando Trabajo o Agenda están acotados a un caso, con acción para quitarlo.

Las listas completas **Tareas del expediente** y **Citas del expediente** se abren como vistas locales bajo la cabecera del caso, con enlace de regreso a Resumen. Muestran todos los registros autorizados de ese expediente, incluidas tareas delegadas; no aplican un filtro invisible de «asignadas a mí». Reutilizan los datos y componentes de Trabajo y Agenda, sin duplicar captura. Los destinos globales sirven para comparar varios casos; no es necesario salir a ellos para ampliar una lista local.

**Por qué:** tres destinos cubren las preguntas diarias. Un módulo independiente por cada tabla del sistema multiplicaría decisiones. El directorio sigue disponible para gestionar personas, pero deja de ser un peaje para llegar al caso.

## 4. Trabajo: una entrada útil para cada rol

### Contenido y jerarquía

1. Encabezado «Trabajo», alcance visible y acceso a Abrir expediente.
2. Resumen compacto con enlaces a pendientes vencidos, pendientes de hoy y próximas citas. Los recuentos corresponden al alcance completo y enlazan al listado que explican.
3. «Requiere atención»: tareas abiertas vencidas o con vencimiento hoy, agrupadas sin mezclar citas pasadas con tareas incumplidas.
4. «Próximas citas»: hora, tipo, asunto y acceso directo si existe enlace.
5. «Otros pendientes»: trabajo abierto sin fecha o posterior, con acceso a todos.
6. Acceso visible a «Mis expedientes» o «Expedientes de la firma». No tener tareas no significa no tener casos asignados.

Una fila de tarea muestra título, asunto/cliente, vencimiento y **Asignada a** cuando aporta contexto. La prioridad se resalta solo si es relevante. Al abrirla, el panel de detalle conserva visible el expediente y ofrece la acción permitida: comenzar, completar o abrir el paso de la guía. No se completa un paso jurídico desde un checkbox genérico.

La instrucción de trabajo se consulta como contenido en **Ver tarea**, con una síntesis en la fila cuando sea útil. No se esconde exclusivamente en `(i)`. Iniciar y Completar tienen acceso directo para todo rol que pueda ejecutar esa transición; tener permisos de gestión no obliga a abrir Editar y cambiar un selector. Editar conserva campos administrativos como responsable, prioridad y fecha.

### Adaptación por rol

- **Abogado:** sus pendientes, citas y expedientes. Los casos asignados aparecen sin necesitar aceptación ni una tarea artificial.
- **Secretaria:** sus tareas delegadas y acceso a la agenda de coordinación de la firma. No se presenta la cartera del abogado como si fuera su carga personal.
- **Jefe:** puede elegir Mi trabajo o Equipo, filtrar responsable y abrir el mismo expediente que usa el equipo. Los vencimientos y pendientes ayudan a distribuir trabajo; el número bruto de expedientes no se presenta como medida de productividad.

Estos son los alcances de entrada habituales. En la vista local Tareas del expediente se ve también trabajo delegado, se identifica **Asignada a** y se conservan los permisos de acción de cada tarea. Esa consulta reutiliza el listado autorizado del asunto, no el endpoint personal ni el alcance Equipo reservado a administración.

**Por qué:** el inicio debe permitir actuar. Gráficos de volumen, indicadores de éxito y tarjetas por cada cifra no resuelven el trabajo del piloto.

## 5. Expedientes: encontrar y abrir sin rodeos

### Listado

Cabecera «Expedientes», botón **Abrir expediente**, buscador y enlace secundario «Clientes». La búsqueda admite título, nombre del cliente, identificación, código interno y radicado oficial. Debe hacerse sobre todos los registros autorizados, no solo sobre la página cargada.

Fila de escritorio: **título y cliente** como información principal; responsable, estado registrado y próxima fecha con su tipo como contexto. Código y radicado son secundarios y se distinguen entre sí. En móvil la misma fila se organiza en dos o tres líneas; no se obliga a desplazar una tabla horizontal.

Filtros iniciales: responsable cuando el rol puede ver varios y estado. No desplegar todos los filtros técnicos al entrar. Conservar los filtros en navegación y mostrar cómo limpiarlos. Para grandes listas, paginación visible y recuento correcto.

Un expediente sin tareas también aparece. «Sin próxima fecha» expresa ausencia de datos, no retraso ni inactividad. Los expedientes históricos no desaparecen por no estar en un paso activo; el filtro define qué estados muestra.

### Abrir expediente

Una sola pantalla de formulario, presentada como hoja amplia en escritorio y página completa en móvil. Sin modal dentro de otro modal ni asistente de siete pantallas.

1. **Cliente.** Buscar primero. Si no existe, Crear cliente despliega los campos en el mismo lugar y conserva lo escrito.
2. **Título del expediente.** Texto reconocible, por ejemplo «Cobro de honorarios — contrato de asesoría».
3. **Abogado responsable.** Para el abogado, su propio nombre ya resuelto. Secretaria y jefe eligen explícitamente; no se asigna al primero de una lista.
4. **Fecha de apertura.** Hoy por defecto, editable para casos anteriores.
5. **Seguimiento.** Libre por defecto. La guía de insolvencia es una opción específica y compatible, no un paso obligatorio de apertura.
6. **Abrir expediente.** Guarda la operación y entra al caso creado. No obliga a subir documentos o publicar algo para terminar.

Para un cliente nuevo se mantienen los datos esenciales del contrato actual: tipo de persona e identificación, número, nombre legal y correo. Teléfono es opcional. Expedición, dirección, ciudad, canal y observaciones quedan en **Más datos**. No se retiran validaciones del servidor por esconder campos. Si posteriormente se decide admitir clientes sin correo, será una decisión funcional explícita.

La opción de habilitar portal conserva una etiqueta breve; desaparece la referencia a un código de demostración. Habilitar acceso no equivale a compartir documentos. Una identificación existente ofrece seleccionar ese cliente, sin duplicarlo ni perder el resto del formulario.

**Por qué:** la apertura necesita identificar, asignar y empezar. Los datos complementarios se completan en la ficha única del cliente cuando sean necesarios.

## 6. El expediente: una portada y dos vistas de detalle

### Cabecera común

Siempre conserva **título, cliente, abogado y estado del expediente**. El código interno queda en segundo nivel. Datos menos frecuentes se consultan desde «Datos del expediente»; la identidad del cliente enlaza a su ficha compartida.

Cambiar estado o responsable requiere abrir la acción correspondiente y guardar. No hay selectores editables permanentemente ocupando la portada. El responsable general del cliente se mantiene en la ficha de cliente, separado del abogado de este expediente.

### Tres pestañas estables

| Pestaña | Pregunta que responde | Contenido |
| --- | --- | --- |
| **Resumen** — inicial | ¿Cómo va y qué requiere atención? | Último avance, tareas abiertas, próximas citas y acceso a guía si existe. |
| **Documentos** | ¿Dónde está el soporte? | Archivos, búsqueda, tipo, visibilidad y acciones. |
| **Actividad** | ¿Qué ocurrió y qué recorrido ha seguido? | Historia fechada, autoría, soportes y eventos operativos. |

**Resumen** muestra el último avance con un fragmento y acceso al registro completo; hasta tres tareas prioritarias y dos próximas citas, con total y «Ver todas». Los límites son de presentación, no de acceso: las listas completas se abren dentro del expediente conservando su cabecera, alcance y regreso a Resumen. Si hay vencidos, se ordenan antes y se muestra el total para no ocultarlos.

«Último avance» prioriza el registro escrito por una persona, incluido un resumen de cita. Un evento automático como documento incorporado no sustituye ese relato. Los eventos operativos siguen en Actividad; si no hay avance escrito, se indica esa ausencia sin inventar un resumen.

El total de tareas y la lista completa usan el mismo alcance del expediente. Por ejemplo, si el abogado ve cuatro tareas delegadas a la secretaria en el resumen, las cuatro deben seguir visibles al abrir Tareas del expediente. Consultarlas no le asigna su ejecución ni concede a la secretaria permisos de delegación.

En escritorio pueden convivir historia reciente y próximos compromisos en dos columnas, evitando tarjetas anidadas. En móvil se ordenan: cabecera, último avance, próximos compromisos y acciones. Un resumen largo se abre con «Leer avance»; no desplaza todos los compromisos fuera de alcance.

```text
Trabajo    |  Expedientes / Cobro de honorarios
Expedientes|  Ana Pérez · Abogada Laura Torres · Estado registrado
Agenda     |  AS-2026-024                       Datos del expediente
           |
           |  Resumen     Documentos     Actividad
           |  -----------------------------------------------------
           |  Último avance                   Próximos compromisos
           |  Soportes recibidos              Hoy · 3:00 p. m.
           |  8 oct · Laura Torres            Reunión de revisión
           |  Se incorporaron…                Ver cita   Ingresar
           |  Leer avance
           |                                  Preparar escrito
           |  [Registrar avance]              Vence mañana
           |                                  Ver 4 tareas
```

El ejemplo es un esquema de jerarquía, no una maqueta visual aprobada. En la entrada habitual a Resumen y Actividad se destaca **Registrar avance**; en Documentos, **Subir documento**. **Programar cita** y **Nueva tarea** permanecen visibles junto a sus secciones, incluso sin registros, si el rol tiene permiso. Una acción predominante no significa una única herramienta disponible.

Si la persona abre una tarea, cita o paso concreto desde Trabajo o Agenda, se enfoca ese objeto y su acción correspondiente dentro del expediente. No se le devuelve primero a una portada genérica ni se le obliga a buscarlo de nuevo. Las herramientas mantienen ubicación estable; el sistema no cambia el orden de botones automáticamente por la hora, la carga o una supuesta prioridad. Cambia el foco de la vista por la selección explícita del usuario.

### Guía jurídica, cuando existe

Resumen incorpora una línea «Guía de insolvencia · paso actual» y **Continuar guía**. Abre una vista dedicada dentro del contexto del expediente, con acceso a pasos anteriores y sus respuestas, autor y fecha. Los asuntos libres no muestran una guía vacía.

La guía consulta las citas y documentos existentes; no vuelve a pedir fecha, enlace o resumen de una audiencia ya registrada. La secretaria guarda capturas; las decisiones profesionales y finalización conservan sus permisos.

Si hay varias audiencias, el paso muestra **Audiencia vinculada** y permite seleccionar una de ese expediente o programarla con el mismo formulario de cita. Conserva la referencia explícita; no elige automáticamente «la última». El resultado estructurado previsto por la guía se registra en el detalle de esa audiencia y el paso lo consulta. Un paso completado conserva cuál audiencia sustentó su información, sin cambiar de vínculo silenciosamente al crear otra.

**Por qué:** tres pestañas caben en móvil y separan presente, evidencia e historia. Tareas y citas conservan su contexto sin exigir cinco o seis pestañas. La guía sigue disponible sin organizar toda la aplicación alrededor de insolvencia.

## 7. Registrar avances y compartir con el cliente

### Capturar una vez

**Registrar avance** abre un panel con título, contenido, fecha del hecho opcional y documentos relacionados. La fecha y persona del registro se generan automáticamente. Los archivos se seleccionan de los ya cargados; no se vuelven a subir para vincularlos.

Si falta un soporte, **Subir documento** dentro del selector lleva al mismo formulario de carga, conservando el avance en memoria. Al terminar, vuelve y vincula el ID del único documento creado. Se cambia de panel con retorno; no se apilan modales ni se crea otro cargador. Cancelar la carga devuelve al avance intacto. El formulario actual todavía fija el título «Avance procesal» en código: el título editable pertenece a esta propuesta, no a la funcionalidad ya existente.

El botón es **Guardar avance**. El registro nace **Interno** para todos los roles. Queda visible en Actividad y alimenta el Resumen. Se protege el texto ante errores y cierre accidental.

La secretaria puede registrar. El abogado responsable o jefe revisa y decide **Compartir con el cliente** desde el registro guardado. No se crea un segundo informe ni se obliga a mantener un campo separado llamado «Resumen actual».

### Compartir de forma deliberada

Una revisión breve muestra el asunto, el cliente destinatario y el contenido exacto. Lista los soportes vinculados y su visibilidad. El botón **Compartir avance** afecta únicamente a la nota. Los documentos internos permanecen internos; compartirlos es una acción explícita por documento. No hay casillas de adjuntos activadas automáticamente.

El botón final de esa revisión ejecuta la publicación; no abre otra confirmación idéntica. Guardar internamente o iniciar una tarea usa acción directa y resultado localizado. Archivar sin restauración y descartar una captura requieren decisión explícita; reasignar usa Seleccionar y Guardar asignación sin otro paso redundante. Retirar visibilidad impide consultas futuras conforme a permisos, pero no deshace lo que el cliente ya pudo leer o descargar.

Después se muestra **Compartido con el cliente** con texto y señal visual discreta. «Vista del cliente» permite revisar la proyección pública real sin simular una sesión ni cambiar permisos. Retirar visibilidad conserva el registro interno. Una aclaración de un hecho ya compartido se vincula al original; no se sobrescribe silenciosamente lo que el cliente leyó.

El piloto no incorpora una bandeja nueva de aprobación para todas las notas. Si una captura necesita revisión, el abogado puede recibir una tarea vinculada según los permisos de delegación existentes. Una nota interna no significa automáticamente «pendiente de aprobar».

### Historia legible

Actividad comienza por avances escritos; los cambios operativos se consultan con un filtro «Todo / Avances / Cambios del expediente», evitando que los movimientos de archivos oculten la historia. Se conserva el orden estable por registro; cuando el hecho ocurrió antes, se muestra además **Hecho: 2 oct · Registrado: 8 oct**. No se confunden las dos fechas ni se inventan fechas procesales para los registros antiguos.

Cada entrada muestra título, texto, autor, fecha y visibilidad. Los documentos relacionados enlazan al archivo original. Los filtros consultan toda la historia autorizada y permiten cargar más, sin truncarla silenciosamente.

**Por qué:** separar guardar de compartir añade una decisión donde sí existe una consecuencia externa. La captura cotidiana permanece corta y la secretaria no necesita anticipar cómo redactará un informe distinto para el cliente.

## 8. Documentos: familiaridad de carpeta, simplicidad de lista

Cabecera con **Subir documento**, buscador y filtro por tipo o visibilidad. Lista plana inicial: nombre, tipo, fecha y **Interno / Compartido con el cliente**. Las categorías sirven para encontrar; no exigen recorrer carpetas vacías ni clasificar cada archivo como una fase jurídica.

En escritorio los metadatos se alinean por columnas. En móvil el nombre puede ocupar dos líneas y las acciones mantienen espacio táctil. **Ver** y **Descargar** tienen texto. Compartir aparece rotulado para quien tiene permiso; Archivar queda en el menú secundario.

### Carga

Seleccionar archivo —o arrastrarlo como alternativa en escritorio—, revisar nombre y tipo, y **Subir documento**. Se propone conservar el nombre del archivo como valor inicial editable. Tipos admitidos y límite se indican de forma breve junto al selector, sincronizados con el servidor; el plan propone hasta 20 MB. No fingir un porcentaje de progreso si no se mide.

Durante la carga el botón muestra «Subiendo…» y evita doble envío. Solo se incorpora la fila al confirmar archivo y metadatos. El documento nace interno. Un rechazo confirmado permite corregir y reintentar sin rehacer datos, mientras la selección siga disponible en la sesión. Si se pierde la respuesta, se conserva la captura y se comprueba el resultado antes de reenviar, conforme a la sección 13.

### Lectura y visibilidad

Ver abre vista previa con nombre, cerrar y descargar. Si no existe visor compatible, muestra directamente una opción de descarga; no un recuadro vacío. Compartir requiere revisar archivo y destinatario. Archivar retira el acceso conforme a permisos y conserva trazabilidad; no se promete un botón Deshacer si no existe restauración.

**Por qué:** lo que aporta Drive al modelo mental es encontrar, abrir y reconocer archivos. El piloto no necesita árbol de carpetas, reemplazos, versiones ni edición colaborativa de documentos.

## 9. Agenda: fechas para actuar

### Vista general

Agenda tiene dos presentaciones: **Lista / Mes**, con los mismos datos y permisos. Lista inicia en Próximos 7 días, con accesos Hoy e intervalo personalizado. Hora de Colombia visible. El formulario, los filtros y la lectura usan ese mismo criterio de zona horaria.

Una cita muestra hora, Reunión o Audiencia, título, asunto, cliente y responsable. Las tareas con fecha se distinguen como **Vencimiento de tarea**, no como bloques que simulan una reunión.

En el alcance de coordinación/equipo, el filtro **Abogado del expediente** selecciona los casos y todas sus fechas autorizadas, incluidas tareas delegadas. Cada vencimiento conserva el nombre de la persona asignada a esa tarea. Así no se confunde el abogado del caso con quien ejecuta un pendiente.

```text
Agenda                    Lista | Mes           [Programar cita]
Próximos 7 días  ▾         Abogado del expediente ▾    Tipo ▾
Hora de Colombia

Jueves 8 de octubre
  10:00 a. m.  Audiencia · Revisión de acuerdo
               Ana Pérez · AS-2026-024    Ver cita   Ingresar
  4:00 p. m.   Vencimiento de tarea · Preparar escrito
               Luis Rojas · AS-2026-031             Ver tarea
```

En Mes, seleccionar un día abre sus elementos. Si una celda tiene más eventos de los que caben, muestra «+N» y permite verlos todos. En móvil el calendario selecciona el día; los detalles y botones quedan debajo, legibles. No hay reprogramación por arrastre, vista semanal, recurrencias ni integración con Google/Outlook en este piloto.

### Crear y abrir una cita

Desde un expediente, el caso viene resuelto. Desde Agenda, se elige un expediente autorizado; esa es la única diferencia del mismo formulario. Campos: tipo, título, fecha/hora de inicio, fin opcional, modalidad, enlace o lugar y contexto opcional. El abogado se deriva del expediente.

Detalle de cita: hora y estado, asunto, responsable, contexto, enlace/lugar, documentos relacionados mediante el resumen y resumen registrado. **Ingresar** abre el enlace en otra pestaña; **Abrir expediente** abre el caso; **Ver cita** muestra el detalle. Una cita virtual sin enlace dice **Sin enlace** y ofrece Añadir enlace a quien puede editarla.

Reprogramar conserva la cita y registra el cambio. Cancelar mantiene la historia y retira el compromiso de las próximas citas. El paso del tiempo no marca automáticamente Realizada. Registrar resumen reutiliza el formulario de avance vinculado a la cita; su contenido permanece interno hasta compartirlo expresamente. Si se marca realizada sin resumen, se informa **Sin resumen registrado**.

Para una audiencia vinculada a la guía de insolvencia, el detalle incorpora **Resultado de la audiencia**, con los valores existentes de la guía (Acuerdo / Sin acuerdo). Lo guarda el profesional autorizado; la secretaria puede capturar contexto o resumen sin decidir ese resultado. El resultado y el resumen son datos distintos: uno es la decisión estructurada y otro el relato del hecho. Ambos se consultan desde la guía sin volver a capturarlos. No se exige ese catálogo a reuniones o audiencias de seguimiento libre que no usan esa guía.

### Coordinación de la secretaria: ajuste explícito al plan

La secretaria debe consultar las citas de los expedientes a los que ya tiene acceso, filtradas por abogado. Sus tareas personales siguen en Trabajo; esta agenda de coordinación no le concede publicar, decidir jurídicamente o ver módulos administrativos ajenos a su función.

La agenda de coordinación incluye también los vencimientos de tareas de esos expedientes autorizados, aunque estén asignadas a otros miembros. El filtro Tipo permite ver solo Citas o Vencimientos. Esta lectura se fundamenta en el acceso existente al expediente; no convierte su bandeja Trabajo en la bandeja personal de todo el equipo. La API debe separar la autorización de esta proyección de agenda del permiso administrativo del alcance Equipo de `/mi-trabajo`.

Este alcance necesita un ajuste de permisos/proyección en API: hoy el alcance Equipo está reservado al administrador. Si las citas pertenecen al abogado y la secretaria solo ve «mío», no puede coordinar las reuniones que acaba de programar. Es un requisito operativo de la propuesta, no una función ya implementada.

**Por qué:** la agenda evita buscar enlaces en formularios y permite preparar una reunión leyendo contexto y resumen previo. Calendario y lista son dos vistas de una cita única.

## 10. Cliente: una consulta tranquila y directa

El cliente entra a su asunto cuando tiene uno; si tiene varios, el selector muestra título y código. No debe elegir una firma ni aprender la organización interna.

### Orden de la pantalla

1. Título del asunto y abogado responsable.
2. **Último avance compartido**, con fecha claramente nombrada y texto completo o Leer más para textos extensos.
3. Accesos visibles **Ver avances** y **Ver documentos**, que llevan a esas secciones de la misma página.
4. Historia de avances autorizados, agrupada para leer y con acceso al registro completo.
5. Documentos compartidos, con nombre, tipo, Ver y Descargar.

```text
Asuntia                              Cuenta

Cobro de honorarios
AS-2026-024 · Abogada Laura Torres

Último avance compartido
Soportes recibidos
Registrado el 8 de octubre
Se incorporaron los documentos enviados…

Ver avances                 Ver documentos

Avances anteriores
2 oct · Revisión de información

Documentos compartidos
Contrato de asesoría.pdf
Ver                         Descargar
```

«Qué debes hacer» se comunica en el avance autorizado cuando procede. No se infiere de tareas internas ni se crea un formulario paralelo para mantenerlo. El estado interno del expediente y el progreso de la guía no se publican automáticamente. El portal informa mediante los avances autorizados; incorporar un estado público estructurado requeriría una decisión adicional.

La fecha debe decir qué representa. Si el dato disponible es la fecha de registro, se etiqueta como tal; no se presenta como fecha de publicación. Tampoco se interpreta una ausencia de publicaciones como ausencia de trabajo jurídico.

Una nota compartida solo ofrece enlaces a soportes también compartidos. El resumen de una audiencia puede llegar como avance; su enlace de ingreso y contexto interno no llegan por esa publicación. Calendario externo, carga por el cliente, chat y comunicaciones automáticas quedan fuera del piloto acordado.

Si no hay avances: **Aún no hay avances compartidos**. Si hay documentos, siguen accesibles. Si no hay documentos, se indica brevemente en su sección. No se muestran tareas vacías, porcentajes de éxito ni etapas futuras supuestas.

**Por qué:** el cliente necesita reconocer su caso y comprender qué le comunica su abogado. Dos accesos visibles evitan que una historia larga esconda sus archivos.

## 11. Acceso, clientes y configuración

### Acceso

Direcciones de entrada claras para Cliente y Oficina, con identidad de la firma configurada. En cada una existe un enlace secundario a la otra; el usuario no tiene que elegir su rol en cada visita. La oficina usa correo y contraseña, y el sistema resuelve su rol. El cliente usa identificación y código por correo.

En OTP: un campo que permita pegar y autocompletar el código, acción Volver para corregir la identificación, reenvío conforme al límite real del servidor y mensajes de código inválido/caducado junto al campo. Las respuestas públicas no revelan si una identificación está registrada. El estado de envío debe corresponder a lo que el servicio puede acreditar: no prometer entrega al buzón por recibir un 200 genérico. La indisponibilidad del correo necesita una salida de error recuperable y registro operativo, con respuestas externas que sigan protegiendo esa privacidad.

En ambos accesos, errores anunciados para lectores de pantalla y foco bien ubicado. Al vencer la sesión se preserva la ruta de retorno autorizada y la captura únicamente en memoria, mientras se reautentica la misma identidad en la aplicación. Una salida explícita o cambio de usuario limpia las capturas; nunca se recuperan para otra identidad. Un fallo de conexión no se interpreta automáticamente como sesión vencida, ni un cierre de sesión fallido se presenta como confirmado. No se promete persistencia tras recargar/cerrar el navegador ni se guardan expedientes sensibles en almacenamiento persistente del navegador para simular modo sin conexión.

### Clientes

Directorio secundario accesible desde Expedientes y desde el nombre del cliente. Permite consultar sus datos y abrir sus casos autorizados. Editar contacto actualiza esa ficha única, no cada expediente. Habilitar acceso para un cliente existente reutiliza su identidad, sin crear otro cliente. La visibilidad de datos y acciones conserva permisos del servidor.

### Configuración

La preparación técnica del almacenamiento, correo y firma queda fuera de los recorridos diarios. El piloto usa el almacenamiento persistente acordado; no pide al abogado o secretaria elegir proveedor cloud al subir un archivo. Los ajustes administrativos disponibles quedan en el menú del jefe. No se diseñan módulos nuevos de finanzas, superadministración o gestión completa de usuarios como parte de este alcance.

## 12. Gramática visual e interacción común

| Elemento | Propuesta | Motivo |
| --- | --- | --- |
| Superficies | Fondo claro suave, contenido blanco, separadores finos y pocas elevaciones. | Agrupar por relación, sin convertir cada dato en una tarjeta. |
| Color | Verde actual para selección/acción; tonos sobrios de aviso y error acompañados de texto. | Conservar identidad y reservar atención para diferencias útiles. |
| Tipografía | Familia de interfaz del sistema, con respaldo adecuado en Windows; pesos normal y seminegrita. | Lectura familiar y carga rápida sin depender de una fuente externa. |
| Escala | Cuerpo alrededor de 16 px, contexto 14 px, títulos de pantalla 24–28 px como punto de partida. | Jerarquía sin títulos monumentales ni metadatos ilegibles. |
| Espacio | Escala común basada en los tokens; 16–24 px entre grupos, mayor separación solo entre secciones. | Mantener densidad útil en oficina y aire suficiente en móvil. |
| Controles | Altura táctil mínima propuesta de 44 px; etiquetas visibles, foco claro, estados de carga/error. | Usabilidad con dedo, ratón y teclado. |
| Botones | Una acción principal por contexto; acciones frecuentes con verbo y texto; excepcionales en menú. | Evitar tanto barras saturadas como controles importantes escondidos. |
| Paneles | Panel de detalle en escritorio; página/hoja completa en móvil. Un solo nivel de edición abierto. | Conservar contexto sin apilar ventanas. |
| Movimiento | Transiciones cortas y discretas, aproximadamente 120–180 ms; respetar movimiento reducido. | Ayudar a percibir apertura y cambio sin retrasar el trabajo. |
| Texto | Registrar avance, Subir documento, Programar cita, Guardar asignación, Compartir con el cliente. | El verbo describe la consecuencia. «Público» se evita por su ambigüedad. |

Estas medidas son criterios iniciales de diseño, no CSS aprobado. La implementación posterior centralizará sus decisiones en tokens y componentes existentes, sin colores o espacios dispersos por pantalla.

Etiquetas, permisos, visibilidad y errores esenciales siempre están a la vista. Las explicaciones complementarias usan el Tooltip `(i)` del proyecto, accesible con teclado y toque; nunca son requisito oculto para operar. La pantalla no contiene párrafos de onboarding o justificaciones de arquitectura.

Un avance escrito, una instrucción de tarea o el contexto de una cita son contenido de trabajo, no sobre-explicación de la interfaz. Se leen en su detalle rotulado. Se conserva el Tooltip actual, que ya dispone de interacción con teclado y toque; el cambio está en qué información se le asigna.

El contrato de un diálogo incluye foco inicial, recorrido Tab/Shift+Tab dentro de él, fondo inerte y restauración del foco al disparador al cerrar. Pestañas y grupos de selección admiten las teclas de su patrón o usan controles nativos. La página móvil conserva retorno y foco en el elemento de origen. La navegación inferior deja espacio para contenido, área segura y acciones durante el uso del teclado; se comprueba renderizada, no se asume por definir un token.

Vocabulario de interfaz propuesto: **Expedientes / Abrir expediente** en la oficina; **Tu asunto** en el portal para el mismo caso autorizado; **Avance** para el registro escrito y **Actividad** para la historia completa. Los nombres técnicos Nota/Novedad no alternan en botones. Se distingue **Responsable del cliente**, **Abogado del expediente** y **Asignada a** en una tarea. El ensayo con usuarios comprobará la comprensión de Expedientes frente a Asuntos sin introducir dos módulos para el mismo objeto.

Se comprobarán contraste, aumento de texto, foco y lectura con tecnologías de asistencia. La inspiración minimalista no justifica texto gris ilegible ni interacción exclusiva por hover. Apple también recomienda tamaños adaptables y contraste suficiente en su [guía de accesibilidad](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## 13. Estados que hacen que la experiencia sea fiable

| Situación | Comportamiento exigido |
| --- | --- |
| Primera entrada sin casos | Mensaje breve y Abrir expediente, si tiene permiso. Sin métricas ficticias. |
| Búsqueda sin coincidencias | Mantener consulta y ofrecer Limpiar filtros; distinguirlo de no tener expedientes. |
| Cargando | Estructura estable y estado anunciado; no mostrar «Sin datos» antes de terminar. |
| Consulta fallida | Mensaje localizado y Reintentar. Si hay datos anteriores, indicar que no se actualizaron. |
| Guardando | Bloquear doble envío de esa acción y mostrar Guardando… sin bloquear toda la aplicación. |
| Guardado exitoso | Confirmación junto al elemento y actualización de vistas derivadas; sin modal de felicitación. Una nueva edición sustituye el éxito anterior por Cambios sin guardar. Recargar usa Recargando…, nunca Guardando…. |
| Validación | Error junto al campo, foco al primero y valores conservados. |
| Cierre con cambios | Mantener la captura al cambiar pestaña del mismo expediente. Antes de abandonar/reemplazar el editor, ofrecer seguir editando o descartar. Escape, clic fuera o navegación no borran trabajo silenciosamente. Refrescar responsables no reinicia Apertura. |
| Edición simultánea | Mantener captura local y consultar la última versión guardada en un detalle de solo lectura sin sustituir el formulario. Mostrar campos relevantes y fecha/autor solo si existen. El descarte para recargar es explícito; sin fusión automática ni historial de versiones. |
| Cambio de responsable | Guardado explícito, resultado visible; si el usuario pierde acceso, retorno claro a su listado. |
| Documento inválido/fallido | Explicar formato/tamaño/problema real, sin fila que aparente una carga exitosa. |
| Acción no permitida | No ofrecer un control inoperante como invitación a usarlo. Un acceso directo debe responder correctamente desde API. |
| URL inexistente o inaccesible | «Expediente no disponible» y Volver a expedientes; nunca mostrar la selección anterior. |
| Archivo retirado tras abrir portal | Mensaje de ya no disponible; refrescar la lista sin revelar información interna. |
| Conexión interrumpida durante el envío | «No pudimos confirmar el guardado» y conservar captura en memoria. Consultar/reconciliar el resultado antes de reintentar; perder la respuesta no prueba que el servidor no guardó. Sin promesa de trabajo offline. |

La interfaz espera confirmación del servidor para compartir, transferir, completar decisiones o archivar. Las operaciones fallidas no dejan visibles estados que nunca se guardaron.

Ante una respuesta perdida, el mínimo de experiencia es conservar la captura, informar incertidumbre y no repetir automáticamente la creación. La apertura conserva la prevención de duplicados exigida por P1. Para avances, citas, tareas y documentos, se definirá la recuperación por operación: consultar lo ya registrado cuando permita verificar el resultado y añadir identificación/idempotencia cuando resulte necesaria. Esta es una decisión técnica a resolver en cada hito, no una obligación de construir ahora una infraestructura general nueva. Si todavía no se puede determinar el resultado, se ofrece consultar el expediente y se mantiene el estado incierto; no se promete reconciliación automática ni un reintento seguro sin soporte.

## 14. Una captura y permisos comprensibles

| Información | Se captura en | Se consulta también en |
| --- | --- | --- |
| Identidad/contacto | Ficha de cliente | Apertura, expediente, búsqueda, acceso |
| Abogado responsable | Expediente | Listados, Trabajo, citas, Agenda |
| Avance | Registro de actividad | Resumen y portal si se comparte |
| Resumen de reunión/audiencia | Avance vinculado a la cita | Cita, actividad y portal si se comparte |
| Fecha, modalidad y enlace | Cita | Agenda, calendario, expediente y guía por referencia |
| Trabajo y vencimiento | Tarea | Trabajo, expediente y agenda |
| Archivo y visibilidad | Documento | Documentos, soportes de avance y portal autorizado |

| Acción | Abogado responsable | Secretaria | Jefe | Cliente |
| --- | --- | --- | --- | --- |
| Abrir expediente | Para sí | Para un responsable | Para un responsable | No |
| Reasignar expediente | No por defecto | Sí, según plan | Sí | No |
| Capturar avance/documento | En sus casos | En casos autorizados | En la firma | No |
| Publicar/retirar visibilidad | En sus casos | No | En la firma | No |
| Crear/delegar tareas | En sus casos | Sin ampliar el permiso existente | En la firma | No |
| Leer tareas del expediente, incluidas delegadas | Todas las activas de sus casos autorizados | Todas las activas de casos autorizados | Todas las activas de la firma | No |
| Ejecutar tareas asignadas | Sí | Sí | Sí | No |
| Programar citas | En sus casos | En casos autorizados | En la firma | No |
| Consultar agenda | Sus casos | Coordinación autorizada propuesta | Equipo | No |
| Decisión profesional/guía | En sus casos | Captura sin completar decisión | Según permisos actuales | No |
| Consultar contenido compartido | Vista autorizada del cliente | Sin suplantar al cliente | Vista autorizada del cliente | Solo el propio |

Son reglas de producto para implementar y comprobar en servidor; ocultar un botón no constituye autorización. El piloto mantiene el aislamiento por firma y evita duplicar interfaces completas por rol.

La lectura de tareas conserva el contrato actual de `GET /tareas/asunto/{id}`: usuario de oficina con acceso al asunto puede consultar sus tareas activas, aunque las ejecute otra persona. La autorización para ejecutar, editar o delegar se comprueba por separado; esa lectura no amplía el alcance global Equipo de Mi trabajo ni expone tareas al cliente.

## 15. Recorridos completos que debe sostener el diseño

1. **Secretaria recibe un caso:** Expedientes → Abrir expediente → seleccionar/crear cliente → título y abogado → abrir → subir soportes internos → programar reunión. Todo queda en el mismo expediente.
2. **Abogado recibe la asignación:** Trabajo → Mis expedientes → caso asignado, aunque no tenga tareas → leer Resumen → consultar documentos → registrar avance → revisar y compartir si procede.
3. **Secretaria apoya un caso en curso:** Agenda de coordinación → elegir abogado y cita → reprogramar; Trabajo → tarea delegada → registrar ejecución. No necesita completar la guía profesional.
4. **Abogado prepara y realiza audiencia:** Agenda → Ver cita para contexto → Ingresar → registrar resumen y estado real → compartir el avance si corresponde. Fecha y resumen no se vuelven a capturar en la guía.
5. **Jefe ayuda al equipo:** Trabajo/Equipo → pendientes por responsable → expediente → crear tarea o reasignar explícitamente → consultar Agenda. Usa el mismo contexto y evidencia del abogado.
6. **Cliente consulta:** acceso con código → caso → último avance → Ver documentos → abrir soporte. No necesita recorrer carpetas internas ni interpretar estados de tareas.

## 16. Cómo comprobar que sea fácil antes de programarlo

El siguiente paso de diseño recomendado es un prototipo navegable con datos ficticios: Trabajo, listado, apertura, expediente, documentos, compartir, agenda/cita y portal. Debe probar los recorridos anteriores antes de reemplazar componentes de producción. Este documento no incluye ese prototipo ni lo presenta como una aplicación funcional.

Propuesta de ensayo con una secretaria, dos abogados, el jefe y dos clientes con distinta familiaridad digital. Primero intentar las tareas sin explicación del moderador; después preguntar qué resultó confuso. No hace falta convertirlo en un estudio extenso para descubrir los tropiezos mayores.

| Tarea de prueba | Criterio propuesto, no resultado medido |
| --- | --- |
| Identificar caso, responsable y próximo compromiso | Respuesta correcta en unos 10 segundos desde Resumen. |
| Abrir caso para cliente existente | Menos de un minuto, teniendo los datos y sin ayuda. |
| Reconocer un expediente recién asignado sin tareas | Encontrarlo en Expedientes sin crear una tarea para hacerlo visible. |
| Abrir todas las tareas de un caso con trabajo delegado | Coincidir con el total del resumen, mostrando también responsables distintos del usuario. |
| Subir y encontrar un archivo | Completar el recorrido y reconocer si es interno o compartido. |
| Compartir avance con soporte privado | Comprender qué verá el cliente y conservar privado el soporte no compartido. |
| Entrar a reunión desde Agenda | Un toque sobre Ingresar desde la fila que ya contiene el enlace. |
| Reprogramar y volver al expediente | Encontrar una sola cita actualizada y conservar orientación. |
| Cliente encuentra último avance y archivo | Completarlo sin ayuda de la oficina. |
| Recuperarse de error/conflicto | No perder captura ni confundir error con éxito. |
| Incorporar un soporte mientras se escribe un avance | Volver al texto intacto y vincular un único archivo creado. |
| Guardar y volver a editar | Mostrar Cambios sin guardar; el éxito anterior no acredita la nueva edición. |
| Perder respuesta de una creación | No reenviar automáticamente; conservar captura y verificar el resultado según el soporte de esa operación. Si no es verificable, comunicar incertidumbre y permitir consultar sin prometer éxito. Mantener la prevención de duplicados exigida para apertura. |
| Recuperar sesión durante edición | Volver a la ruta autorizada y recuperar memoria solo para la misma identidad. |

Los tiempos son objetivos iniciales de usabilidad, no promesas de rendimiento ni datos observados. Una tarea crítica fallida o una publicación accidental exige corregir el diseño antes del piloto. No se infiere validación estadística de una muestra pequeña.

Además: revisar escritorio de 1280 px, móvil de 390 px y tamaño estrecho de 320 px; zoom de texto al 200 %, navegación por teclado, foco de paneles y lectura de errores. Probar nombres largos, clientes con varios casos, cero datos, muchas citas en un día, archivos sin vista previa y listados que superan una página.

## 17. Qué cambia respecto al plan funcional

- Se conserva el alcance: casos libres, asignación, documentos, historia, citas y portal autorizado; sin versionado documental.
- Se concreta la navegación en Trabajo, Expedientes y Agenda, con el cliente como contexto del caso.
- El expediente pasa a Resumen, Documentos y Actividad; guía contextual.
- Guardar avances es siempre interno y compartir es una acción posterior explícita. Ajusta el formulario actual, que permite elegir visibilidad durante la creación.
- Se requiere agenda de coordinación para secretaria sobre sus expedientes autorizados.
- Se añaden como requisitos de experiencia enlaces estables, preservación de contexto, revisión de publicación y estados recuperables.
- La revisión de seis especialistas precisa vistas locales completas de tareas/citas, ejecución directa por permisos, acceso visible a instrucciones, carga de soportes con retorno, contrato de foco y vida del borrador. No crea otra fuente de datos ni altera las funciones acordadas del piloto.
- No se añade un estado público automático, una bandeja nueva de aprobación, chat, IA, notificaciones externas ni integraciones de calendario.

Una vez elegido el diseño, el plan técnico puede distribuir estas decisiones entre P1–P6. El cascarón de navegación y componentes comunes se prepara primero; cada hito entrega un recorrido completo con permisos, estados y comprobación en escritorio/móvil. La aprobación de esta propuesta no equivale a desplegar el piloto.

## 18. Evidencia del proyecto y límites

Referencias de la base revisada:

- [App.tsx](../frontend/src/App.tsx): selección por cliente/asunto, títulos actuales y composición vertical, especialmente líneas 256, 274 y 711–865.
- [AperturaAsuntoModal.tsx](../frontend/src/components/ui/AperturaAsuntoModal.tsx): responsable inicial y captura del cliente, líneas 100 y 370–604.
- [ResponsableAsignacion.tsx](../frontend/src/features/asuntos/components/ResponsableAsignacion.tsx): guardado al cambiar selector, línea 36.
- [MiTrabajo.tsx](../frontend/src/features/tareas/components/MiTrabajo.tsx) y [AgendaTrabajo.tsx](../frontend/src/features/tareas/components/AgendaTrabajo.tsx): navegación local, filtros de fecha y enlaces actuales.
- [FlujoAsunto.tsx](../frontend/src/features/asuntos/components/FlujoAsunto.tsx), [TareasAsunto.tsx](../frontend/src/features/tareas/components/TareasAsunto.tsx) y [ActividadExpediente.tsx](../frontend/src/features/asuntos/components/ActividadExpediente.tsx): guía, acciones de tareas y registro de notas.
- [DocumentosTab.tsx](../frontend/src/features/documentos/components/DocumentosTab.tsx): clasificación, visibilidad, carga y acciones.
- [PortalCliente.tsx](../frontend/src/features/portal-cliente/components/PortalCliente.tsx) y [types/portal.ts](../frontend/src/types/portal.ts): proyección autorizada y campos disponibles.
- [ClienteOTPLogin.tsx](../frontend/src/features/auth/components/ClienteOTPLogin.tsx), [auth.py](../backend/app/api/v1/endpoints/auth.py) y [mail.py](../backend/app/core/mail.py): acceso y tratamiento de envío de código.
- [tareas.py](../backend/app/api/v1/endpoints/tareas.py): alcance de equipo restringido actualmente al administrador.
- [ConfiguracionAlmacenamiento.tsx](../frontend/src/features/firma/components/ConfiguracionAlmacenamiento.tsx), [tokens.css](../frontend/src/styles/tokens.css) y [globals.css](../frontend/src/styles/globals.css): configuración y lenguaje visual actual.

Esta revisión cubre las superficies implementadas relevantes para el piloto, no cada aspiración de documentos legados. No constituye revisión jurídica de procedimientos ni una auditoría exhaustiva de seguridad. No se modificaron componentes, modelos ni permisos para producir la propuesta.
