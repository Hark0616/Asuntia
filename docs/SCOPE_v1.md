# Scope y arquitectura — Plataforma de gestión de procesos legales (negociación de pasivos / insolvencia)

> Documento base construido a partir del boceto en papel de la abogada y completado con la reunión de definición de alcance. Las secciones marcadas con **[PENDIENTE]** son decisiones que quedaron abiertas en la reunión y deben confirmarse antes de iniciar desarrollo.

---

## 0. Fases del proyecto

Se acordó dividir el proyecto en fases por complejidad y costo:

1. **Fase 1 — Página web (prioridad actual):** interfaz cliente + interfaz oficina descritas en este documento. Es la fase más simple de construir y la que resuelve el dolor actual (información dispersa en WhatsApp, Excel y Drive).
2. **Fase 2 — Aplicación / web app instalable:** una vez validada la página web, se evalúa convertirla en aplicación (web app que se pueda instalar como app de celular).
3. **Fase 3 — Automatizaciones con IA:** lectura automática de correos, agendamiento automático en calendario y notificación automática por WhatsApp. Reconocido como de alta complejidad; **no** entra en el alcance inicial, queda como visión a futuro.

---

## 1. Interfaz cliente

### 1.1 Acceso
- El cliente **no** crea usuario y contraseña tradicionales.
- Ingresa con **cédula + código de registro interno (radicado)**, buscando reducir fricción sin depender de que cada persona administre credenciales.
- **[PENDIENTE]** Definir el mecanismo exacto de seguridad para que este acceso simplificado no exponga datos sensibles (se discutió la preocupación de seguridad pero no se cerró la solución técnica).

### 1.2 Relación cliente–proceso
- Un cliente puede tener **más de un proceso** (caso) asociado a su cédula (p. ej. la misma persona puede tener un proceso de insolvencia y, aparte, un proceso de divorcio u otro asunto).
- Cada proceso tiene su propio radicado/código interno, aunque estén ligados a la misma cédula.
- Al ingresar, el cliente ve la lista de sus procesos y puede entrar a revisar el estado de cada uno individualmente.
- **No se elimina información** de ningún proceso, ni siquiera cuando ya está cerrado (por conservación de historial legal). Los procesos cerrados se **archivan visualmente** (ver colores en 1.3), no se borran.

### 1.3 Avance procesal (línea de tiempo por caso)
1. **Radicar** — se registra el proceso.
2. **Audiencia** — se agenda fecha de audiencia.
3. **Resultado de audiencia** — la abogada marca si la audiencia se realizó y su resultado: **Acuerdo** o **Fracaso**.
   - *Si hay Acuerdo:* el proceso finaliza aquí; el cliente pasa a la etapa de pagos según lo acordado.
4. **Fracaso** — si no hubo acuerdo, se registra el acta de fracaso.
5. **Liquidación** — el proceso pasa a liquidación patrimonial ante el juzgado (ya no es un trámite de conciliación sino un proceso judicial).

Cada caso se muestra con un **color de estado** (mismo criterio que el repositorio de solicitudes, ver 2.1), por ejemplo: verde = activo, gris = cerrado. **[PENDIENTE]** definir la paleta completa de colores/estados.

### 1.4 Pagos realizados y pendientes
- Cuadro con honorarios del abogado (lo que debe, lo que ha pagado, saldo pendiente y concepto).
- Total pagado hasta el momento.
- El cliente **solo consulta**; el registro de pagos lo hace la oficina (ver módulo 3) con base en comprobantes que el cliente envía por WhatsApp al número corporativo.
- Un mismo cliente con varios procesos puede tener pagos asociados a cada proceso por separado.

### 1.5 Fuera de alcance para el cliente
- No se le muestra un calendario ni el link de la audiencia dentro de la plataforma: ese flujo se sigue manejando por WhatsApp directamente con la abogada, porque agregarlo a la web no aporta valor adicional (se evaluó y se descartó).

---

## 2. Interfaz oficina

### 2.1 Roles y permisos

| Rol | Persona | Permisos |
|---|---|---|
| **Administrador** | Edwin | Control total: crear, editar, eliminar. |
| **Abogada** | Hannahi | Permisos amplios similares al administrador (revisa avances, agenda, actas), pero sin ser necesariamente "dueño" del sistema. |
| **Auxiliar** | Daniela | Ingresa y actualiza datos (radicar procesos, subir documentos, actualizar agenda de audiencias). **No debería** tener acceso a los valores/montos económicos (pagos, honorarios) — esto quedó como preferencia de la abogada. |

