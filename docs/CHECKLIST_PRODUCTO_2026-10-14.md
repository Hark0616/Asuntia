# Base del producto y checklist de construcción

**Fecha:** 14 de octubre de 2026. **Código examinado:** `615d07f`, rama `codex/mejoras-operacion-juridica`.

**Directriz vigente:** construir Asuntia como producto operativo duradero. Las entregas serán incrementales, con datos, permisos, migraciones e interfaces reales. El tamaño de una entrega puede ser pequeño; su calidad y su integridad no son provisionales.

Este documento gobierna las prioridades sobre los planes anteriores de piloto. La [propuesta de pantallas](PROPUESTA_UX_PILOTO_2026-10-08.md) y la [filosofía UX](FILOSOFIA_UX_EVALUACIONES_2026-10-08.md) conservan su valor como especificación de interacción y razonamiento; siguen pendientes de implementación y validación con usuarios. Los nombres de sus archivos se conservan por trazabilidad.

## 1. Veredicto sobre la base

**La base tecnológica es adecuada y merece conservarse. El modelo de dominio, la operación y varios contratos todavía necesitan consolidación antes de considerar el producto listo para datos reales.**

React, TanStack Query, FastAPI, SQLAlchemy y PostgreSQL permiten resolver este producto sin cambiar de stack. El monorepo y un backend modular son apropiados para mantener juntos los cambios de datos, permisos y pantallas. No aparece una necesidad que justifique separar microservicios. Los adaptadores de almacenamiento y los trabajos asíncronos deben tener límites claros dentro de esta arquitectura.

El mayor riesgo de retrabajo está en seguir construyendo sobre dos supuestos: que todo expediente es de insolvencia y que toda fecha importante vive dentro de un paso de ese procedimiento. También conviene resolver ahora la identidad del expediente, la consistencia de las escrituras, el ciclo de vida de archivos y el acceso de equipos reales.

Esto no garantiza que nunca habrá cambios. Busca que la evolución se haga mediante extensiones y migraciones controladas, conservando información y recorridos útiles.

### Qué conservar

| Base existente | Evidencia y alcance real |
| --- | --- |
| Frontend separado de la base de datos | Cliente HTTP hacia FastAPI; organización por funciones en `frontend/src/features/`. |
| Repositorios y aislamiento por firma | `backend/app/repositories/base.py` y repositorios específicos. Es una base de control; cada consulta personalizada y relación sigue necesitando verificación. |
| Cierre y rollback de sesiones | `backend/app/core/db.py`. Conservar el manejo de excepciones y cierre. |
| Autorización en servidor y portal filtrado | `backend/app/core/access.py`, dependencias y DTO del portal. No reducir estos controles a esconder botones. |
| Entidades de clientes, tareas, documentos y novedades | Reutilizarlas y corregir sus contratos; evitar un segundo sistema paralelo. |
| Control de algunas operaciones simultáneas | Bloqueos y respuestas de conflicto en asignación, tareas y publicación. Extender de forma coherente a las operaciones restantes. |
| Migraciones y pruebas automatizadas | Alembic y suites backend/frontend existentes. Las pruebas actuales no equivalen a una validación de despliegue ni de todas las migraciones. |
| Contenedores y persistencia de archivos | `docker-compose.prod.yml` ya incluye migración y volumen de almacenamiento. Falta demostrar recuperación y operación del conjunto. |
| Dirección UX | Trabajo / Expedientes / Agenda; Resumen / Documentos / Actividad; herramientas en contexto; publicación explícita. Validar estas decisiones en recorridos completos. |

### Qué corregir de raíz

| Hallazgo comprobado | Consecuencia | Referencia principal |
| --- | --- | --- |
| `Asunto` exige una ruta y tiene valores iniciales de insolvencia; la apertura crea sus pasos. | Abrir cualquier otro asunto arrastra datos y tareas ajenas a su propósito. | `backend/app/models/asunto.py`, `backend/app/api/v1/endpoints/asuntos.py`, `backend/app/repositories/asunto_repository.py` |
| `radicado` actúa como código interno; no tiene unicidad por firma en BD. | Confusión con el radicado oficial y posibilidad de duplicación concurrente. | Modelo de asunto y apertura. |
| La agenda proyecta `fecha_hora` del JSON de `agendar_audiencia`. | No representa naturalmente varias reuniones y audiencias independientes. | `backend/app/repositories/agenda_repository.py` |
| Parte de los repositorios hace `commit`; otras operaciones se confirman desde servicios/controladores. | Es difícil garantizar que un caso de uso completo se guarde o revierta unido. | `backend/app/repositories/base.py`, carga documental. |
| El archivo se lee completo; la escritura local usa el nombre recibido y rutas absolutas como identificadores. | Falta un contrato sólido de tamaño, contenido, claves, traslado y recuperación de fallos. | `backend/app/api/v1/endpoints/documentos.py`, `backend/app/services/storage/local_storage.py` |
| Las carpetas locales se nombran por código del asunto en una raíz compartida. | Falta separación física inequívoca por firma y asunto, adicional a la autorización de la API. | Adaptador local y `factory.py`. No se afirma una filtración comprobada. |
| `Novedad.publicado_al_cliente` tiene `default=True` en el modelo. | Una nueva vía de escritura que omita el campo podría publicar por defecto. Los flujos que lo establecen explícitamente no prueban una fuga actual. | `backend/app/models/novedad.py` |
| Hay cascadas ORM `delete-orphan` y una FK de novedades con `ON DELETE CASCADE`. | El esquema permite destrucción incompatible con el criterio de conservación si se invoca otra vía de borrado. No se observó aquí un endpoint que la ejecute. | Modelos de asunto y novedad. |
| El frontend fija `firma_slug: 'demo'`; faltan flujos completos de altas/bajas del equipo. | El acceso todavía depende de supuestos del entorno de demostración. | `frontend/src/features/auth/`, endpoints de equipo. |
| OTP: correo síncrono sin TLS/timeout explícitos; resultado de envío no determina recuperación; duración comunicada distinta de la configurada. | Fallos difíciles de diagnosticar y experiencia de acceso inconsistente. | `backend/app/core/mail.py`, `backend/app/services/auth_service.py` |
| Lista de asuntos limitada por defecto a 100 y detalle dependiente del conjunto cargado en `App.tsx`. | Un expediente existente puede quedar fuera del recorrido; búsqueda y totales necesitan contratos de servidor. | Repositorio base, endpoint de asuntos y `frontend/src/App.tsx`. |
| Los tests crean tablas desde los modelos; `/health` devuelve un estado fijo. | No demuestran que las migraciones ni las dependencias de producción estén listas. | `backend/tests/conftest.py`, `backend/app/main.py`. |

## 2. Modelo objetivo y fuente única de información

| Concepto | Responsabilidad | Lo que se deriva de él |
| --- | --- | --- |
| Firma y membresía del equipo | Identidad, acceso, rol, activación y alcance. | Herramientas disponibles y consultas permitidas. |
| Cliente | Perfil permanente, separado de su acceso al portal. | Referencia reutilizable desde sus asuntos, sin recapturar identidad. |
| Asunto | Título, código interno, cliente, responsable, estado operativo y datos jurídicos pertinentes. | Resumen, búsqueda, carga del equipo y contexto del portal. |
| Ruta opcional y sus actuaciones | Guía específica de un procedimiento cuando aplica. | Progreso de la guía; nunca imponerla para poder crear un asunto. |
| Tarea | Trabajo pendiente, responsable, fecha límite cuando corresponda y resultado. | Bandeja de trabajo y pendientes del expediente. |
| Cita | Reunión o audiencia con instante, zona horaria, duración, participantes/responsabilidad, enlace o lugar y resumen. | Agenda global y agenda del expediente. El modelo de participantes debe definirse antes de migrar, sin duplicar usuarios. |
| Documento | Metadatos, ubicación opaca, integridad, estado de carga y autorización de acceso. | Biblioteca, evidencia asociada y documentos visibles para el cliente. |
| Novedad | Registro de lo ocurrido, autor, fecha y relaciones con evidencia o actuación. | Actividad interna y selección publicada al cliente. |
| Autorización de publicación | Estado y trazabilidad de quién comparte o retira acceso a cada recurso. | Proyección del portal; nunca una copia editable de la historia. Puede residir en el recurso si satisface el contrato. |
| Auditoría | Eventos relevantes atribuibles a un actor, firma, recurso y momento. | Reconstrucción de asignaciones, publicaciones y cambios sensibles. No sustituirla con `updated_at`. |

