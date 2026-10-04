# Dirección de producto — Asuntia

Fecha: 2 de octubre de 2026. Base revisada: `test/ux-workflow-baseline`, commit `842ac5c`.

## Orientación

Asuntia debe consolidarse como el expediente único de trabajo de la firma: cada actuación tiene responsable, evidencia y trazabilidad; la información autorizada alimenta el portal sin volver a digitarla.

La oficina necesita saber qué atender y con qué soporte. El cliente necesita reconocer su asunto, leer el último avance autorizado y consultar los documentos compartidos. Completar una tarea interna no equivale a acreditar un hecho procesal ni a autorizar su comunicación.

## Discusión entre perspectivas

La revisión se realizó con agentes de arquitectura, UX, jurídico y UI. Los hallazgos y propuestas se intercambiaron antes de fijar los primeros hitos. La revisión de UI añadió correcciones de foco en la previsualización, teclado en los tooltips y legibilidad móvil.

| Perspectiva | Hallazgo y posición | Resultado del debate |
| --- | --- | --- |
| Arquitectura | La API del cliente expone datos y actores de pasos internos. El borrado de novedades no comprueba acceso al expediente; la visibilidad del documento y la de su evento pueden divergir. Propone una frontera pública explícita, permisos en servidor y transacciones coherentes. | H1 cierra estas brechas sin ampliar el modelo ni crear capturas paralelas. La seguridad debe verificarse en la respuesta HTTP, además de la interfaz. |
| UX | El portal convierte pasos internos en hitos del cliente; su etiqueta de estado sugiere una oficialidad que el sistema no acredita. La separación entre perfil de cliente y usuario puede dejar expedientes fuera del portal. | El portal se basa en información autorizada y relaciones reales. Distingue carga, fallo, ausencia de avances y ausencia de expedientes. |
| Jurídico | Radicación, aceptación, sesión de audiencia, fracaso de negociación y apertura de liquidación son hechos diferentes. El flujo binario de resultados no representa suspensiones ni continuaciones. La evaluación incompleta no se conserva. | Se evita comunicar el checklist como secuencia jurídica garantizada. Los próximos hitos deben guardar evaluaciones y verificar rutas antes de automatizar decisiones o términos. |
| UI | El portal móvil necesita una lectura corta, tranquila y legible. El tracker y las tarjetas repetidas añaden ruido sin aportar evidencia. | Ancho contenido; último avance autorizado, historial publicado y documentos. Se conserva la tipografía y la paleta existentes, con estados de carga, error, reintento y vacío reconocibles. |

### Tensiones resueltas

- **Automatización y autorización:** registrar trabajo una vez es compatible con publicar solo la información autorizada. La automatización no habilita por sí misma una comunicación externa.
- **Velocidad de la auxiliar y responsabilidad profesional:** la auxiliar puede capturar información interna; las acciones sensibles se restringen según una política explícita. El rol administrativo no acredita habilitación profesional.
- **Estado y progreso operativo:** el estado registrado y el checklist responden a propósitos distintos. Su coexistencia exige reglas de coherencia; no deben presentarse al cliente como dos relatos equivalentes del procedimiento.
- **Corrección inmediata y rediseño del dominio:** primero se protege la frontera pública y se hace honesta la lectura del portal. Las rutas y la evaluación se abordan después con alcance propio y pruebas.
- **Conservar historia y retirar visibilidad:** ocultar un documento debe retirar también la exposición de su evento vinculado. Las correcciones conservan trazabilidad y respetan el borrado lógico.

## Hitos acordados

### H1 — Contrato del portal, permisos y visibilidad

- Definir una respuesta pública con los datos necesarios para reconocer el asunto y leer sus avances autorizados; excluir formularios, respuestas, instrucciones y actores de pasos internos.
- Resolver la identidad mediante la relación entre el perfil del cliente y su acceso al portal, sin asumir que sus identificadores coinciden.
- Filtrar registros activos y autorizados en todas las lecturas del cliente.
- Comprobar acceso al expediente para las acciones sobre novedades y documentos, incluido el borrado lógico.
- Mantener coherentes la visibilidad del documento y la de su evento asociado.
- Gestionar los eventos derivados desde su actuación de origen; impedir su retiro independiente del historial.
- Aplicar y probar la política de publicación y retiro de información; conservar las operaciones internas permitidas.

Aceptación: el cliente solo recibe información autorizada de sus asuntos; los cambios privados no alteran su relato visible; retirar un documento no deja su evento expuesto; un usuario sin permisos no puede modificar el historial de otro responsable.

### H2 — Portal claro y errores honestos

- Mostrar el último avance autorizado como resumen del historial existente, sin un nuevo campo de captura.
- Presentar historial publicado y documentos compartidos; retirar el tracker de tareas internas y la expresión «estado oficial».
- Dar prioridad a lectura móvil, jerarquía tipográfica, controles cómodos y colores discretos con texto.
- Distinguir carga, error con reintento, asunto sin publicaciones y cliente sin expedientes. Un fallo de consulta no debe parecer un expediente vacío.
- Hacer coherentes las acciones visibles con los permisos del servidor; cualquier contexto adicional permanece en `Tooltip`.

