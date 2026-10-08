# Filosofía UX de Asuntia y evaluación de seis especialistas

**Fecha:** 8 de octubre de 2026. **Implementación examinada:** `5315b3f`. **Estado:** propuesta de diseño, sin cambios funcionales.

Este informe recoge seis evaluaciones independientes, sus diferencias y las decisiones de síntesis. Los refinamientos están incorporados en la [propuesta de pantallas](PROPUESTA_UX_PILOTO_2026-10-08.md), que sigue siendo la especificación de interacción. El [plan funcional](PLAN_PILOTO_2026-10-04.md) conserva el alcance del piloto.

## 1. La filosofía recomendada

**Entender de un vistazo. Actuar donde estás. Conservar el control.**

La persona debe reconocer el expediente, encontrar una herramienta por su propósito y saber el resultado de su acción. Una interfaz tranquila puede mostrar varias herramientas y mucha información cuando la jerarquía permite distinguirlas.

La referencia Apple se toma como criterio de calidad: jerarquía, consistencia, controles familiares y respuesta clara. Sus guías relacionan jerarquía con la distinción entre controles y contenido, y consistencia con convenciones que se adaptan al tamaño disponible. [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).

Las decisiones siguientes son nuestra aplicación a Asuntia, una herramienta jurídica web usada por varios roles. Tres destinos, tres pestañas o el color verde son decisiones del proyecto; no reglas universales de Apple. El aspecto actual de los sistemas Apple tampoco obliga a usar transparencias o reproducir controles nativos en Windows y Android.

## 2. Método y alcance real

Se abrieron seis agentes con encargos distintos. Cada uno recibió instrucciones de revisar producto y código antes de contrastar la propuesta anterior. Se mantuvieron sus evaluaciones separadas hasta reunir resultados; la síntesis y las decisiones que resuelven discrepancias corresponden al agente coordinador.

| Agente | Especialidad | Resultado principal |
| --- | --- | --- |
| `ux_jerarquia_navegacion` | Orientación, niveles y continuidad espacial | La oficina compara casos; el expediente conserva el contexto de uno. |
| `ux_herramientas_productividad` | Herramientas, formularios y ejecución | Una herramienta frecuente debe estar junto al trabajo, con nombre y efecto claros. |
| `ux_lenguaje_visual` | Composición, densidad y tipografía | Ordenar información y acciones antes de añadir espacio o decoración. |
| `ux_movilidad_accesibilidad` | Móvil, teclado, foco y controles | La facilidad debe existir también con dedo, teclado y texto ampliado. |
| `ux_lenguaje_carga_mental` | Vocabulario, reconocimiento y comprensión | El mismo concepto necesita un nombre estable; una instrucción no es ayuda opcional. |
| `ux_confianza_continuidad` | Guardado, recuperación, sesión y control | El estado visible debe corresponder a la captura y operación actuales. |

Las seis evaluaciones terminaron. La de continuidad se interrumpió por límite de uso y se retomó hasta obtener el informe final; no fue sustituida por una suposición del coordinador.

Evidencia: código, contratos, documentación, capturas existentes de agenda/tareas/portal y un análisis automático de estilos ejecutado una vez. No hubo cambios de interfaz ni pruebas con usuarios. Los servicios locales no estaban escuchando durante esta revisión; no se levantaron para simular una comprobación en vivo. Las capturas sirven para composición, no acreditan comportamiento del teclado o rendimiento. Los resultados esperados de las recomendaciones quedan por validar.

## 3. Evaluaciones individuales

### A. Jerarquía y navegación

**Tesis:** hay dos escalas de trabajo: oficina y expediente. El usuario debe distinguirlas sin aprender la estructura de datos.

- **Entrada por caso:** el directorio actual exige seleccionar cliente y después asunto. Se recomienda listado de expedientes buscable por título, cliente e identificadores, manteniendo el directorio secundario para clientes sin casos. Evidencia: `App.tsx:514–570`.
- **Ubicación fiable:** la ruta de un caso desconocido puede conservar una selección anterior. La URL y el contenido deben resolver el mismo objeto; no se habilitan acciones durante una selección ambigua. Evidencia: `App.tsx:275–290`.
- **Regreso predecible:** Agenda y alcance están en estado local. Abrir un caso y volver debe recuperar intervalo, filtros y posición; la fila debe abrir la tarea o cita concreta. Evidencia: `MiTrabajo.tsx:23–24`, `AgendaTrabajo.tsx:17–18,47`.
- **Detalle por propósito:** la secuencia actual de formularios, tareas, archivos e historia requiere demasiada exploración. Se mantienen Resumen, Documentos y Actividad, con cabecera del caso y vistas locales completas de tareas/citas. Evidencia: `App.tsx:791–865`.
- **Identidad antes que plantilla:** el título fijo de insolvencia y la guía expandida dominan el caso. El título propio y el seguimiento libre permiten reconocer expedientes distintos; la guía aparece cuando existe y conserva un acceso visible. Evidencia: `App.tsx:255`, `FlujoAsunto.tsx:175,291`.