Estado operativo, etapa de una guía y siguiente tarea no son el mismo dato. Se deben definir sus significados y derivaciones antes de añadir controles para editarlos. Si se conserva una proyección almacenada por rendimiento, documentar su actualización y reconstrucción; no pedir al usuario mantenerla en paralelo.

Una fecha límite sin hora no se convierte automáticamente en una reunión. Las citas usan instantes y zona horaria; los vencimientos conservan semántica de fecha cuando corresponde. No incluir cómputo jurídico automático sin una especificación jurídica independiente.

La autorización de una novedad no autoriza sus documentos por implicación. Tampoco publica automáticamente enlaces privados de reuniones. La revisión de publicación debe mostrar exactamente qué podrá ver el cliente.

## 3. Cómo se usa este checklist

Cada casilla representa un resultado verificable, no la mera existencia de una clase o pantalla. Se marca al adjuntar cambio, pruebas pertinentes y evidencia de aceptación. Las casillas quedan abiertas cuando el código ofrece una parte del resultado, pero no satisface todavía su criterio completo.

- **P0:** resolver antes de operar con información real o antes de construir funciones dependientes de ese contrato.
- **P1:** necesario para completar la experiencia principal con calidad de producto.
- **P2:** mejora posterior sustentada por uso o medición; no impide construir correctamente el núcleo.

P0 no significa que todos los hallazgos sean vulnerabilidades demostradas. Incluye integridad, recuperación y decisiones estructurales. Las prioridades siguientes no son una estimación de duración.

### A. Coherencia y alcance

- [x] **A01 · P0 · Establecer una dirección vigente.** Por qué: varios documentos aún prescribían un piloto o acceso directo a Supabase. Terminado en este hito documental: este checklist gobierna prioridades; roadmap, producto y estrategia de BD apuntan al mismo enfoque. Las funciones continúan pendientes.
- [ ] **A02 · P0 · Fijar contratos e invariantes del núcleo.** Por qué: cambiar nombres sin corregir significados conserva la duplicación. Terminado cuando exista un mapa de entidades, estados y relaciones con ejemplos de creación, archivo, reactivación y visibilidad, vinculado a DTO y pruebas; resolver código interno/radicado, responsables y fechas antes de sus migraciones.
- [ ] **A03 · P1 · Acordar responsabilidades por acción.** Por qué: secretaria, abogado y jefe colaboran sin perder control profesional. Terminado con una matriz comprobada de crear, asignar, actualizar, publicar, retirar, archivar y consultar por rol y por asunto; el cliente solo accede a su proyección autorizada. Reutilizar esa matriz en API y pruebas de interfaz.

### B. Dominio e integridad

- [x] **B01 · P0 · Desacoplar el expediente de insolvencia.** Por qué: es el contenedor general del trabajo. Terminado al abrir y operar un asunto sin ruta; añadir una guía compatible cuando se necesite; conservar los asuntos existentes mediante migración y pruebas de compatibilidad. Depende de A02.
- [x] **B02 · P0 · Identificar inequívocamente el asunto.** Por qué: código interno y radicado oficial tienen propósitos distintos. Terminado con título propio, código único por firma garantizado en BD, radicado oficial opcional según el caso y manejo de colisiones concurrentes; migrar valores existentes sin inventar radicados.
- [ ] **B03 · P0 · Unificar estados y derivaciones.** Por qué: etapa, siguiente paso y tareas pueden divergir si se capturan por separado. Terminado con una fuente por dato, reglas explícitas de actualización y pruebas de que cambiar la fuente actualiza todas las vistas sin doble captura.
- [ ] **B04 · P0 · Establecer transacciones por caso de uso.** Por qué: abrir, asignar o actualizar no debe dejar resultados parciales. Terminado al eliminar confirmaciones implícitas que rompan la operación, mantener SQL en repositorios y probar rollback con fallos intermedios. Preservar la apertura atómica de cliente y asunto que ya existe.
- [ ] **B05 · P0 · Reforzar relaciones entre firmas.** Por qué: filtrar una tabla no valida automáticamente todos sus identificadores relacionados. Terminado con validaciones y restricciones pertinentes para padres, responsables, clientes y documentos; pruebas negativas cruzadas por cada operación, incluyendo recursos archivados y consultas personalizadas.
- [ ] **B06 · P0 · Hacer consistente la conservación histórica.** Por qué: soft delete debe ser una propiedad del sistema completo. Terminado al revisar cascadas, rutas de archivo y restauración, conservar referencias y demostrar que acciones de negocio no destruyen físicamente registros ni archivos históricos. Definir retención y accesos con la firma antes de automatizar cualquier depuración.
- [ ] **B07 · P0 · Resolver concurrencia y respuestas perdidas.** Por qué: un doble clic, dos usuarios o una respuesta que no llega no deben duplicar ni sobrescribir trabajo silenciosamente. Terminado con política por comando: conflicto explícito, deduplicación cuando corresponda y consulta del resultado antes de reintentar; probar creación, asignación, publicación y carga. Los bloqueos actuales son un punto de partida.
- [ ] **B08 · P0 · Registrar auditoría útil y protegida.** Por qué: debe saberse quién hizo qué, especialmente al compartir o reasignar. Terminado con eventos de acciones sensibles, cambios atribuibles, consultas autorizadas y ausencia de edición desde el cliente; no registrar secretos ni copiar documentos completos en logs.

### C. Identidad, equipo y acceso

- [x] **C01 · P0 · Resolver la firma sin constantes de demostración.** Por qué: una instalación real necesita contexto inequívoco. Terminado con resolución/configuración de firma en el ingreso y pruebas de firma desconocida, inactiva o ajena; ninguna operación normal exige usar `demo`.
- [x] **C02 · P0 · Completar el ciclo de vida del equipo.** Por qué: el jefe debe incorporar, asignar y retirar acceso sin modificar seeds o BD a mano. Terminado con alta o invitación, activación, cambio de rol, desactivación y reasignación explícita del trabajo; impedir que una baja deje el control de la firma inaccesible.
- [x] **C03 · P0 · Fortalecer autenticación y recuperación.** Por qué: el acceso debe resistir abuso y errores cotidianos. Terminado con límites de intentos/solicitudes, OTP consumido atómicamente una vez, expiración coherente, recuperación de contraseña y errores que no revelen cuentas; pruebas de solicitudes concurrentes, caducadas y reutilizadas.
- [x] **C04 · P0 · Completar la vida de la sesión.** Por qué: cerrar sesión, cambiar permisos o desactivar un usuario debe tener efectos comprobables. Terminado con política de revocación y expiración, revalidación de firma/usuario, limpieza de caché al salir y recuperación clara ante 401 sin publicar ni reenviar una acción automáticamente.
- [ ] **C05 · P0 · Verificar cookies, origen y secretos en despliegue.** Por qué: las propiedades locales no prueban el acceso seguro en dominios reales. Terminado con HTTPS, dominio compartido, cookies seguras, CORS explícito, defensa CSRF/origen verificada y configuración que rechace valores inseguros; incluir pruebas de solicitudes desde orígenes no autorizados.
- [ ] **C06 · P0 · Hacer confiable el envío de acceso por correo.** Por qué: un OTP generado pero no entregado no completa el recorrido. Terminado con proveedor transaccional configurado, transporte seguro, timeout, fallos observables, reintentos acotados y mensajes de expiración derivados de la misma configuración. Sacar I/O bloqueante del ciclo async y llevar envíos masivos a cola; validar entrega en un entorno controlado, sin prometer recepción garantizada.

### D. Documentos y almacenamiento