**[PENDIENTE]**
- Confirmar si el auxiliar puede eliminar información o solo ingresar/actualizar.
- Confirmar exactamente qué ve/no ve cada rol en el módulo de pagos.
- El sistema debe permitir crear roles adicionales a futuro (la oficina puede crecer más allá de 3 personas).

### 2.2 Repositorio de Solicitudes
Contiene toda la información necesaria para elaborar las solicitudes de negociación de pasivos.

- **Organización:** cada carpeta/caso tiene un **color según su estado** (ej.: pendiente por presentar, presentado, en espera de respuesta, listo pero no se puede presentar aún, etc. — la abogada mencionó manejar hasta ~20 estados posibles).
- **Subestructura del caso:**
  - **Anexos** — insumos que el cliente/abogado suben para construir el escrito de solicitud: cédula, desprendible de pago, certificado laboral, REDAM, registros, etc. Tanto el cliente como la oficina pueden subir documentos (se definió que primero puede subir cualquiera de los dos, no hay restricción estricta).
  - **Escrito de solicitud** — el documento (Word) que la abogada redacta con la información del cliente: acreedores, ingresos, gastos de subsistencia, propuesta de pago (capital y plazo), etc.
  - **Audiencias** — auto admisorio, actas, acta de fracaso o acta de acuerdo (ver flujo abajo).

**Flujo del proceso de conciliación:**
1. Se arma la solicitud con los anexos del cliente.
2. Se presenta al **Centro de Conciliación**.
3. El centro **admite la negociación** (o la rechaza).
4. Se **fija fecha de audiencia**.
5. Ocurre la **audiencia** (normalmente una por proceso) → se genera **un acta**.
6. Resultado:
   - **Acuerdo** → el cliente empieza a pagar según lo acordado.
   - **Fracaso** (lo más frecuente) → se genera **acta de fracaso** y el proceso pasa a Liquidación patrimonial.

#### 2.2.1 Repositorio Liquidación (subcarpeta / módulo aparte)
Cuando el proceso fracasa en conciliación, pasa a **liquidación patrimonial** en un juzgado — es la mayoría de los casos.

- Es información **distinta** a la del repositorio de solicitudes porque corresponde a otra etapa procesal (ya no la maneja el centro de conciliación sino el juzgado).
- Contiene: auto de apertura, comunicaciones que expide el juzgado, poder otorgado por el cliente, y demás documentos que van saliendo durante el proceso judicial.
- Actualmente esto se lleva en carpetas físicas/Drive ("carpetas amarillas") y aún no está guardado digitalmente de forma organizada — es una de las prioridades a resolver con la plataforma.

### 2.3 Agenda de audiencias
Campos:
- Resumen (de la audiencia — sirve como contexto para la siguiente audiencia; lo redacta la abogada después de cada audiencia).
- Fecha.
- Cliente.
- Link a la audiencia. **[PENDIENTE — revisar si es necesario]**: se discutió que este dato tal vez no necesite estar en la plataforma porque ya se maneja por WhatsApp; queda a definir si se incluye.

Flujo de uso:
- La abogada, después de cada audiencia, envía a la auxiliar (Daniela) el resumen de lo ocurrido.
- La auxiliar actualiza la agenda con fecha, cliente y resumen.
- La abogada consulta la agenda del día siguiente para contextualizarse antes de cada audiencia.

Ideas a futuro (no confirmadas, complejidad alta):
- Envío automático de recordatorios.
- Conexión con Google Calendar.
- Automatización tipo IA que lea el nombre del cliente, lo busque en la base de datos, arme el resumen y agende automáticamente.

### 2.4 Pagos pendientes
- **Pagos de honorarios** (lo que el cliente debe pagar a la oficina/abogados).
- **Pagos al liquidador** (honorarios que fija el juzgado cuando se admite el proceso a liquidación — es un pago a un tercero designado por el juzgado, distinto del pago a la oficina).
- Actualización manual por parte de la auxiliar con base en comprobantes que llegan por WhatsApp al número corporativo.
- **[PENDIENTE]** Definir si el auxiliar puede ver montos o solo registrar el hecho del pago (ver 2.1).