**Objeción al diseño anterior aceptada:** «Ver todas» ya no debe sacar al usuario a un módulo global para revisar trabajo de un solo expediente. Reutilizar componentes no exige cambiar de contexto.

### B. Herramientas y productividad

**Tesis:** la acción se encuentra junto al objeto y su etiqueta anticipa lo que hará.

- **Herramientas visibles:** un `+` junto a Directorio abre un asunto, aunque puede interpretarse como crear cliente. Registrar avance, Nueva tarea y Programar cita tendrán rótulo y ubicación reconocible, también en listas vacías. Evidencia: `App.tsx:554`.
- **Ejecutar y editar son diferentes:** el gestor de tareas debe abrir Editar y cambiar Estado; la auxiliar asignada dispone de Iniciar/Completar. La ejecución autorizada debe ser directa para ambos. Editar sigue dedicado a campos administrativos. Evidencia: `TareasAsunto.tsx:79–123`.
- **Abrir el objeto exacto:** los enlaces actuales llevan a secciones genéricas. El destino debe enfocar la tarea/cita elegida y devolver a la misma fila filtrada. Evidencia: `MiTrabajo.tsx:142`, `AgendaTrabajo.tsx:47`.
- **Formulario corto sin pérdidas:** Escape y clic exterior cierran apertura. Proteger los cambios solo cuando existen, incluyendo navegación a otro expediente; no añadir confirmaciones a formularios intactos. Evidencia: `AperturaAsuntoModal.tsx:189–193`.
- **Soporte faltante durante un avance:** se necesita cargar desde el selector de documentos relacionados y volver al texto conservado. Se reutiliza el cargador y se vincula un ID; no se duplica el archivo ni se exige empezar por Documentos.
- **Revisión proporcional:** compartir necesita una revisión concreta de contenido/destinatario; su botón final ejecuta sin una segunda confirmación idéntica. Guardar internamente mantiene respuesta directa. Evidencia: `DocumentosTab.tsx:328`, `ActividadExpediente.tsx:32,64`.

**Objeción aceptada:** una acción predominante no significa ocultar las demás. Los atajos de teclado, si se añaden después, aceleran herramientas ya encontrables y no son la única manera de acceder.

### C. Lenguaje visual y densidad

**Tesis:** el espacio y la tipografía deben ayudar a comparar y leer, manteniendo suficiente información útil.

- **Agenda alineada:** la captura de escritorio muestra filtros en varias líneas y una fila muy extendida. Se recomienda agrupación por día y columnas de hora, asunto y acciones; en móvil se conserva intervalo visible y filtros secundarios desplegables.
- **Tareas comprensibles:** las capturas muestran dos iconos de información iguales para contenido distinto. La instrucción debe tener un detalle rotulado, con síntesis cuando ayude, sin convertir cada fila en un formulario abierto.
- **Portal con accesos directos:** conservar Ver avances y Ver documentos cerca del resumen. La fecha de apertura pierde prioridad frente al último avance y al acceso a archivos. No se añade navegación de oficina al cliente.
- **Escala común:** `.small` usa 12 px globales y el portal emplea 14 px en ciertos contextos. Definir roles tipográficos en tokens y probar nombres largos; los metadatos necesarios no deben quedar como texto diminuto. Evidencia: `globals.css:291`, `portal.css`.
- **Jerarquía de superficies:** recuentos de Trabajo como enlaces compactos y filas agrupadas, sin una tarjeta por cifra. Barra lateral proporcionada en escritorio y espacio reservado para navegación inferior en móvil.

**Criterio adoptado:** mantener el verde, una familia tipográfica de interfaz y una escala sobria. Cambiar Inter por una pila del sistema se evalúa por lectura, consistencia y carga; no porque un detector la considere frecuente. Los tamaños propuestos se comprueban en pantallas reales antes de darlos por cerrados.