- [ ] **D01 · P0 · Definir claves y contrato de almacenamiento.** Por qué: una ruta absoluta o el nombre del proveedor no debe determinar la identidad de un documento. Terminado con claves opacas por firma/asunto, nombre original como metadato, lectura autorizada y contrato común de guardar/leer/consultar; migrar referencias existentes con verificación de integridad.
- [ ] **D02 · P0 · Validar y limitar cargas.** Por qué: memoria, tipo declarado y nombres enviados no son límites confiables. Terminado con límites consistentes en proxy/API, lectura acotada, formatos permitidos, comprobación de contenido, nombres seguros y contención de rutas; pruebas de archivo vacío, exceso de tamaño, MIME falso, nombre malicioso e interrupción. Definir tratamiento de archivos activos o sospechosos antes de permitir previsualización.
- [ ] **D03 · P0 · Resolver fallos entre archivo y metadatos.** Por qué: la BD y el almacenamiento no comparten una transacción. Terminado con estados de carga y reconciliación/compensación; un archivo fallido no aparece como disponible, un reintento no duplica y un archivo inexistente no produce metadatos ficticios. Probar fallos antes y después de la escritura y del commit.
- [ ] **D04 · P0 · Cerrar permisos de lectura, descarga y publicación.** Por qué: conocer una URL o publicar una novedad no concede acceso a un archivo. Terminado con autorización actual en todas las vías, recursos privados por defecto, retiro de acceso efectivo y respuestas seguras para contenido; pruebas desde otro cliente, otra firma y sesión retirada. Evitar enlaces permanentes que eludan el backend.
- [ ] **D05 · P1 · Completar la biblioteca útil.** Por qué: subir archivos sin encontrarlos o relacionarlos no resuelve el trabajo. Terminado con carga, búsqueda, filtro, vista/descarga y asociación a tarea o novedad desde el expediente; un único cargador reutilizable conserva el avance que se estaba escribiendo. Mostrar progreso, cancelación y recuperación acordes con el contrato real de carga.

**Aclaración de alcance del usuario (2026-10-15):** la primera firma conserva sus
archivos en **OneDrive personal**, confirmado por el usuario. La entrega documental
debe funcionar con almacenamiento local del servidor o conexión a OneDrive por firma; Google Drive queda como
extensión posterior del mismo contrato. OneDrive deja de ser una integración
hipotética para esta entrega. D01–D04 no se aceptan solo con el proveedor local.
La conexión debe permitir seleccionar una carpeta existente, consultar y vincular
archivos al expediente sin duplicarlos ni reorganizarlos automáticamente, y cargar
nuevos archivos en el destino elegido. El UUID del documento en Asuntia conserva
su identidad, separado de la ubicación y los identificadores del proveedor;
también conserva la conexión/cuenta concreta a la que pertenece el archivo.
Cambiar el destino de nuevas cargas no migra documentos anteriores; desconectar
OneDrive no debe desviar cargas silenciosamente al almacenamiento local.
La publicación al cliente continúa siendo explícita y autorizada por Asuntia.
La sincronización completa, la edición colaborativa y el versionado no quedan
incorporados por esta aclaración. Las ediciones externas y referencias ausentes
deben tener un comportamiento definido antes de aceptar lectura/publicación.

### E. Recorridos completos del equipo y del cliente

- [ ] **E01 · P1 · Abrir y encontrar cualquier expediente.** Por qué: es el inicio del trabajo real. Terminado cuando abogado y secretaria puedan abrir según permisos, reutilizar o crear un cliente sin duplicarlo y llegar al resumen guardado; validaciones concisas y recuperación ante error. Depende de B01–B05 y C01.
- [ ] **E02 · P1 · Asignar y trabajar sobre lo recibido.** Por qué: la asignación debe convertirse inmediatamente en trabajo visible. Terminado con responsable claro, reasignación auditada, bandeja personal y acceso al expediente aun sin tareas; la secretaria puede organizar y el jefe consultar/distribuir según A03. No añadir aceptación/rechazo obligatorio sin necesidad explícita.
- [ ] **E03 · P1 · Entender y actualizar la historia del asunto.** Por qué: una lista de estados no explica qué ocurrió ni qué sigue. Terminado con resumen actual, actividad cronológica, tareas y guía opcional coherentes; autoría, fechas y evidencia visibles; instrucciones completas dentro de la tarea. Evitar repetir la captura en resumen y actividad.
- [ ] **E04 · P0 · Establecer publicación privada por defecto.** Por qué: publicar información al cliente es una decisión deliberada. Terminado con defaults coherentes en modelo/BD/DTO/servicio, guardado interno para todos los roles y revisión única de publicación autorizada; probar retiro, publicación concurrente y documentos vinculados privados. Depende de B07–B08 y D04.
- [ ] **E05 · P1 · Completar el portal del cliente.** Por qué: debe entender el avance y acceder a la evidencia autorizada con facilidad. Terminado con ingreso, selección de sus asuntos, estado explicado mediante información publicada, novedades y documentos autorizados; funcionamiento móvil, sesión caducada y estados sin publicaciones. Nunca exponer notas, tareas o enlaces internos por defecto.
- [ ] **E06 · P1 · Dar al jefe una visión accionable.** Por qué: necesita ayudar y asignar, no solo contar expedientes. Terminado con carga por responsable, pendientes, asuntos sin asignar y acceso directo al contexto; totales provenientes de la consulta completa, filtros claros y cambios sujetos a la misma autorización y auditoría.

### F. Agenda, audiencias y fechas

- [ ] **F01 · P0 · Crear la entidad canónica de cita.** Por qué: una fecha dentro de un paso no soporta la agenda requerida. Terminado con reuniones y audiencias múltiples por asunto, fecha/hora/zona, duración, responsabilidad/participantes, enlace o lugar y resumen; migrar audiencias existentes sin duplicarlas. La guía referencia la cita existente cuando la necesita. Depende de A02 y B04–B05.
- [ ] **F02 · P1 · Completar creación y cambios de citas.** Por qué: el equipo debe poder programar, reprogramar y cancelar desde su contexto. Terminado con controles de permiso, validación temporal, autoría, historial de cambios, enlace seguro y resumen; no recapturar la cita en el calendario. Distinguir resumen preparatorio y resultado posterior si ambos son necesarios.
- [ ] **F03 · P1 · Entregar agenda personal y de equipo.** Por qué: abogado, secretaria y jefe consultan alcances diferentes. Terminado con calendario y lista accesible alimentados por la misma consulta, filtros por persona/asunto y entrada desde el expediente; abrir la reunión/audiencia y leer su resumen directamente. La secretaria ve el alcance operativo autorizado, no una agenda vacía por no ser abogada titular.
- [ ] **F04 · P1 · Resolver límites temporales y cambios.** Por qué: zonas horarias, citas canceladas y límites de mes causan errores reales. Terminado con pruebas de conversión y ventanas, fechas sin hora preservadas, cancelaciones y reprogramaciones coherentes en todas las vistas. Recordatorios, si se incorporan, necesitan canal, destinatario y reintentos explícitos; no simularlos con mensajes sin entrega.

### G. Experiencia e implementación de interfaz

