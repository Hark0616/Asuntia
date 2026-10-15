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

- [ ] **C01 · P0 · Resolver la firma sin constantes de demostración.** Por qué: una instalación real necesita contexto inequívoco. Terminado con resolución/configuración de firma en el ingreso y pruebas de firma desconocida, inactiva o ajena; ninguna operación normal exige usar `demo`.
- [ ] **C02 · P0 · Completar el ciclo de vida del equipo.** Por qué: el jefe debe incorporar, asignar y retirar acceso sin modificar seeds o BD a mano. Terminado con alta o invitación, activación, cambio de rol, desactivación y reasignación explícita del trabajo; impedir que una baja deje el control de la firma inaccesible.
- [ ] **C03 · P0 · Fortalecer autenticación y recuperación.** Por qué: el acceso debe resistir abuso y errores cotidianos. Terminado con límites de intentos/solicitudes, OTP consumido atómicamente una vez, expiración coherente, recuperación de contraseña y errores que no revelen cuentas; pruebas de solicitudes concurrentes, caducadas y reutilizadas.
- [ ] **C04 · P0 · Completar la vida de la sesión.** Por qué: cerrar sesión, cambiar permisos o desactivar un usuario debe tener efectos comprobables. Terminado con política de revocación y expiración, revalidación de firma/usuario, limpieza de caché al salir y recuperación clara ante 401 sin publicar ni reenviar una acción automáticamente.
- [ ] **C05 · P0 · Verificar cookies, origen y secretos en despliegue.** Por qué: las propiedades locales no prueban el acceso seguro en dominios reales. Terminado con HTTPS, dominio compartido, cookies seguras, CORS explícito, defensa CSRF/origen verificada y configuración que rechace valores inseguros; incluir pruebas de solicitudes desde orígenes no autorizados.
- [ ] **C06 · P0 · Hacer confiable el envío de acceso por correo.** Por qué: un OTP generado pero no entregado no completa el recorrido. Terminado con proveedor transaccional configurado, transporte seguro, timeout, fallos observables, reintentos acotados y mensajes de expiración derivados de la misma configuración. Sacar I/O bloqueante del ciclo async y llevar envíos masivos a cola; validar entrega en un entorno controlado, sin prometer recepción garantizada.

### D. Documentos y almacenamiento

- [ ] **D01 · P0 · Definir claves y contrato de almacenamiento.** Por qué: una ruta absoluta o el nombre del proveedor no debe determinar la identidad de un documento. Terminado con claves opacas por firma/asunto, nombre original como metadato, lectura autorizada y contrato común de guardar/leer/consultar; migrar referencias existentes con verificación de integridad.
- [ ] **D02 · P0 · Validar y limitar cargas.** Por qué: memoria, tipo declarado y nombres enviados no son límites confiables. Terminado con límites consistentes en proxy/API, lectura acotada, formatos permitidos, comprobación de contenido, nombres seguros y contención de rutas; pruebas de archivo vacío, exceso de tamaño, MIME falso, nombre malicioso e interrupción. Definir tratamiento de archivos activos o sospechosos antes de permitir previsualización.
- [ ] **D03 · P0 · Resolver fallos entre archivo y metadatos.** Por qué: la BD y el almacenamiento no comparten una transacción. Terminado con estados de carga y reconciliación/compensación; un archivo fallido no aparece como disponible, un reintento no duplica y un archivo inexistente no produce metadatos ficticios. Probar fallos antes y después de la escritura y del commit.
- [ ] **D04 · P0 · Cerrar permisos de lectura, descarga y publicación.** Por qué: conocer una URL o publicar una novedad no concede acceso a un archivo. Terminado con autorización actual en todas las vías, recursos privados por defecto, retiro de acceso efectivo y respuestas seguras para contenido; pruebas desde otro cliente, otra firma y sesión retirada. Evitar enlaces permanentes que eludan el backend.
- [ ] **D05 · P1 · Completar la biblioteca útil.** Por qué: subir archivos sin encontrarlos o relacionarlos no resuelve el trabajo. Terminado con carga, búsqueda, filtro, vista/descarga y asociación a tarea o novedad desde el expediente; un único cargador reutilizable conserva el avance que se estaba escribiendo. Mostrar progreso, cancelación y recuperación acordes con el contrato real de carga.

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

- [ ] **H01 · P0 · Separar consultas de lista y detalle.** Por qué: el límite actual y las relaciones cargadas penalizan corrección y rendimiento. Terminado con detalle por ID independiente de listas, búsqueda/filtros/paginación en servidor, orden estable y totales correctos; probar más de 100 asuntos, acceso directo y cambios entre páginas, midiendo consultas para evitar N+1 o carga de historias completas innecesaria.
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

Mejorar la calidad no amplía automáticamente el alcance: versionado documental continúa fuera por instrucción del usuario. IA, finanzas, sincronización Google/Microsoft, mensajería, acceso offline y cómputo automático de términos requieren una decisión de producto propia. Los límites del núcleo deben permitir futuras extensiones sin implementar hoy funciones especulativas.

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