### D. Móvil, teclado y accesibilidad

**Tesis:** una interfaz intuitiva debe conservar su orientación con distintos modos de entrada.

- **Contrato de foco:** declarar `aria-modal` no basta. Apertura necesita foco inicial, confinamiento, fondo inerte y retorno al disparador. Tabs/radios deben ofrecer el teclado de su patrón o usar controles nativos. Evidencia: `AperturaAsuntoModal.tsx:187–199`.
- **Cierre recuperable:** el reinicio al reabrir confirma el riesgo de perder captura tras Escape o toque fuera. Mantener memoria y pedir descarte cuando haya cambios. Evidencia: `AperturaAsuntoModal.tsx:105,187`.
- **Acceso con salida:** OTP necesita corregir identificación, reenviar conforme al servidor y anunciar errores. Conservar pegado y autocompletado ya existentes. Evidencia: `ClienteOTPLogin.tsx:81,115`, `OficinaLogin.tsx:44`.
- **Área táctil uniforme:** existen controles de 38/40 px junto a un token de 44 px. Aplicar un criterio común a botones, campos y desplegables; medir cajas renderizadas. Evidencia: `tokens.css:51`, `globals.css:169,725`, `TareasAsunto.css:12`.
- **Instrucción accesible:** el texto de ejecución no debe depender del icono `(i)`. Esto no exige reconstruir Tooltip: el componente actual ya tiene foco, toque, Escape y posicionamiento. Evidencia: `TareasAsunto.tsx:76`, `Tooltip.tsx` y sus pruebas existentes.
- **Archivos encontrables:** en el portal los documentos siguen a todo el historial. Los accesos de sección deben funcionar igual con uno o veinte avances. Evidencia: `PortalCliente.tsx:108–127` y captura móvil.

**Criterio adoptado:** objetivos táctiles propuestos de 44 px, lectura a 320/390 px y texto ampliado; foco y estados de error son parte del recorrido, no una revisión cosmética al final.

### E. Lenguaje y carga mental

**Tesis:** la familiaridad se construye con nombres estables y con información necesaria disponible sin exploración.

- **Un vocabulario:** el evaluador propone Asuntos como nombre general. Se conserva por ahora Expedientes en la oficina, Tu asunto en el portal y un único objeto detrás. El ensayo comprobará cuál término reconocen mejor; no coexistirán dos destinos equivalentes.
- **Responsabilidades distintas:** Responsable del cliente, Abogado del expediente y Asignada a en tareas describen funciones diferentes. No se deben confundir al transferir un caso o delegar trabajo. Evidencia: `App.tsx:663–687,749–755`, `TareasAsunto.tsx:72–75`.
- **Instrucción como contenido:** Qué hacer, vencimiento y persona asignada son datos operativos. Una consecuencia relevante para la decisión se muestra junto a ella; explicaciones complementarias permanecen en Tooltip.
- **Visibilidad con palabras:** Interno y Compartido con el cliente evitan que un ojo o un color tengan que explicar el alcance. No se añade un estado de aprobación ni otra historia pública.
- **Identificación coherente:** la etiqueta de acceso dice Cédula y el placeholder Cédula o NIT. La etiqueta debe corresponder a lo realmente admitido por el flujo y servidor. Evidencia: `ClienteOTPLogin.tsx:76–99`.
- **Fechas con significado:** distinguir Hecho y Registrado cuando ambos datos existan. Se conserva la fecha del hecho opcional del plan aceptado, útil para incorporar historia anterior; no se convierte en una obligación de toda captura.

**Corrección de la síntesis:** el informe individual sugirió que ya existía un campo editable de título del avance. La comprobación del coordinador muestra que `ActividadExpediente.tsx:30` envía el literal «Avance procesal». El título editable es propuesto. Se corrigió la especificación para no presentar esa capacidad como existente.

### F. Confianza y continuidad

**Tesis:** conservar escritura, confirmar guardado y recuperar una operación incierta son garantías distintas.