- [ ] **G01 · P1 · Implementar navegación estable.** Por qué: la sencillez depende de saber dónde estás y volver sin perder contexto. Terminado con Trabajo / Expedientes / Agenda, URLs directas a expediente y pestaña, historial del navegador y conservación de filtros/posición; las vistas locales de todas las tareas o citas permanecen bajo el expediente.
- [ ] **G02 · P1 · Consolidar el sistema visual.** Por qué: el acabado debe ser coherente en cada herramienta. Terminado con tokens de tipografía, espaciado, color y estados; controles y patrones reutilizables; jerarquía clara y acciones reconocibles. Evitar que cada pantalla invente sus propios botones, tamaños y formularios.
- [ ] **G03 · P1 · Completar accesibilidad y adaptación.** Por qué: la facilidad debe funcionar con teclado, teléfono y distintas capacidades. Terminado con foco visible y restaurado, modales y tooltips utilizables, etiquetas y errores asociados, contraste verificado, zoom sin pérdida y objetivos táctiles de al menos 44 px según la propuesta; probar recorridos completos con teclado y lector de pantalla. No declarar conformidad normativa solo por pasar pruebas automáticas.
- [ ] **G04 · P1 · Diseñar los estados difíciles.** Por qué: cargar, fallar o perder conexión también es parte del producto. Terminado con vacíos accionables, progreso real, errores recuperables y confirmación del resultado; borradores sensibles en memoria dentro del expediente, aviso al salir y limpieza al cerrar sesión. No guardar contenido jurídico en almacenamiento persistente del navegador como solución implícita.
- [ ] **G05 · P1 · Dividir la orquestación del frontend.** Por qué: `App.tsx` concentra rutas, datos y acciones, dificultando mantener consistencia. Terminado con responsabilidades separadas de sesión, páginas y consultas/mutaciones por función, invalidación coherente y DTO tipados; mantener React Compiler y evitar una segunda caché manual del servidor.
- [ ] **G06 · P1 · Validar recorridos con los cuatro perfiles.** Por qué: las seis evaluaciones previas son hipótesis expertas, no evidencia de uso real. Terminado al observar abogado, secretaria, jefe y cliente completar sus tareas sobre componentes reales con datos controlados; registrar dudas, errores y recuperación, corregirlos y volver a verificar. Se pueden probar partes pequeñas sin construir otra aplicación desechable.

### H. Rendimiento, pruebas y operación

- [x] **H01 · P0 · Separar consultas de lista y detalle.** Por qué: el límite actual y las relaciones cargadas penalizan corrección y rendimiento. Terminado con detalle por ID independiente de listas, búsqueda/filtros/paginación en servidor, orden estable y totales correctos; probar más de 100 asuntos, acceso directo y cambios entre páginas, midiendo consultas para evitar N+1 o carga de historias completas innecesaria.
- [ ] **H02 · P0 · Probar migraciones y datos existentes.** Por qué: `create_all` no ejecuta Alembic. Terminado con pruebas sobre BD vacía y sobre un estado anterior con datos representativos; validar backfill, restricciones, integridad y procedimiento de recuperación ante fallo. Cada cambio de modelo sincroniza Pydantic y TypeScript y usa revisión autogenerada inspeccionada.
- [ ] **H03 · P0 · Automatizar las puertas de calidad.** Por qué: una ejecución local no protege los siguientes cambios. Terminado con CI que ejecute build, pruebas frontend/backend y migraciones; añadir pruebas de navegador de apertura/asignación, actualización/publicación, carga/descarga y citas por rol; incluir accesos denegados y fallos relevantes. No exigir un porcentaje arbitrario de cobertura como sustituto de estos recorridos.
- [ ] **H04 · P0 · Hacer reproducible la instalación.** Por qué: rangos de dependencias y entornos distintos pueden producir resultados distintos. Terminado con dependencias resueltas de forma reproducible, inventario compatible, análisis de vulnerabilidades y una fuente de mantenimiento que sincronice pyproject/requirements requeridos; instalación limpia comprobada, sin secretos ni paquetes instalados solo localmente.
- [ ] **H05 · P0 · Verificar el despliegue completo.** Por qué: tener Dockerfiles no demuestra una operación funcional. Terminado al desplegar en staging con HTTPS, proxy y límites, cookies/CORS reales, BD por el pooler requerido en producción, migraciones ordenadas, persistencia tras reinicio y configuración validada; documentar promoción y recuperación. No exponer puertos internos sin necesidad.
- [ ] **H06 · P0 · Probar respaldo y restauración.** Por qué: el volumen persistente no es un respaldo. Terminado con copias coordinadas de BD/archivos, protección y acceso restringido, objetivos de pérdida/tiempo de recuperación acordados, alertas de fallo y restauración ensayada verificando archivos y referencias. No considerar cerrado por la sola existencia de un script.
- [ ] **H07 · P0 · Añadir observabilidad y preparación real.** Por qué: salud del proceso y salud del servicio son distintas. Terminado con liveness/readiness diferenciadas, logs estructurados con correlación y sin secretos, errores de correo/almacenamiento/BD detectables y alertas accionables con responsable y procedimiento de respuesta.
- [ ] **H08 · P1 · Comprobar capacidad y soporte.** Por qué: la experiencia también depende de volumen, latencia y recuperación. Terminado con volumen de referencia acordado, medición de listas/agenda/cargas, límites documentados, jobs pesados fuera de HTTP y procedimiento para incidentes y solicitudes de soporte con acceso auditado.
- [ ] **H09 · P2 · Optimizar a partir del uso medido.** Por qué: una caché, índice o automatización sin cuello de botella demostrado aumenta mantenimiento. Terminado por mejora concreta con evidencia anterior/posterior, sin romper permisos, invalidación ni fuente única de datos.

## 4. Orden de ejecución recomendado

| Entrega | Resultado usable y duradero | Dependencias y motivo |
| --- | --- | --- |
| 1. Contratos y expediente general | Apertura real con identidad correcta, cliente, responsable y ruta opcional; conserva expedientes anteriores. | A02–A03, B01–B07, H01–H03 en la parte afectada. Corregir el contenedor antes de multiplicar pantallas dependientes. |
| 2. Acceso y documentos confiables | Equipo administrable, ingreso sin `demo`, carga/lectura autorizada y recuperación de fallos. | C01–C06 y D01–D04. Contratos de almacenamiento y acceso pueden avanzar junto a entrega 1, sin esperar al acabado visual. |
| 3. Trabajo y comunicación completos | Bandeja, expediente, tareas, biblioteca, actividad y publicación que el cliente puede consultar. | B08, E01–E06, D05; G01–G05 integrados en cada recorrido. La información publicada debe provenir de operaciones ya consistentes. |
| 4. Agenda completa | Programar múltiples citas, reprogramar, entrar al enlace y consultar resúmenes desde agenda o expediente. | F01–F04 sobre el asunto general. Diseñar F01 junto con A02; implementar el calendario después del contrato. |
| 5. Verificación operativa integral | Cuatro perfiles completan recorridos en staging, recuperación ensayada y despliegue reproducible. | G06 y H04–H08; pruebas y accesibilidad se incorporan desde la primera entrega, esta etapa verifica el conjunto. |

Cada entrega incluye la migración necesaria, API, permisos, interfaz y pruebas que le correspondan. Los hitos en Git deben describir resultados reales y quedar revisables. No considerar un cambio terminado por compilar si todavía depende de editar datos a mano o de una pantalla simulada.

**Primera implementación recomendada:** A02/A03 y una entrega vertical de B01/B02/B04/H01: abrir un expediente general y volver a él por URL, con transacción consistente y migración de los existentes. En paralelo se puede cerrar el diseño de C01 y D01; los controles de privacidad y acceso P0 preceden cualquier uso de datos reales.

## 5. Criterio de producto listo

El núcleo estará listo cuando los recorridos de crear, asignar, actualizar, subir, compartir, consultar y agendar funcionen con los cuatro perfiles, sobrevivan errores y reingresos, y cumplan los criterios P0/P1 aplicables. Las verificaciones deben incluir datos controlados en staging y prueba de recuperación, no solo capturas de pantalla o tests unitarios.

Mejorar la calidad no amplía automáticamente el alcance: versionado documental continúa fuera por instrucción del usuario. La conexión documental a OneDrive sí forma parte de la entrega por la aclaración del 2026-10-15. IA, finanzas, sincronización completa Google/Microsoft, mensajería, acceso offline y cómputo automático de términos requieren una decisión de producto propia. Los límites del núcleo deben permitir futuras extensiones sin implementar hoy funciones especulativas.

## 6. Evidencia, límites y referencias

La evaluación revisa modelos, repositorios, servicios, endpoints, componentes principales, pruebas, configuración y documentos del repositorio. No constituye una auditoría de seguridad completa ni una certificación jurídica. No se han inspeccionado una instalación productiva, sus secretos, respaldos o cuentas de proveedores; sus controles permanecen pendientes de verificación. Tampoco se ha observado aquí a usuarios finales trabajando.

Comprobaciones sobre el código examinado, realizadas el 14 de octubre:

| Comprobación | Resultado y límite |
| --- | --- |
| `npm run build` | Correcto: TypeScript y compilación Vite. No prueba recorridos reales de navegador. |
| `npm test -- --run` | Primera ejecución: 93 pruebas correctas y una agotó el límite de 5 segundos en la apertura de asunto. Se ejecutaba junto con otras verificaciones; la causa exacta no se ha demostrado. |
| `npm test -- --maxWorkers=2` | Repetición completa: 94 pruebas correctas, 15 archivos. Sin modificar código, tests ni límites de tiempo. Conservar el primer resultado como señal a investigar si se repite en CI. |
| `pytest -q` | 170 pruebas correctas en PostgreSQL local, usando la base aislada `asuntia_test`; duración de 299,93 segundos. No valida una instalación productiva ni la cadena Alembic. |
| `alembic heads` | Una cabeza: `8d5db36e435d`. Esto no prueba aplicar la cadena ni recuperar datos. |
| Revisión del checklist | 47 criterios con identificadores únicos; enlaces locales existentes. Solo A01 queda cerrado por este hito documental. |

Los cambios de este hito son documentales: ninguna casilla funcional se da por implementada por incluirla en el plan.

La delimitación transaccional sigue el criterio de confirmar una operación completa o revertirla ante un error; el límite se decide por caso de uso manteniendo las consultas en repositorios. Referencia: [SQLAlchemy: Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html).

Los controles de carga propuestos combinan autorización, límites, validación de contenido y nombres/ubicaciones controlados por la aplicación. Su implementación deberá cubrir las vías de lectura además de la subida. Referencia: [OWASP: File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).


## 7. Primera implementación: expediente general