Aceptación: el cliente identifica su asunto y la fecha del avance registrado, entiende qué información está disponible y puede recuperarse de un fallo sin recibir mensajes engañosos. La fecha de registro no acredita cuándo se autorizó o publicó el avance.

### Prioridades ajustadas a la operación compartida

| Prioridad | Alcance | Condición de diseño |
| --- | --- | --- |
| H3 | Captura y revisión compartidas | Guardar información incompleta, revisar y publicar la misma nota; conservar la autoría y detectar ediciones simultáneas. |
| H4 | Delegación y fechas | Tareas con responsable, prioridad y vencimiento; agenda derivada; vista de equipo para dirección. Transferir trabajo propio al reasignar el expediente y conservar delegaciones vigentes. |
| Siguiente | Repositorio documental | Búsqueda dentro del expediente como primer paso; versiones, organización avanzada y permisos de proveedores requieren un alcance posterior. |
| Pendiente | Rutas procesales verificadas | Validar tipo de persona y procedimiento; no asignar la ruta de persona natural a sociedades. Distinguir aceptación, suspensiones, continuaciones, resultados y apertura judicial mediante evidencia y revisión profesional. |
| Pendiente | Paginación de la bandeja | Consultar y ordenar el trabajo en servidor; conservar contexto, filtros y permisos con volúmenes reales. |

No se incorporan en estos hitos cálculos automáticos de términos, decisiones jurídicas autónomas, finanzas ni integraciones de mensajería.

## Fundamento y límites jurídicos

Esta es una revisión del producto desde la perspectiva jurídica, no una conclusión profesional sobre un expediente concreto.