- **Vida del borrador:** las claves por asunto desmontan los editores y Apertura se reinicia al cambiar opciones. Mantener captura en memoria dentro del recorrido, inicializar deliberadamente y proteger abandono; refrescar responsables no borra datos. Evidencia: `App.tsx:825`, `AperturaAsuntoModal.tsx:104`.
- **Feedback actual:** una nueva edición puede conservar «Tarea actualizada» del guardado anterior; recargar una guía puede decir «Guardando». Usar estados locales precisos y retirar el éxito al editar de nuevo. Evidencia: `TareasAsunto.tsx:59,126`, `FlujoAsunto.tsx:119`.
- **Envío incierto:** una respuesta perdida no prueba que el servidor rechazó la operación. Preservar y reconciliar antes de repetir también tareas y documentos. Deshabilitar doble clic no resuelve esa situación. Evidencia: manejo de error en `DocumentosTab.tsx:128` y contratos de creación.
- **Confirmaciones por consecuencia:** guardar interno e iniciar una tarea son directos; compartir revisa destinatario/contenido; descartar y archivar sin restauración requieren decisión. Retirar visibilidad no borra lo que ya se pudo consultar.
- **Conflicto comprensible:** las protecciones 409 actuales son una base a conservar. Consultar valores remotos en solo lectura sin reemplazar captura; descartar explícitamente antes de recargar. Sin fusión automática ni versiones documentales. Evidencia: `FlujoAsunto.tsx:54`, `TareasAsunto.tsx:36`.
- **Sesión y retorno:** 401 tiene una advertencia de consola y el login vuelve al inicio. Se requiere recuperación visible con retorno autorizado y memoria solo para la misma identidad; logout fallido no se presenta como confirmado. Evidencia: `axios.ts:24`, `App.tsx:318–325`.

**Criterio adoptado:** la respuesta del sistema identifica registro, operación y momento. La interfaz no necesita banners globales para cada cambio, pero tampoco afirma éxito sin evidencia.

## 4. Diez reglas para diseñar cada pantalla

| Regla | Aplicación en Asuntia | Cómo detectar que se incumple |
| --- | --- | --- |
| **1. Orientación permanente** | Navegación global estable y título del expediente en sus vistas locales. | Abrir una tarea hace olvidar qué caso se estaba revisando. |
| **2. Contenido antes que edición** | Resumen legible; formularios se abren al actuar. | Para saber qué pasó hay que atravesar campos o una guía completa. |
| **3. Herramientas próximas** | Nueva tarea junto a tareas; Programar cita junto a citas; Subir documento en documentos. | La persona necesita explorar un menú genérico para una acción frecuente. |
| **4. Jerarquía sin ocultamiento** | Acción destacada y herramientas secundarias visibles, con pesos distintos. | Se eliminan botones útiles solo para que la pantalla parezca vacía. |
| **5. Profundidad progresiva** | Más datos para complementos; instrucción y consecuencia disponibles en el detalle. | Un dato necesario para decidir vive exclusivamente dentro de ayuda. |
| **6. Consistencia por permiso** | La misma transición autorizada se ejecuta igual para abogado, secretaria y jefe. | Más permisos obligan a más pasos para completar la misma tarea. |
| **7. Continuidad del trabajo** | Regreso a fila/filtros, borrador en memoria y carga de soporte con retorno. | Cambiar pestaña o buscar un archivo obliga a empezar de nuevo. |
| **8. Control deliberado** | Compartir revisa alcance; guardar interno responde directamente. | Hay publicación accidental o confirmaciones repetitivas en cada acción. |
| **9. Estado fiel** | Cambios sin guardar, Guardando, Guardado, Recargando o confirmación pendiente. | Un éxito antiguo parece acreditar una edición nueva. |
| **10. Lectura e interacción inclusivas** | Tipografía legible, foco, áreas táctiles y adaptación estructural. | Para usar una herramienta se necesita hover, precisión fina o un monitor grande. |

Esta filosofía coincide con priorizar herramientas pertinentes a la tarea y controles de significado claro, como recomienda Apple en [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars). Para Asuntia conservamos texto en las acciones de negocio: su significado no es tan universal como el de un icono nativo de sistema.