**Cambio:** [17cafb5](https://github.com/Hark0616/Asuntia/commit/17cafb5).
**Contratos y permisos afectados:** [CONTRATOS_NUCLEO.md](CONTRATOS_NUCLEO.md).

- **B01 cerrado:** apertura sin guía ni tareas automáticas de insolvencia; guía
  opcional en la apertura o incorporada después desde el expediente. No se permite
  reemplazar una guía existente. Las rutas y actuaciones históricas se conservan.
- **B02 cerrado:** título obligatorio, código interno único por firma en PostgreSQL
  (incluye archivados), radicado oficial opcional y separado, alias legado sin
  duplicar columnas, conflictos 409 y reintento de colisiones de códigos generados.
  La radicación de la guía alimenta la referencia canónica sin exigir recapturarla.
- **B04 parcial:** apertura y alta opcional del cliente/cuenta/guía/tarea con commit
  en servicio y rollback probado ante fallos intermedios. Las confirmaciones de los
  demás casos de uso siguen pendientes de revisión.
- **H01 parcial:** detalle por UUID y acceso por URL independientes de las listas,
  incluido un expediente fuera de los primeros 100 y un cliente fuera del directorio
  cargado. Búsqueda, filtros, paginación, totales y medición de consultas siguen abiertos.
- **A02/A03, B05/B07 y H02/H03 parciales:** contratos y pruebas de las operaciones
  afectadas. No se declaran cerrados sus criterios completos.

### Verificación de esta entrega

| Evidencia | Resultado y límite |
| --- | --- |
| Backend completo, `pytest -q` | 193 pruebas correctas, 316,64 s. Después se añadieron dos casos de integración y se ajustó la validación de la referencia oficial. |
| Backend afectado, `pytest tests/test_expediente_general.py tests/test_workflow.py tests/test_colaboracion.py -q` | 66 pruebas correctas sobre la versión final, incluidas las dos nuevas; 73,85 s. |
| Frontend, Vitest con Node 24.19.0 y `--maxWorkers=2` | 99 pruebas correctas. Node 20.11 del sistema no puede iniciar jsdom actual; la compatibilidad/reproducibilidad general de H04 sigue pendiente. |
| `npm run build` | Correcto: TypeScript y Vite. |
| Alembic real en bases desechables | Tres pruebas: cadena vacía, actualización de datos históricos (incluidos archivados y referencia oficial), y aborto transaccional ante códigos duplicados. |
| Migración local `alembic upgrade head` y `alembic check` | Correctos; sin diferencias entre esquema y modelos. Revisión autogenerada e inspeccionada `f112d368f6d4`. |
| Navegador local | Apertura desde formulario con cliente existente, sin guía, y recarga de su URL con título/código conservados. Formulario revisado en escritorio y viewport móvil de 390 px; no equivale a prueba en teléfono físico ni con usuarios finales. |

La migración aborta si hay códigos históricos duplicados por firma para que se
resuelvan expresamente antes de reintentar; no los renombra. El downgrade se bloquea
si ya existen asuntos sin guía, porque la versión anterior no puede representarlos.
Para recuperar esa versión se necesita una copia compatible, no inventar rutas de
insolvencia. El siguiente bloque del expediente es completar H01 con listas y
búsquedas de servidor antes de cerrar el recorrido E01.


## 8. Búsqueda completa y contexto real de firma

**Cambios:** [93370c2](https://github.com/Hark0616/Asuntia/commit/93370c2)
(búsqueda y directorio ligeros),
[f216727](https://github.com/Hark0616/Asuntia/commit/f216727)
(interfaz de búsqueda e ingreso por firma) y
[75b574a](https://github.com/Hark0616/Asuntia/commit/75b574a)
(verificaciones automáticas).

- **H01 cerrado:** búsqueda de resúmenes con filtros de servidor, paginación,
  orden estable y total completo de la consulta autorizada. La consulta de página
  y total ejecuta una sola sentencia; no carga historias, documentos ni tareas.
  El directorio cuenta asuntos sin cargar expedientes. La interfaz usa este
  contrato tanto en la lista global como en los asuntos del cliente, obtiene el
  detalle por UUID y conserva filtros/página al abrir y volver. El endpoint de
  lista anterior se conserva por compatibilidad, sin usarse en la interfaz.
- **C01 cerrado:** firma explícita en los tres comandos de ingreso; captura
  compartida, enlace `?firma=identificador` y configuración opcional
  `VITE_FIRMA_SLUG`. No existe fallback implícito a `demo`. Pruebas de acceso
  exitoso a una firma nueva, firma desconocida, inactiva o ajena y OTP que no puede
  usarse en otra firma. Desactivar la firma corta sus sesiones existentes.
- **C04 parcial:** cada petición autenticada vuelve a validar la firma, además
  del usuario/rol. La revocación individual, recuperación global ante 401 y las
  restantes condiciones siguen abiertas.
- **G01/G05 parciales:** filtros en URL y lista separada por función; se retiró de
  `App.tsx` la descarga y reconstrucción de todos los detalles. La navegación
  completa, posición de scroll y la división restante siguen pendientes.
- **H03 parcial:** CI real para build, pruebas frontend/backend y migraciones en
  PostgreSQL 16. Faltan los recorridos automatizados de navegador por rol.

### Evidencia de aceptación

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo con ambos contratos, `pytest -q` | 232 pruebas correctas, 336,43 s, incluida la cadena real Alembic. |
| Búsqueda afectada tras endurecer el filtro por responsable | 20 pruebas correctas, 11,99 s. |
| Frontend completo con Node 24 | 111 pruebas correctas; build TypeScript/Vite correcto. |
| Volumen y paginación | 121 asuntos del mismo conjunto recorridos sin omisiones ni duplicados; orden determinista, detalle del último resultado y total correcto en páginas vacías. |
| Aislamiento y relaciones | Abogado limitado a sus asuntos, filtros de otra firma o padre archivado sin resultados, nombres e IDs relacionados de otra firma excluidos, 401/403/422 y búsquedas literales con comodines. |
| Consultas medidas | Una sentencia para búsqueda de 1 y de 100 filas; una para directorio con totales. Sin consultas a pasos, novedades, tareas ni documentos en esas listas. |
| Estados y navegación | Pruebas de filtros, historial, volver desde detalle, fallo/reintento, página que queda vacía tras archivar y lista del mismo cliente independiente de la consulta global. |
| Navegador local | Búsqueda por código, apertura y regreso con filtros, ancho móvil de 390 px sin desbordamiento horizontal; ingreso con firma explícita y conservación entre formularios. |
| GitHub Actions | [Ejecución de f216727](https://github.com/Hark0616/Asuntia/actions/runs/38665697855) correcta en ambos jobs, incluida instalación limpia con `npm ci` y PostgreSQL independiente. |

No se requiere migración para esta entrega: no cambia el modelo persistido. La
instalación declara la versión compatible de Node y el workflow fija Node 24;
H04 permanece abierto por su alcance de dependencias y análisis de vulnerabilidades.
La apertura con búsqueda de clientes fuera del directorio cargado, el ciclo del
equipo, almacenamiento, publicación, citas y verificación operativa mantienen
sus criterios pendientes en el checklist.

## 9. Equipo y ciclo de sesión

**Cambios:** [58435b3](https://github.com/Hark0616/Asuntia/commit/58435b3)
(backend de invitaciones, roles y bajas) y
[289c4ad](https://github.com/Hark0616/Asuntia/commit/289c4ad)
(interfaz de equipo y recuperación de sesión).

- **C02 cerrado:** Ajustes → Equipo permite invitar, activar, cambiar rol,
  cancelar invitaciones, retirar acceso y reincorporar conservando la identidad.
  El administrador comparte el enlace generado; no se envía correo automáticamente.
  El enlace vence en 24 horas, se guarda como HMAC y solo puede consumirse una vez.
  La contraseña se crea en la activación y no se muestra a administración.
- La baja exige reemplazo cuando hay trabajo y transfiere clientes, asuntos y
  tareas abiertas en una transacción. Conserva tareas terminadas, autores y
  delegaciones a otros miembros. El paso a auxiliar transfiere el trabajo activo;
  el paso a abogado transfiere sus tareas de asuntos ajenos. No se permite retirar
  al último administrador activo
  ni modificar el propio acceso. Las pantallas obsoletas reciben 409.
- Los comandos que asignan trabajo y los cambios del equipo comparten un bloqueo
  por firma para evitar asignaciones a un usuario que está siendo retirado. Las
  pruebas incluyen apertura y baja simultáneas y dos administradores que intentan
  retirarse mutuamente. Un fallo al confirmar revierte la baja y la transferencia.
- **C04 cerrado:** JWT con revisión del usuario, expiración configurada y
  revalidación de firma, usuario y rol. Cerrar sesión revoca todos los tokens de
  la identidad; reincorporar o devolver el rol anterior no restaura tokens viejos.
  Un 401 protegido limpia caché, descarta respuestas anteriores y vuelve al ingreso
  sin repetir acciones. Los fallos de conexión al cerrar sesión se muestran como
  fallos. La política y el cambio de formato de cookies están en
  `docs/CONTRATOS_NUCLEO.md`.
- La consulta puede actualizarse para recuperar el alta cuyo resultado se perdió
  y generar otro enlace desde la identidad existente, sin crear duplicados.

### Evidencia de aceptación

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo, `pytest -q` | 253 pruebas correctas en 346,95 s, incluidas migraciones reales. |
| Equipo | 19 pruebas nuevas: alta/activación/ingreso, secretos, vencimiento, renovación/cancelación, duplicados concurrentes, autorización, validaciones, versiones, límites administrativos, revocación, transferencias, concurrencia y rollback. |
| Frontend completo con Node 24 | 124 pruebas correctas sobre la versión final; build TypeScript/Vite correcto. |
| Sesión | Cookie revocada incluso al reproducirla, otras sesiones invalidadas al cerrar, expiración, ausencia de revisión, 401 global y respuesta tardía de sesión anterior. |
| Navegador local | Navegación desde menú, carga real, formulario de reasignación, ancho móvil de 390 px sin desbordamiento. Cierre en otra pestaña, recuperación al consultar y nuevo ingreso sin repetir la acción anterior. La activación con contraseña se verifica mediante pruebas de API e interfaz. |
| GitHub Actions | [Ejecución de 289c4ad](https://github.com/Hark0616/Asuntia/actions/runs/38668242460) correcta en frontend y backend con PostgreSQL independiente. |

No se añadió una tabla ni dependencia: se reutiliza `AuthChallenge` y la revisión
existente del usuario. No se necesita migración para esta entrega. B08 continúa
abierto: revocar sesiones y conservar autores no sustituye una bitácora de cambios.
En este corte, C03, C05 y C06 quedaban pendientes de recuperación, límites de abuso,
verificación en dominios reales y entrega de correo.

## 10. Autenticación y recuperación de acceso

**Backend:** [28decaf](https://github.com/Hark0616/Asuntia/commit/28decaf).
Interfaz integrada en `/recuperar-acceso`, con entrada desde el ingreso de oficina.

- **C03 cerrado:** límites por identidad normalizada e IP de la firma, compartidos
  entre procesos mediante UPSERT condicional de PostgreSQL. Los presupuestos
  incluyen identidades inexistentes, se conservan al reiniciar la API y responden
  429 con `Retry-After`, legible entre orígenes mediante CORS. La interfaz muestra
  el tiempo recibido y conserva la captura para reintentar.
- Emisión y consumo de OTP serializados, un código activo por usuario, intento
  máximo persistente y vencimiento común a API, correo e interfaz. Dos
  verificaciones simultáneas producen un éxito y un rechazo. No se emite una
  sesión con código agotado, vencido o reutilizado.
- Recuperación por enlace aleatorio de 256 bits guardado como HMAC, con propósito,
  firma, vencimiento y consumo único. Confirmar actualiza la contraseña y consume
  el desafío en una transacción, revoca sesiones y elimina la cookie. No inicia
  sesión automáticamente. Renovar, cambiar rol o retirar acceso invalida enlaces
  anteriores. Un enlace de otra firma o propósito no permite cambiar contraseña.
- Respuestas públicas uniformes sin enlaces, correos ni usuarios; mismo mínimo
  temporal para solicitudes de acceso y hash sustituto al verificar una cuenta
  ausente. Las solicitudes sin autenticación no atribuyen un autor verificado.
  Los parámetros SQL se ocultan, incluidos los de excepciones.
- Enlaces con secreto en el fragmento, retirado del historial al abrir la vista.
  El navegador mostró un caso de navegación al fragmento en la misma pestaña que
  no actualizaba el formulario: quedó corregido y cubierto para recuperación y
  activación. Se verifica el resultado sin introducir contraseñas en el navegador.
- **C06 parcial:** SMTP con TLS obligatorio en producción, timeout, reintentos
  acotados y fallos observables sin secretos. El envío individual corre después
  de la respuesta y fuera del event loop. Las vigencias se derivan de configuración.
  Falta verificar un proveedor real y su operación; `BackgroundTasks` no es una
  cola durable y los envíos masivos permanecen reservados a workers.

### Evidencia de aceptación

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo, PostgreSQL 16 | 284 pruebas correctas en 179,39 s, con `autoflush=False` como la API real e incluidas las migraciones. Tras ajustar la atribución de solicitudes públicas, 22 pruebas afectadas correctas. |
| Seguridad y correo | 31 casos nuevos: límites y ventana, presupuesto concurrente, normalización, aislamiento, 429, OTP consumido/agotado/vencido, recuperación concurrente, renovación, propósito, baja, cambio de rol, validaciones y rollback; más transporte SMTP y configuración. |
| SMTP controlado | Entrega real por socket TCP local y MIME recibido; no bloquea el event loop. Pruebas de TLS antes del login, timeout explícito, reintentos limitados y ausencia de destinatarios, enlaces o credenciales en logs de correo. No equivale a recepción en producción. |
| Migración `4286c195fcc2` | Autogenerada e inspeccionada, aplicada localmente y `alembic check` sin diferencias. Cadena real sobre bases vacías y datos históricos, actualización/reversión y aborto transaccional por duplicados previos. |
| Frontend completo, Node 24 | 132 pruebas correctas y `npm run build` correcto. Incluye recuperación, confirmación, 429, error/vencimiento, caché limpia y navegación al enlace en la misma pestaña. |
| Navegador local | Entrada desde oficina conserva firma; solicitud de identidad de prueba ausente muestra respuesta genérica y vigencia de 30 minutos. Formularios de solicitud y nueva contraseña a 390 px sin desbordamiento, sin introducir ni cambiar credenciales reales. |
| GitHub Actions | [Backend de 28decaf](https://github.com/Hark0616/Asuntia/actions/runs/38671416778) correcto en ambos jobs, con PostgreSQL independiente. La interfaz y evidencia de aceptación se incorporan después de ese corte. |

No se añadieron dependencias. La instalación debe aplicar Alembic antes de ejecutar
la nueva API y configurar SMTP seguro y `FRONTEND_URL` HTTPS en producción; los
valores están documentados en `.env.example`. C05, la operación de correo en C06
y los demás bloques abiertos conservan sus criterios pendientes.

## 11. Avance documental: cargas acotadas (2026-10-15)

**D02 implementado en la API y la interfaz; pendiente de aceptación del proxy real.**
El archivo tiene máximo de 20 MiB y el cuerpo multipart de 21 MiB, contado sobre
el tráfico real sin depender de `Content-Length`. Nginx tiene el mismo máximo de
solicitud y timeout de cuerpo. La lectura se limita a bloques de 64 KiB y se
validan tamaño, nombre, extensión, MIME y marcadores del contenedor antes de
escribir. PDF, imágenes raster, TXT, DOCX y XLSX tienen política explícita; PDF y
Office se descargan. Se rechazan contenedores Office cifrados, entradas inseguras,
VBA, ActiveX y objetos incrustados reconocibles; se limita también su directorio
y tamaño declarado descomprimido. Otros formatos activos/desconocidos se rechazan. La inspección
estructural completa y antivirus no forman parte de esta comprobación.

La raíz local deja de depender del directorio de arranque; las rutas se contienen
y los nombres físicos son aleatorios. Una escritura fallida retira su temporal,
un archivo inexistente deja de producir metadatos ficticios y se elimina el commit
intermedio de carpetas. Se revalida el acceso de oficina y al asunto antes de la
escritura. La descarga usa cookies y respuestas privadas sin caché; la vista de
imágenes/texto usa sandbox. El formulario conserva datos al fallar y muestra el
rechazo concreto del backend.

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo | 322 pruebas correctas en 188,53 s, sobre PostgreSQL 16 e incluidas las migraciones. La suite incorpora 38 casos de carga, transporte y almacenamiento. Tras ajustar permisos de creación del archivo se vuelven a comprobar los módulos afectados. |
| Cargas y almacenamiento | Archivo vacío, exceso y límite exacto, MIME/extensión falsos, truncado, nombre/ruta maliciosos, acceso 401/403/404, campos 422, desconexión con cierre del spool, cuerpo sin longitud o con longitud falsa, renombre fallido y archivo ausente. |
| Frontend | 136 pruebas correctas y `npm run build` correcto; rechazos locales/API conservan campos y evidencia, PDF/Office ofrecen descarga e iframe de imagen restringido. |
| Navegador | Formulario y ayuda revisados en escritorio y a 390 px; sin desbordamiento horizontal del documento. No se incorporaron archivos a expedientes existentes durante esta revisión. |

La casilla D02 permanece abierta hasta verificar el proxy ejecutándose. D01, D03
y D04 conservan sus pendientes de migración/integridad, reconciliación/idempotencia
y vías cloud autorizadas. No se modificó el esquema ni se añadieron dependencias.

## 12. OneDrive personal por firma (2026-10-15)

Implementación de conexión Microsoft, selección de carpeta existente, vinculación
sin copiar el archivo, carga asíncrona y lectura autorizada. La instalación y el
recorrido de aceptación están en [Almacenamiento OneDrive](ALMACENAMIENTO_ONEDRIVE.md).

- Conexiones persistentes por firma y unidad; cambiar el destino no reinterpreta
  documentos anteriores. Reconectar otra cuenta conserva las referencias existentes.
- OAuth con PKCE, estado de un solo uso ligado a sesión y tokens cifrados. El HTTP
  registra comandos; ARQ realiza intercambio, renovación, navegación y transferencias.
  Redis transporta UUID y PostgreSQL conserva los trabajos pendientes.
- Cargas con UUID y huella del contenido, reintentos recuperables y comprobación
  de objeto remoto previo. Se prueban fallos antes de guardar metadatos y después
  del commit real con confirmación perdida, sin duplicar archivo ni documento.
- Archivos privados por defecto, comprobación de contenido aprobado y acceso actual
  antes y después del trabajo. Cambios externos bloquean descarga hasta revisión;
  revisar vuelve el documento privado y permite publicación mediante la acción existente.
- Desconexión revoca tokens y lecturas preparadas sin borrar originales ni activar
  local silenciosamente. La interfaz muestra configuración ausente y worker caído
  como estados reales, con conservación de formularios y consulta del resultado.

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo | 369 pruebas correctas y una omitida por ausencia de Redis nativo; PostgreSQL 16 y migraciones reales. Los módulos OneDrive se vuelven a comprobar tras los últimos ajustes de reintento y paginación. |
| Permisos y recuperación | Otra firma, cliente ajeno, documento privado, 401/403/404/422, sesión revocada, expiración, retiro de publicación, cambio de destino, desconexión, tokens renovados, confirmación perdida y entrega duplicada de la cola. |
| Adaptador Graph | Transporte HTTP controlado, límites de contenido, errores sin secretos, rechazo de enlaces externos y descargas sin reenviar el Bearer al host de contenido. |
| Migración `8a4f24321a7b` | Autogenerada, inspeccionada y aplicada localmente; `alembic check` sin diferencias. Conserva referencias antiguas y bloquea reversión destructiva. |
| Frontend | 148 pruebas correctas y build TypeScript/Vite correcto; conexión, carpeta, vinculación privada, fallos recuperables y carga con resultado asíncrono. |
| Navegador | Ajustes con la API real en escritorio y móvil, sin desbordamiento horizontal. Servidor local activo, Microsoft sin configurar y procesador ausente. No se autorizó una cuenta real ni se alteraron expedientes existentes. |
| Infraestructura | Compose incorpora Redis y worker con configuración/volumen compartidos; YAML validado. CI incorpora Redis real para probar despacho y ejecución ARQ. Docker/proxy no se ejecutaron en este equipo. |

D01–D04 permanecen abiertos: falta aceptación con la cuenta real y el despliegue,
migración/verificación del archivo local histórico, reconciliación de temporales
sin trabajo persistido y revisión de vías Google legadas. El soporte de OneDrive
se incorpora a la entrega sin declarar cerrados esos pendientes. Dependencias
nuevas de ejecución: ARQ y HTTPX, registradas también en requisitos de producción.

## 13. Cargas locales recuperables (2026-10-15)

Avance de D01/D03/B07 sin depender de Azure. El formulario existente conserva el
UUID al reintentar; la API local ahora lo respeta. Repetir una solicitud recupera
un único archivo, documento y evento, incluso si se pierde la confirmación del
commit o dos peticiones llegan juntas. Otro contenido o campos bajo el mismo UUID
producen 409.

La intención se confirma antes de escribir. Una incorporación incompleta no
aparece en Documentos ni Actividad; el original identificado se conserva para
recuperarlo sin sobrescribirlo ni borrarlo por un resultado de BD incierto. Los
pendientes duran 24 horas y no se envían a Redis ni al worker cloud. Los resultados
completados conservan la deduplicación. La recuperación revalida sesión, firma,
acceso y publicación; un documento archivado o un archivo ausente/modificado no
se recrea por reintentar.

Las nuevas claves son relativas y separadas por firma/asunto/operación. Se verifica
la lectura tras trasladar la raíz privada y la compatibilidad con referencias
absolutas anteriores. La clasificación sigue derivándose del tipo documental;
no se añaden campos ni pasos al formulario. El contrato está en
[Contratos del núcleo](CONTRATOS_NUCLEO.md#recuperación-de-cargas-locales-2026-10-15).

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo, PostgreSQL 16 | 393 pruebas correctas en 253,66 s; una omitida por Redis nativo ausente. Tras ajustar el contador de intentos y ampliar dos casos finales: 69 pruebas afectadas correctas. |
| Recuperación local | 24 casos nuevos: concurrencia, solicitud diferente, fallo antes de la intención, antes/después del commit, proceso interrumpido, renombre fallido, original ausente/alterado, archivo lógico, sesión retirada, otra firma, cambio de destino, vencimiento y traslado de raíz. |
| Compatibilidad | Lectura de la referencia absoluta histórica y conservación de los permisos de descarga. Validaciones 401/403/404/422 y contenido inválido mantienen la política previa. |
| Frontend | 148 pruebas correctas y `npm run build` correcto. Se reutiliza la prueba existente que demuestra conservación de UUID, archivo y datos al fallar; no se cambió la interfaz. |
| Esquema | Se reutiliza `StorageOperation`; no hay tablas ni dependencias nuevas. `alembic check` sin diferencias. |

D01/D03 siguen abiertos por la migración del archivo histórico, reconciliación
de pendientes abandonados y aceptación real de OneDrive. No se eliminan archivos
jurídicos automáticamente ni se consume la promoción gratuita de Azure para este
avance. Las comprobaciones de proxy/despliegue y respaldos continúan pendientes.

## 14. Revisión funcional por roles (2026-10-15)

Se incorporan 15 recorridos de integración sobre API/PostgreSQL: administración
(1), abogado (4), auxiliar (6) y cliente (4). Se prueban apertura, búsqueda,
asignación, tareas, borradores y guía, publicación/retiro de notas y archivos
locales, archivo, acceso denegado y sesión revocada. Los datos y archivos son
sintéticos y temporales; los asuntos creados se archivan al finalizar.

El recorrido de administración encontró y corrigió una transferencia incompleta:
si el titular saliente era administrador, sus tareas manuales abiertas no pasaban
al nuevo titular. Ahora se transfieren igual que las del abogado, conservando
delegaciones a otros miembros y tareas ya terminadas. Cambio y regresiones en
[b32e512](https://github.com/Hark0616/Asuntia/commit/b32e512).

El dictamen, las evidencias y los pendientes por impacto están en
[Pruebas por roles](PRUEBAS_ROLES_2026-10-15.md). Falta edición de datos existentes,
citas independientes, auditoría y aceptación de producción/recuperación. La
revisión de navegador cubre administración; los agentes verifican los demás
perfiles mediante integración de API e inspección de UI. No sustituye aceptación
con personas ni cierra G06, H03, A03 o los criterios de operación pendientes.

## 15. Corrección de clientes y asuntos (2026-10-15)

Avance de E01, A03, B04/B05/B07 y G04: administración y secretaría pueden corregir
el perfil compartido del cliente, incluso sin asuntos. Administración y el abogado
titular pueden corregir título, radicado oficial y fecha de apertura del expediente.
Se conservan UUID, código interno, referencias, responsables y guía.

Los comandos de edición exigen revisión, rechazan pantallas obsoletas con 409 y
confirman los cambios en una transacción. Se validan duplicados, firma, recursos
archivados, roles y campos protegidos. Correo/identificación se sincronizan con la
identidad existente del portal; cambiar identidad de acceso revoca OTP y sesiones.
Corregir contacto no activa ni retira el acceso al portal. Los borradores de guía
siguen al radicado actual; las actuaciones completadas conservan su historia.

Los formularios consultan al abrir, permiten vaciar datos opcionales y conservan
captura/revisión al fallar. Recargar datos o descartar cambios requiere confirmación.
Se utiliza diálogo nativo con foco contenido/restaurado y ayuda visible en su capa.
El contrato detallado está en [Contratos del núcleo](CONTRATOS_NUCLEO.md#corrección-de-datos-existentes-2026-10-15).

La edición no cierra por sí sola los criterios completos: permanecen pendientes
bitácora protegida, reactivación, navegación SPA con borradores, citas y aceptación
de despliegue/respaldos. No hay nuevos modelos, migraciones ni dependencias.

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo | 458 pruebas correctas y una omitida en 367,29 s por Redis local ausente. Se añaden 48 casos de edición; incluyen roles, 401/403/404/409/422, nulos, duplicados activos/archivados, concurrencia, rollback, sesión/OTP y conservación de actuaciones. |
| Frontend | 160 pruebas correctas y build TypeScript/Vite correcto. Doce pruebas nuevas cubren edición, campos vacíos, caché, permisos, conflicto, recarga explícita, doble envío, consulta fallida y cierre/foco, incluida apertura con caché mientras la consulta sigue pendiente. |
| Navegador con API real | Corrección y lectura posterior del nombre/teléfono del cliente y título/radicado del asunto sobre datos sintéticos propios. Código interno intacto, descarte con Escape, foco restaurado y formularios en escritorio/390 px sin desbordamiento horizontal del diálogo. Ayuda dentro de la capa modal y consola sin errores. Los registros de esta revisión se archivaron; no equivale a aceptación humana ni lector de pantalla. |

## 16. Citas independientes y agenda canónica (2026-10-15)

Avance de F01–F04: varias reuniones y audiencias por expediente, con inicio/fin,
zona horaria, responsable, participantes, lugar/enlace HTTPS y resumen preparatorio.
Administración y secretaría organizan dentro de su firma; el abogado opera sus
asuntos. El portal conserva su proyección actual y no recibe estas capturas internas.

La guía selecciona una audiencia registrada, sin capturar otra fecha. Se migran las
audiencias existentes y se conserva el JSON original como historia. La agenda deja
de proyectar ese JSON, evitando duplicados. Una duración histórica desconocida
permanece por confirmar. La migración aborta ante fechas ilegibles o responsables
inconsistentes y bloquea la reversión destructiva con citas existentes.

Crear permite recuperar una solicitud repetida; reprogramar/cancelar requiere
revisión y conserva historial con autor/fecha/valores. Una cita cancelada sigue
visible en el expediente y sale de la agenda. Se consideran los solapamientos de
ventana y se transfieren citas futuras/en curso al cambiar responsables o dar bajas.
Secretaría accede a agenda de equipo sin ampliar los permisos de su bandeja de tareas.

El formulario conserva datos y revisión al fallar, confirma el descarte y contiene
el foco. Las fechas se capturan en la zona indicada, aunque el dispositivo tenga
otra; editar texto conserva la precisión original. Una hora local inexistente o
ambigua por cambio estacional se rechaza. Se añade `tzdata`, declarada en ambos
manifiestos del backend, para disponer de zonas IANA también en Windows.

| Verificación | Resultado y límite |
| --- | --- |
| Backend completo | 487 pruebas correctas y una omitida por Redis local ausente. Detectó dos ajustes en pruebas: el permiso nuevo de secretaría y un fixture sin audiencia en el asunto archivado. Se corrigieron; verificación final de los 42 casos de citas, secretaría y migraciones correcta en 108,46 s. Los 46 casos iniciales de citas, guía y agenda también pasaron. |
| Migraciones | `alembic revision --autogenerate`, actualización local y `alembic check` sin diferencias. Pruebas sobre bases vacías e históricas: instantes, datos originales, asunto archivado, repetición sin duplicar, reversión protegida y rollback ante una fecha ilegible. |
| Frontend | 170 pruebas correctas con dos workers y build TypeScript/Vite correcto. Se cubren captura/reintento con UUID estable, participantes, versión obsoleta y recarga, cancelación, doble envío, descarte/foco, guía, zona y cambio de mes/año/horario estacional; también separación de agenda de equipo y tareas personales de secretaría. |
| Navegador / API real | Creación, reapertura y cancelación con motivo e historial sobre un expediente sintético propio. Formulario en escritorio y a 390 px sin desbordamiento horizontal del diálogo; duración y participantes recuperados. Cita cancelada y asunto/cliente de revisión archivados mediante borrado lógico. No equivale a aceptación humana o lector de pantalla. |

F01–F04 conservan sus casillas abiertas. Continúan calendario y filtros por persona
y expediente, sustitución explícita de una audiencia ya referenciada por un paso
completado y aceptación humana de los recorridos. Después siguen auditoría general,
defaults de publicación y preparación/recuperación del despliegue. No se retoma Azure.