### 2.5 Bases de datos internas (3, independientes entre sí por ahora)
1. **Liquidadores** — información de los liquidadores asignados por el juzgado a cada proceso.
2. **Información de acreedores** — tabla simple: identificación del acreedor (NIT/cédula), nombre y correo electrónico. *Importante: los acreedores no son los clientes*, son las entidades (bancos, cooperativas, etc.) a quienes el cliente les debe.
3. **Acuerdos / No acuerdos / Liquidación** — seguimiento del estado y observaciones de cada proceso (última actuación, si se aperturó, si se pagó al liquidador, etc.). Es la base que hoy se lleva en Excel y sirve como bitácora de seguimiento.

Estas tres bases de datos **no están relacionadas entre sí** por ahora (son independientes); cada una responde a una necesidad distinta de seguimiento interno.

### 2.6 Base de datos de clientes
Campos:
- Usuario
- Cédula
- Email
- Teléfono
- Dirección
- Dirección de correo
- Tipo: Deudor / Acreedor / Garantista / Fiador
- Radicado(s) / código(s) interno(s) asociado(s)

Relación con procesos:
- **Un cliente puede tener varios procesos**, cada uno con su propio radicado (corrigiendo el supuesto inicial de "un cliente = un proceso").
- Sirve tanto para el módulo de solicitudes como de consulta rápida para el auxiliar cuando un cliente llama o escribe.

---

## 3. Arquitectura técnica (visión del desarrollador)

- **Fase 1 recomendada como página web**, no aplicación móvil nativa: es más simple y rápida de construir; queda abierta la puerta a convertirla en web app instalable más adelante.
- El sistema requiere **varias bases de datos separadas** (no solo una): datos de usuarios/clientes, credenciales/claves de acceso, y datos operativos de los procesos — separadas para evitar que la información de un usuario sea visible para otro por error de correlación.
- La oficina **no cuenta con servidor propio**; será necesario contratar hosting.
- Costos estimados discutidos (referenciales, no cotización formal):
  - **Dominio:** costo anual, variable según qué tan corto/llamativo sea el nombre elegido.
  - **Hosting:** para una web mayormente estática con base de datos ligera, aproximadamente USD 15–20/mes. No se justifica un proveedor tipo AWS mientras el volumen de datos sea bajo (principalmente documentos).
- Modelo de cobro sugerido (sin cifra definitiva): pago inicial por el desarrollo + una mensualidad que cubra administración del servidor y ajustes menores (cambios de texto, colores); cambios grandes de funcionalidad se cotizan aparte.
- **[PENDIENTE]** Definir valor del pago inicial y de la mensualidad — quedó como pregunta abierta para el desarrollador, sin cerrar en la reunión.

### 3.1 Flujo de estados propuesto (paso a paso, con desbloqueo secuencial)
Idea planteada por el desarrollador para automatizar el avance procesal sin duplicar trabajo manual:

1. **Radicar** — la auxiliar registra el radicado del proceso. Habilita el paso 2.
2. **Agendar audiencia** — solo disponible para procesos ya radicados sin audiencia agendada (o con audiencia fallida). Se elige fecha, hora y enlace; al enviarse, se notifica al cliente y se cierra este paso.
3. **Audiencia agendada** — queda "en espera" hasta que ocurra la audiencia.
4. **Resultado de audiencia** — la abogada entra y marca si la audiencia pasó o no, y agrega el resumen. Al finalizar este paso se desbloquea el siguiente.
5. **Definición** — Acuerdo (fin del trámite conciliatorio, empieza etapa de pagos) o Fracaso (pasa a Liquidación patrimonial).

Cada paso **desbloquea el siguiente**, en vez de que todos los campos estén abiertos simultáneamente — esto busca ordenar el flujo de trabajo entre auxiliar y abogada y reducir errores.

---

## 4. Resumen de pendientes por decidir

- [ ] Mecanismo de seguridad definitivo para el login simplificado (cédula + radicado).
- [ ] Paleta completa de colores/estados para los casos.
- [ ] Alcance exacto de permisos del auxiliar (edición/eliminación, visibilidad de montos).
- [ ] Si el "link a la audiencia" queda dentro de la plataforma o se sigue manejando por WhatsApp.
- [ ] Viabilidad y alcance de recordatorios automáticos / integración con Google Calendar.
- [ ] Tiempo de retención/copias de seguridad de los procesos cerrados (se mencionó que varía por ley entre 3 y 6 años según el tipo de proceso — verificar con la abogada).
- [ ] Valor del pago inicial de desarrollo y de la mensualidad de mantenimiento.
- [ ] Confirmar si "Fase 2" (app) y "Fase 3" (automatización con IA) se cotizan ahora o se dejan totalmente para después.