Los nombres se repiten con el mismo significado y las acciones usan verbos concretos; es una aplicación de las recomendaciones de claridad y consistencia de [Writing](https://developer.apple.com/design/human-interface-guidelines/writing). La interfaz no necesita describir sus reglas técnicas al usuario.

## 5. Decisiones que surgieron al contrastar evaluaciones

| Tema | Alternativas examinadas | Decisión de síntesis y razón |
| --- | --- | --- |
| Ver todas las tareas/citas | Módulo global filtrado o vista local del expediente. | Vista local completa; conserva orientación y usa la misma fuente de datos. |
| Acción principal | Registrar avance siempre o priorización automática variable. | Registrar avance en portada habitual; al abrir un objeto concreto, enfocar su acción. Posiciones estables, sin reordenar por algoritmos. |
| Cantidad de botones | Uno visible o varios sin distinción. | Una acción predominante más herramientas frecuentes secundarias y locales. |
| Nombre del objeto | Asuntos frente a Expedientes. | Mantener Expedientes como hipótesis del diseño y probar comprensión; cliente ve Tu asunto. No duplicar módulos. |
| Instrucciones y Tooltip | Esconder todo contexto o desplegarlo todo. | Contenido necesario en detalle rotulado; ayuda adicional en el Tooltip existente. |
| Tipografía | Cambiar por originalidad o mantener sin revisar. | Elegir por lectura y consistencia; el detector no decide la familia. |
| Fecha del hecho | Retirar campo por brevedad o pedirlo siempre. | Conservarla opcional como prevé el plan; fecha de registro automática y distinta. |
| Publicación | Publicar al guardar o revisar varias veces. | Guardar interno; una revisión explícita para compartir; soportes con visibilidad independiente. |
| Respuesta perdida | Reintento ciego o infraestructura genérica para toda operación. | Informar incertidumbre y evitar repetición automática; resolver recuperación e identificación por operación en su hito técnico. |

El contraste final también precisó la lectura de tareas: el endpoint actual permite al usuario de oficina autorizado para un expediente leer sus tareas activas, incluidas las delegadas. Las vistas locales conservan ese contrato; ejecutar, editar y delegar siguen siendo permisos separados. Se verificó en `backend/app/api/v1/endpoints/tareas.py:40–46`.

La propuesta de continuidad recomienda reconciliar las operaciones inciertas. La síntesis acota el mínimo obligatorio de UX a no afirmar éxito o rechazo sin evidencia, conservar captura y evitar reenvío automático. La prevención de duplicados en apertura sigue exigida por el plan; el mecanismo necesario para otras creaciones se decide por operación. No se añade una infraestructura general como condición implícita del diseño.

Estos cambios afinan el piloto. No incorporan chat, IA, versiones de archivos, sincronización externa o nuevas promesas procesales.

## 6. Acceso a herramientas: contrato concreto

| Contexto | Herramientas encontrables | Detalle secundario |
| --- | --- | --- |
| Trabajo | Ver tarea, transición permitida, Ver cita e Ingresar si hay enlace. | Filtros autorizados y campos de edición. |
| Expedientes | Buscar y Abrir expediente. | Filtros adicionales y Directorio de clientes. |
| Resumen del expediente | Registrar avance, Nueva tarea y Programar cita según permiso; Continuar guía si existe. | Datos del expediente y cambio de estado/asignación. |
| Tarea concreta | Instrucción, persona asignada, fecha y acción permitida. | Editar prioridad, título, fecha o asignación. |
| Documentos | Subir documento, Ver y Descargar; Compartir para autorizado. | Archivar y metadatos menos frecuentes. |
| Cita concreta | Hora, modalidad, enlace/lugar, contexto y resumen; Ingresar si existe enlace. | Reprogramar, cancelar y datos específicos de la guía. |
| Portal del cliente | Ver avances, Ver documentos, abrir/descargar soporte autorizado. | Historia completa y selector cuando haya varios asuntos. |

En escritorio, hora/contenido/acciones se alinean para escanear listas. En móvil se apilan conservando orden y rótulos. Reducir el ancho cambia composición, no elimina funciones de trabajo ni obliga a descubrir gestos.

## 7. Respuesta y sensación de fluidez

La fluidez propuesta incluye conservar contenido durante una actualización, no hacer saltar el foco, evitar que una lista cambie de posición mientras se actúa y mostrar progreso en el elemento afectado. Las transiciones son discretas y respetan movimiento reducido; no se añade una secuencia animada de entrada a cada pantalla.

Para operaciones de duración incierta se muestra actividad sin inventar porcentajes. Si existe progreso medible puede presentarse con precisión. Si una operación se detiene, el mensaje explica el siguiente paso. Esta distinción se apoya en [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators); la reconciliación de operaciones es además una necesidad técnica de Asuntia.

La accesibilidad forma parte del criterio de salida del diseño: lectura con contraste, ampliación de texto, foco y alternativas a interacción exclusivamente visual. Apple recomienda texto adaptable y contraste suficiente en [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). Los objetivos táctiles y tamaños concretos de esta propuesta se comprobarán en el render web; no se dan por cumplidos por existir en CSS.

## 8. Verificación automática y límites

`impeccable detect --json frontend/src` se ejecutó una vez en el agente de accesibilidad: **2 advertencias, 0 errores, salida 1**.

| Aviso | Evidencia | Interpretación |
| --- | --- | --- |
| `side-tab` | `frontend/src/styles/globals.css:1085`, borde de `.workflow-current`. | Puede identificar intencionalmente el paso activo. No demuestra un problema de uso. |
| `overused-font` | `frontend/src/styles/globals.css:15`, Inter. | Preferencia estética del detector, no una medición de legibilidad. |

El análisis automático no detectó los problemas de foco, pérdida de contexto o instrucción escondida. No se convierte el recuento en una nota de calidad UX. No se inyectaron overlays ni se iniciaron servidores para esta evaluación. Se revisaron pruebas existentes como evidencia de intención, pero no se ejecutó la suite: esta entrega solo modifica documentación.

## 9. Siguiente comprobación: un circuito completo

El prototipo posterior debe permitir este circuito con datos ficticios, manteniendo los permisos del piloto:

1. Secretaria encuentra/crea cliente y abre expediente libre para un abogado.
2. Incorpora archivo interno y programa cita desde el expediente.
3. Abogado encuentra ese caso aunque no tenga tareas; identifica su próximo compromiso.
4. Registra avance, descubre un soporte faltante, lo carga y vuelve al texto intacto.
5. Comparte el avance con una revisión; comprueba qué soporte continúa interno.
6. Jefe abre una tarea delegada, identifica abogado y persona asignada, ejecuta la acción permitida y regresa al punto de trabajo.
7. Secretaria reprograma; abogado entra por el enlace de la cita y registra el resumen único.
8. Cliente encuentra el último avance y un documento compartido sin instrucciones del moderador.

Se observarán búsquedas repetidas, errores de orientación, pérdida de captura, interpretación de visibilidad y capacidad para encontrar una acción. Los clics aislados no se usan como sustituto de éxito de la tarea.

También hay que comprobar: URL inexistente; nombres largos; veinte avances; tareas delegadas; mes con muchas citas; archivo sin visor; cierre accidental; conflicto 409; respuesta perdida después de guardar; sesión vencida; otra identidad; fallo de logout; teclado y ampliación de texto. Las pruebas de servidor comprobarán permisos y el mecanismo de recuperación elegido para cada operación; las de interfaz, respuesta y continuidad; la prueba con personas, comprensión. Un prototipo visual no acredita las tres cosas.

## 10. Prioridad de diseño y trazabilidad

**Antes de implementar pantallas:** fijar vocabulario, navegación global/local, matriz de herramientas y contratos de foco/borrador. **Antes de admitir el piloto:** comprobar el circuito por roles, publicación independiente de soportes y recuperación de errores. **Después de resolver lo anterior:** ajustar espaciado, pesos tipográficos y transiciones con capturas de escritorio/móvil.

La siguiente entrega propuesta es el prototipo navegable y su ensayo. Este informe no lo da por construido ni convierte las hipótesis en resultados medidos.

Fuentes de código citadas: [App](../frontend/src/App.tsx), [Apertura](../frontend/src/components/ui/AperturaAsuntoModal.tsx), [Trabajo](../frontend/src/features/tareas/components/MiTrabajo.tsx), [Agenda](../frontend/src/features/tareas/components/AgendaTrabajo.tsx), [Tareas](../frontend/src/features/tareas/components/TareasAsunto.tsx), [Guía](../frontend/src/features/asuntos/components/FlujoAsunto.tsx), [Actividad](../frontend/src/features/asuntos/components/ActividadExpediente.tsx), [Documentos](../frontend/src/features/documentos/components/DocumentosTab.tsx), [Portal](../frontend/src/features/portal-cliente/components/PortalCliente.tsx), [Acceso cliente](../frontend/src/features/auth/components/ClienteOTPLogin.tsx), [Acceso oficina](../frontend/src/features/auth/components/OficinaLogin.tsx), [Tooltip](../frontend/src/components/ui/Tooltip.tsx), [HTTP](../frontend/src/lib/axios.ts), [Tokens](../frontend/src/styles/tokens.css) y [Estilos globales](../frontend/src/styles/globals.css). Las líneas de las evaluaciones corresponden a la base indicada y pueden moverse en futuras implementaciones.