- [Ley 1123 de 2007, artículo 28, numerales 9 y 18](https://normograma.sena.edu.co/compilacion/docs/ley_1123_2007.htm): reserva profesional e información veraz al cliente sobre la evolución y posibilidades de su asunto, sin asegurar resultados favorables. Fundamenta la publicación cuidadosa y el lenguaje preciso.
- [Ley 1581 de 2012, artículo 4](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981): calidad, acceso y circulación restringida, seguridad y confidencialidad de los datos. Fundamenta el contrato público mínimo y los controles efectivos de acceso.
- [Ley 2445 de 2025, modificaciones del CGP 532, 543, 550, 559 y 563](https://lector.ramajudicial.gov.co/SIDN/NORMATIVA/TEXTOS_COMPLETOS/7_LEYES/LEYES%202025/Ley%202445%20de%202025.pdf): el ámbito corresponde a personas naturales; radicación y aceptación se distinguen; la audiencia puede suspenderse y reanudarse; fracaso, remisión y apertura judicial son hechos distintos.
- [Decreto 1136 de 2025, registro oficial de corrección de yerros](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma_temas.jsp?i=191262): las futuras reglas deben contrastarse con el texto corregido y sus normas aplicables antes de codificar plazos o efectos.

La matriz de roles es **una política de producto propuesta para estos hitos**, no una distribución de permisos impuesta literalmente por esas leyes: auxiliar captura información interna; abogado responsable o administrador autorizan publicación y retiro según su acceso. Las decisiones profesionales requieren la habilitación y revisión correspondientes, que no se infieren del nombre del rol.

## Evidencia técnica de la revisión de la base `842ac5c`

- `backend/app/schemas/asunto.py` y `repositories/asunto_repository.py`: respuesta compartida entre oficina y portal, carga de pasos internos y filtrado de novedades.
- `backend/app/services/workflow_service.py`: avance secuencial, resultados binarios, viabilidad no confirmada rechazada y evento de paso privado.
- `backend/app/repositories/paso_repository.py`: etapa y siguiente paso derivados del workflow interno.
- `backend/app/api/v1/endpoints/novedades.py`: controles de acceso de lectura/creación y omisión en el borrado.
- `backend/app/api/v1/endpoints/documentos.py` y `repositories/documento_repository.py`: visibilidad documental y generación del evento asociado.
- `frontend/src/App.tsx`: relación entre usuario y perfil de cliente, hitos derivados de pasos y presentación del estado.

Los hitos se entregan en commits separados y se suben a Git después de su verificación. La validación incluye `npm run build`, pruebas del frontend apropiadas al cambio y `pytest`, con casos de acceso autorizado y denegado, registros retirados y estados de error.

## Entrega y verificación de H1 y H2

- **H1 (`b9c4225`):** contrato público independiente, lecturas anteriores también reducidas para el cliente, permisos de publicación y retiro en servidor, sincronización transaccional documento/evento y protección del borrado directo de eventos derivados. El preview local requiere autorización y fuerza descarga de formatos activos o desconocidos con `nosniff`.
- **H2 (`a48e453`):** portal con último avance, historial publicado y documentos; consultas separadas de la oficina; carga, error y reintento; captura privada por defecto; permisos visibles coherentes; ayudas accesibles por teclado y tap; foco y retorno en previsualización.
- **Backend:** 108 pruebas aprobadas mediante `pytest -q --durations=5`, Python 3.12 y PostgreSQL 16.15 local en una instancia nueva con datos sintéticos. Se usó la configuración de desarrollo que espera la suite OTP y `SMTP_HOST=127.0.0.1`. La conexión de pruebas utiliza IPv4 explícito para evitar la espera de resolución local observada en Windows.
- **Frontend:** 64 pruebas aprobadas mediante `npm test -- --run`; `npm run build` aprobado con Node 24 y React Compiler activo. No se añadieron dependencias ni se modificaron modelos de BD.
- **Navegador:** acceso de oficina y OTP de demostración; subida real privada y compartida; ausencia de contenido privado en el portal; foco al abrir preview y retorno al cerrar; Escape en ayudas; revisión a 1280, 390 y 320 píxeles y fechas con texto de 14 píxeles en móvil.

Las lecturas de cliente de `/asuntos`, `/novedades` y `/documentos` cambian a contratos reducidos; la interfaz de esta entrega ya los consume. Cualquier consumidor externo debe adoptar esa proyección. La fecha visible sigue siendo la fecha de registro del avance, no un certificado de publicación.

El navegador integrado recibió el PDF mediante la API, pero su visor embebido no mostró el contenido; se ofrece apertura alternativa. Los documentos cloud conservan el enlace de su proveedor: estos hitos no incorporan un proxy cloud ni certifican sus permisos externos.

## H3 y H4 — Implementación de colaboración y operación

Actualización: 4 de octubre de 2026. La prioridad acordada con el usuario es el expediente compartido y dinámico de la oficina, con una vista selectiva para el cliente.

- **Captura:** auxiliar, abogado responsable y administrador guardan borradores parciales en el mismo paso. Guardar no completa el paso ni publica actividad. Completar valida los requisitos del paso y conserva lo ya capturado. Una versión desactualizada produce conflicto y permite recargar de forma explícita.
- **Notas:** el responsable o administrador publica o retira la misma nota capturada por el equipo, conservando su identificador, autor y fecha de registro. La visibilidad de eventos derivados se gestiona desde su actuación de origen. No se añade un registro histórico de cada cambio de visibilidad en este hito.
- **Control:** el abogado responsable puede actualizar el estado del expediente. La dirección conserva la reasignación de clientes y asuntos. La auxiliar puede capturar información y actualizar el estado de sus propias tareas manuales.
- **Delegación:** responsable y administrador crean tareas internas, con instrucciones, responsable, prioridad y fecha opcional. Las tareas derivadas del flujo se completan desde su paso; su fecha y prioridad se pueden ajustar sin duplicar la captura.
- **Transferencia:** asunto, pasos y tareas abiertas propias del abogado saliente se transfieren en una transacción. Las delegaciones a auxiliares y administradores se conservan. Delegar a otro abogado requiere que sea responsable del asunto; esta entrega no introduce equipos de varios abogados por expediente.
- **Agenda:** reúne vencimientos de tareas abiertas y fechas de audiencia registradas en el paso correspondiente. La fecha se mantiene en su origen. Las fechas nuevas incluyen zona horaria; las fechas de audiencia legadas sin zona se interpretan en hora de Colombia. Una audiencia guardada como borrador aparece como fecha registrada y requiere revisión profesional.
- **Supervisión:** dirección puede consultar pendientes y agenda del equipo; cada integrante consulta su trabajo. La API limita la agenda a un intervalo máximo de 92 días y 100 elementos, informando el total; no hay paginación todavía.
- **Documentos:** búsqueda por nombre y tipo documental dentro del expediente, con coincidencias sin distinción de tildes. En el portal solo se buscan los documentos ya autorizados para ese cliente.

Esta entrega reutiliza modelos existentes; no modifica el esquema de la base de datos ni añade dependencias. Recordatorios automáticos, cálculo de términos, versionado documental, auditoría completa de publicaciones y nuevas rutas procesales quedan fuera del alcance implementado.

### Validación de H3 y H4

- **Backend:** suite completa de 169 pruebas aprobada con PostgreSQL 16.15 y Python 3.12; se añadió y aprobó después una prueba adicional de aislamiento entre firmas (170 pruebas en total). Incluye edición concurrente con conflicto 409, autorización por rol y expediente, transferencia de tareas, publicación de la misma nota y proyección de fechas.
- **Frontend:** 94 pruebas aprobadas y compilación de producción aprobada con Node 24. Se probaron borradores, recarga explícita de conflictos, permisos de tareas, agenda, errores, búsqueda documental, foco al abrir tareas y conversión de fechas con zona horaria.
- **Navegador local con datos sintéticos:** guardado de evaluación incompleta, creación y asignación a auxiliar, edición de vencimiento y aparición del mismo dato en la agenda del equipo. Revisión de agenda en 1280 y 390 píxeles y del acceso a tareas desde la agenda móvil.
- **Alcance de revisión:** implementación y revisión de frontend con 6.1 Sol en High; se intentó una revisión adicional con Luna en extra High, pero terminó por límite de uso. La revisión de backend continuó con inspección directa y pruebas automatizadas; ese intento de Luna no se cuenta como revisión completada.
