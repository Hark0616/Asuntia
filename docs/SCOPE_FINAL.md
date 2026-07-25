## 0. Contexto del negocio

### 0.1 ¿Qué hace la oficina?

La oficina de abogados se dedica principalmente a procesos de **insolvencia económica** (también llamados de **negociación de pasivos**) de personas naturales. El proceso legal, explicado en detalle durante la reunión, funciona así:

1. **Solicitud de negociación de pasivos:** El cliente (deudor) contrata a la oficina. La abogada redacta un escrito formal de solicitud donde se relata la situación económica del cliente: por qué contrajo deudas, a quiénes les debe (acreedores: bancos, cooperativas, Secretaría de Movilidad, etc.), cuánto les debe a cada uno, cuáles son sus ingresos actuales, cuáles son sus gastos de subsistencia (servicios públicos, internet, celular) y cuál es su propuesta de pago (por ejemplo: "pago el 100% del capital en 120 meses, condónenme los intereses ya causados pero les pago un interés futuro a partir de agosto").
2. **Documentos anexos necesarios:** Para armar la solicitud, la oficina le pide al cliente: cédula, desprendible de pago, certificado laboral, REDAM (Registro de Deudores Alimentarios Morosos), tarjeta de identidad de los hijos, registros civiles, y otros documentos según el caso. La mayoría de los casos requieren los mismos documentos; algunos tienen documentos adicionales.
3. **Radicación ante el Centro de Conciliación:** La solicitud completa (escrito + anexos) se presenta ante un Centro de Conciliación.
4. **Admisión:** El Centro de Conciliación admite la negociación (rara vez la rechaza en esta etapa; los rechazos suelen ocurrir en audiencia).
5. **Fijación de fecha de audiencia:** Una vez admitido, se programa una audiencia de negociación.
6. **Audiencia(s):** Normalmente hay pocas audiencias por proceso. En cada audiencia se genera un acta (documento que resume lo ocurrido en la diligencia). El acta la redacta el conciliador/a. La abogada asiste y luego envía un resumen a su auxiliar para registro interno.
7. **Resultado:**
   - **Acuerdo:** Los acreedores aceptan la propuesta de pago. El cliente empieza a pagar según lo acordado. El proceso conciliatorio finaliza.
   - **Fracaso (lo más frecuente):** Los acreedores no aceptan. Se genera un **acta de fracaso**. La conciliadora declara fracasada la negociación y remite el proceso a **Liquidación Patrimonial**.
8. **Liquidación Patrimonial (proceso judicial):** El proceso pasa de un Centro de Conciliación a un **Juzgado**. Aquí el cliente le dice al juez: "Intenté negociar pero no se pudo. Pido que me mande a liquidación y pagué con mis bienes." Si el cliente no tiene bienes con que pagar, el juez declara las deudas **insolutas**, la persona vuelve a estado natural (sin deudas), y ya no le cobran más. Sin embargo, queda en lista negra de los bancos.

### 0.2 Estructura actual de la oficina

- **Edwin** — Abogado titular / administrador. Es quien recibe a los clientes inicialmente y les solicita los documentos. Es quien conoce el proceso de primera mano y maneja los contactos.
- **Hannahi** — Abogada. Asiste a las audiencias (hasta 3 por día), redacta los escritos de solicitud, lleva el control de los avances procesales y la relación directa con los clientes en audiencia.
- **Daniela** — Auxiliar. Lleva la agenda de audiencias, actualiza las bases de datos en Excel, organiza los repositorios en Drive, y sirve de enlace operativo entre los abogados y la información.
- **Actualmente son 3 personas**, pero la oficina contempla crecer a futuro. El sistema debe soportar la adición de nuevos usuarios y roles sin rediseño.

### 0.3 Dolor actual (por qué necesitan la plataforma)

La información de la oficina está dispersa en múltiples canales sin conexión:
- **WhatsApp:** Los comprobantes de pago llegan por WhatsApp al número corporativo. Los links de audiencias se envían por WhatsApp. La auxiliar busca las bases de datos en el chat de WhatsApp ("siempre para abrir esa base de datos, lo que hago es ir al chat de WhatsApp y buscar"). Los resúmenes de audiencia se envían por WhatsApp.
- **Excel:** Las bases de datos de procesos (liquidaciones patrimoniales, acreedores, seguimiento) se llevan en archivos Excel con múltiples columnas (radicado, proceso, juzgado, cédula, observaciones, última actuación, si se aperturó, si pagó liquidador, etc.).
- **OneDrive:** Los repositorios de documentos (solicitudes, anexos, carpetas por cliente) están en Drive. Cada cliente tiene una carpeta con subcarpetas de sus documentos. El repositorio de liquidaciones patrimoniales (carpetas amarillas) está en Drive con carpetas por cliente.
- **Notas manuales:** Edwin lleva registro de pagos en "tablitas y chismitas de Excel" y notas pegadas.

**El objetivo de la plataforma es centralizar toda esta información en un solo lugar**, eliminando la necesidad de buscar en chats, abrir múltiples Excels o navegar por Drive para encontrar un documento.

---

## 1. Fases del proyecto

Se acordó dividir el proyecto en fases por complejidad, costo y prioridad:

### Fase 1 — Página web (prioridad actual)
- Interfaz para el **cliente** (consulta de avance y pagos).
- Interfaz para la **oficina** (gestión completa de procesos, agenda, pagos, bases de datos).
- Es la fase más simple y rápida de construir.
- Resuelve el dolor inmediato: información centralizada, accesible desde cualquier dispositivo con navegador.
- **[DECISIÓN TOMADA]** Se prioriza página web sobre aplicación móvil. Textualmente: "para la página web es más fácil" / "la aplicación es más complejo" / "la página web para mí es prioritario, porque pues desde la página web yo puedo hacer todo".

### Fase 2 — Aplicación / Web App instalable
- Una vez validada y funcionando la Fase 1, se evalúa convertir la página web en una **Progressive Web App (PWA)** que se pueda instalar como aplicación de celular.
- El desarrollador mencionó el concepto de "web app que se pueda convertir en aplicación celular" como camino intermedio antes de una app nativa.
- **[PENDIENTE]** Definir si se cotiza junto con la Fase 1 o se deja completamente para después.

### Fase 3 — Automatizaciones con IA
- Lectura automática de correos electrónicos para extraer información de audiencias.
- Agendamiento automático en calendario basado en la información extraída.
- Notificación automática por WhatsApp a los abogados con la agenda del día siguiente.
- El desarrollador lo describió así: "un código que accede a tu correo, que extraiga la información, la mete automáticamente en el calendario y que el calendario lo mande automático por WhatsApp."
- Reconocido como de **alta complejidad**. **Fuera del alcance inicial.** Queda como visión a futuro.
- **[PENDIENTE]** Definir si se cotiza ahora o se deja totalmente para después.

---

## 2. Interfaz cliente

### 2.1 Acceso / Autenticación

**Discusión en la reunión:**
- La abogada propuso inicialmente que el cliente ingresara **solo con su número de cédula**, sin usuario ni contraseña, para reducir fricción ("no sé qué tan difícil es que cada persona tenga un usuario").
- El desarrollador objetó por seguridad: "se van a agarrar datos delicados, no se puede dejar eso tan expuesto" / "yo con buscar en una cierta página puedo encontrar [cédulas] de muchas personas".
- Se discutió usar la combinación **cédula + radicado (código interno del proceso)**, pero se identificó que el radicado tampoco es un dato realmente secreto.
- Se concluyó que se necesita un factor adicional de seguridad.

**Mecanismo definido:**
- El cliente **no** crea usuario y contraseña tradicionales.
- Ingresa con su número de **cédula** + un **código OTP (token dinámico)** enviado a su WhatsApp registrado.
- Se **descartó** usar el radicado como clave de acceso.

**[PENDIENTE / NUEVO PUNTO A PRESUPUESTAR]** El envío de OTP por WhatsApp requiere un proveedor de mensajería (WhatsApp Business API / Meta Cloud API / Twilio u otro similar). Este servicio tiene **costo propio por mensaje o por mes**, adicional al hosting. Debe cotizarse aparte y añadirse al presupuesto (ver sección 5).

### 2.2 Relación cliente — procesos

- Un cliente puede tener **múltiples procesos (casos)** asociados a su cédula. Textualmente: "cada persona tiene un proceso, muy difícilmente va a haber un cliente que tenga [más de uno], sí tiene más de un proceso es porque tiene otros asuntos como un divorcio". Sin embargo, el sistema debe soportarlo.
- Cada proceso tiene su propio **radicado/código interno**, único e independiente, aunque estén ligados a la misma cédula.
- Al ingresar, el cliente ve la **lista de todos sus procesos** y puede entrar a revisar el avance individual de cada uno.
- Cada proceso se muestra con un **color de estado** para distinguir visualmente los activos de los cerrados. Ejemplo mencionado: "un caso en verde, un caso en azul y 3 casos en gris porque ya cerró 3 casos."

### 2.3 Política de retención de datos

- **[DECISIÓN TOMADA]** No se elimina información de ningún proceso, ni siquiera cuando ya está cerrado. Textualmente del desarrollador: "No me parece conveniente borrar información en un proceso legal. Ustedes tienen que seguir en otras habilidades [necesidades]... un proceso acabó pero el próximo año un problema, tocó revisar cosas."
- Los procesos cerrados se **archivan visualmente** (cambio de color/estado) pero **no se borran** de la base de datos.
- Se mencionó que la retención puede variar entre **3 y 6 años** dependiendo del tipo de proceso. Se habló de "copia de seguridad" como estándar: "siempre eso es lo normal, un proceso por cuánto tiempo, hay gente que lo guarda por 3 meses, por 6 meses, por un año, por 3 años, 6 años dependiendo."
- **[PENDIENTE — verificar con la abogada]** La abogada indicó que debe revisar cuál es el **periodo normativo exacto** exigido por ley colombiana para la conservación de expedientes de procesos de insolvencia. Este dato **no debe tratarse como definitivo** hasta que se confirme; es una obligación legal, no una preferencia de producto.

### 2.4 Avance procesal — Línea de tiempo por caso

El cliente visualiza en qué etapa se encuentra su trámite. Se acordó una **línea de tiempo visual** (inspirada en "cuando uno ve el estado de un pedido" — como un seguimiento de envío de paquetería).

**Etapas:**

| # | Etapa | Descripción | Quién la actualiza |
|---|---|---|---|
| 1 | **Radicado** | Se registra que el proceso fue presentado ante el Centro de Conciliación. | Auxiliar (Daniela) |
| 2 | **Admitido** | El Centro de Conciliación admite la negociación. | Auxiliar / Abogada |
| 3 | **Audiencia programada** | Se fijó fecha de audiencia. El cliente ve que tiene audiencia tal día (sin link). | Auxiliar |
| 4 | **Audiencia realizada** | Se llevó a cabo la audiencia. | Abogada (Hannahi) |
| 5a | **Acuerdo** | Los acreedores aceptaron la propuesta de pago. Fin del trámite conciliatorio; inicia etapa de pagos. | Abogada |
| 5b | **Fracaso** | No hubo acuerdo. Se genera acta de fracaso. | Abogada |
| 6 | **Liquidación Patrimonial** | El proceso pasa al Juzgado para liquidación patrimonial (solo si hubo fracaso). | Abogada / Administrador |

**Notas sobre la línea de tiempo:**
- La abogada expresó entusiasmo por esta visualización: "Me gusta eso que tú me mostraste, como cuando uno ve el estado de un pedido" / "la gente [clientes] es brutal, entonces pues [les va a gustar]."
- Cada etapa tiene **fecha** asociada.
- El avance es **semiautomático**: cada que avance algo del proceso, al subir evidencia debe se da la opcion de marcar la etapa como completada y se "habilita" la siguiente etapa. 
- El desarrollador propuso un **mecanismo de desbloqueo secuencial** (ver sección 4.3).

### 2.5 Pagos realizados y pendientes (vista cliente)

El cliente puede consultar (solo lectura) su información de pagos:

- **Honorarios adeudados** al abogado.
- **Total pagado** hasta el momento.
- **Saldo pendiente**.
- **Desglose por concepto**: el cliente debe poder ver **por qué** debe cada valor (ej. cuota de honorarios de abogado vs. honorarios de liquidador vs. otro concepto), no solo un número consolidado. Esto se pidió explícitamente: "que también vea cuánto ha pagado y qué le debe y por concepto de qué."
- **Historial de pagos**: registro de los pagos realizados con fechas. El desarrollador mencionó: "para que tenga el historial de pagos."
- Un cliente con **varios procesos** puede tener pagos asociados a **cada proceso por separado**: "puede tener pagos de 3 [procesos]".

**Flujo de registro de pagos:**
- El cliente **envía el comprobante de pago por WhatsApp** al número corporativo de la oficina.
- La oficina registra el pago en la plataforma.
- **[DECISIÓN TOMADA]** El cliente **no realiza pagos** desde la plataforma ni sube comprobantes directamente. Textualmente: "no porque haga los pagos ahí" / "la actualización a la persona: cuando le diga 'ya pagó', le mande desde el número corporativo 'usted ha hecho un pago con tal [monto]'."

### 2.6 Fuera de alcance para el cliente

- **No se visualiza calendario de audiencias** dentro de la plataforma. Textualmente la abogada: "el tema de las audiencias... el cliente casi no le interesa saber [los detalles]."
- **No se muestra el link de conexión a la audiencia** dentro de la plataforma. Este flujo se sigue manejando directo por WhatsApp. Se evaluó y se descartó: "siento yo que ya está [siendo manejado] en el chat de WhatsApp, se puede seguir mandando el link."
- **No se permite al cliente subir documentos** directamente a la plataforma (al menos no en la Fase 1). La abogada expresó reserva: "yo no quiero que el cliente tenga esos documentos [visibles]... porque ahí va a estar la solicitud que vamos a realizar." Sin embargo, el desarrollador sugirió la posibilidad de un apartado solo para subir (no ver), que quedó sin cerrar.

**[PENDIENTE]** Definir si en algún momento el cliente podrá subir documentos (checklist de documentos requeridos con capacidad de carga) o si todo sigue llegando por WhatsApp.

---

## 3. Interfaz oficina

### 3.1 Roles y permisos

La oficina tiene actualmente **3 personas** con roles diferenciados:

| Rol | Persona actual | Permisos |
|---|---|---|
| **Administrador** | Edwin | Control total: crear, editar, eliminar datos. Gestionar usuarios. Asignar y modificar montos/saldos. Acceso completo a toda la información financiera. Configuración del sistema. |
| **Abogada** | Hannahi | Permisos operativos amplios: gestionar avances procesales, registrar resultados de audiencias, redactar resúmenes, gestionar agenda. Puede también tener permisos de administrador total (textualmente: "yo también puedo ser administrador total"). No gestiona la configuración técnica del sistema. |
| **Auxiliar** | Daniela | Permisos de lectura y escritura operativa: radicar procesos, subir documentos/soportes, actualizar la agenda de audiencias, cargar comprobantes de pago recibidos. **Restricción en información financiera** (ver nota abajo). |

**Nota sobre los permisos de la auxiliar respecto a pagos:**
- La abogada expresó claramente que la auxiliar **no debería** tener acceso a los valores/montos económicos: "siento que la auxiliar no tendría que ver el tema de los valores" / "¿se podría que el auxiliar no pueda revisar eso?"
- Sin embargo, **no quedó resuelto** si la restricción es solo de **edición** (puede ver pero no modificar montos) o también de **visualización** (no puede ver cuánto debe un cliente en absoluto). La pregunta original ("no pueda **revisar** eso") apunta a ocultar también la lectura.
- La auxiliar **sí puede cargar soportes/comprobantes** de pago al sistema, pero **no debería poder asignar ni editar los saldos finales**.

**[PENDIENTE — crítico para el diseño de permisos]** Confirmar exactamente:
1. ¿La auxiliar puede **ver** los montos de honorarios y saldos, o esos campos le quedan completamente ocultos?
2. ¿La auxiliar puede **eliminar** información, o solo ingresar/actualizar?

**Escalabilidad de roles:**
- El sistema debe permitir crear roles adicionales a futuro. Textualmente: "más adelante pueden ser más [personas], pero por ahora son 3."
- El desarrollador confirmó: "sí, podemos hacer diferentes [vistas]. Que si es auxiliar vea una cosa, si es administrador otra."

### 3.2 Módulo 1: Repositorio de Solicitudes

Contiene toda la información necesaria para elaborar y gestionar las solicitudes de negociación de pasivos.

#### 3.2.1 Organización visual
- Cada caso/carpeta tiene un **color según su estado**. La abogada mostró en pantalla cómo lo maneja actualmente en Drive: "ya se presentó este, este está pendiente por presentar, este ya se presentó, este no se ha hecho nada (amarillito), este lo pusimos en gris porque no lo podemos presentar todavía."
- El desarrollador lo confirmó: "yo estoy acomodando un caso y que ustedes puedan colocar estado y que ese estado sea el mismo color."
- La abogada mencionó que pueden necesitar **hasta ~20 estados** diferentes: "usted luego me dice quiero 20 estados y yo le meto."

**[PENDIENTE — bloquea el diseño del semáforo]** Definir la lista completa de estados y su color asociado. Sin esta lista cerrada, no se puede completar el componente visual. Estados mencionados hasta ahora en la reunión:
- Pendiente por presentar
- Presentado
- Admitido
- En espera de respuesta
- Listo pero no se puede presentar aún (gris)
- Sin acción aún (amarillo)
- Activo (verde)
- Cerrado/archivado (gris)

#### 3.2.2 Subestructura de cada caso

Cada caso en el repositorio contiene:

**A) Anexos (documentos del cliente)**
- Son los insumos que el cliente entrega para que la abogada pueda armar el escrito de solicitud.
- Documentos típicos mencionados en la reunión:
  - Cédula del cliente
  - Desprendible de pago
  - Certificado laboral
  - REDAM (Registro de Deudores Alimentarios Morosos)
  - Tarjeta de identidad de los hijos
  - Registros civiles
  - Otros documentos según el caso particular
- Textualmente: "La mayoría hay algunos que tienen otros documentos, pero pues casi siempre son los mismos."
- Tanto el cliente como la oficina pueden subir estos documentos; no hay restricción estricta sobre quién sube primero (aunque actualmente la preferencia es que los suba la oficina, ver 2.6).

**B) Escrito de solicitud**
- Documento operativo (formato Word) redactado por la abogada.
- Contenido del escrito (detallado según la transcripción):
  - Presentación de la persona (datos personales)
  - Razones que llevaron a la insolvencia
  - Lista de acreedores con identificación (bancos, cooperativas, entidades, personas)
  - Monto adeudado a cada acreedor
  - Información de los acreedores (nombre, NIT/cédula, datos de contacto)
  - Gastos de subsistencia del cliente (servicios públicos, internet, celular — no las deudas, que ya fueron listadas arriba)
  - Ingresos del cliente
  - Monto deducible (ingreso menos gastos de subsistencia)
  - **Propuesta de pago**: plazo (ej. 120 meses), qué porcentaje del capital se paga, condonación de intereses causados, tasa de interés futuro.
- Textualmente la abogada: "La negociación es para mí, no para todos los acreedores. Es la misma [propuesta] para todos. Esto es paquetazo."
- **La abogada no quiere que el cliente tenga acceso al escrito de solicitud** a través de la plataforma.

**C) Documentos de audiencias**
- Auto admisorio (documento del Centro de Conciliación admitiendo la negociación)
- Actas de audiencia (generadas por la conciliadora en cada sesión)
- Acta de acuerdo (si los acreedores aceptan)
- Acta de fracaso (si no hay acuerdo)

#### 3.2.3 Flujo del proceso de conciliación (detallado)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ETAPA DE SOLICITUD                            │
│                                                                  │
│  Cliente entrega documentos (anexos)                            │
│       ↓                                                          │
│  Abogada redacta el Escrito de Solicitud                        │
│       ↓                                                          │
│  Se presenta todo al Centro de Conciliación                     │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│               CENTRO DE CONCILIACIÓN                             │
│                                                                  │
│  1. Admite la negociación (casi siempre)                        │
│       ↓                                                          │
│  2. Fija fecha de audiencia                                     │
│       ↓                                                          │
│  3. Audiencia (normalmente pocas por proceso)                   │
│     → Se genera un ACTA por cada audiencia                      │
│       ↓                                                          │
│  4. Resultado:                                                   │
│     ├── ACUERDO → Cliente paga según lo acordado → FIN          │
│     └── FRACASO → Acta de fracaso → Remisión a Juzgado         │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓ (solo si hay fracaso)
┌─────────────────────────────────────────────────────────────────┐
│              LIQUIDACIÓN PATRIMONIAL (JUZGADO)                   │
│                                                                  │
│  1. Se admite el proceso en el juzgado                          │
│  2. Se asigna un Liquidador (tercero designado por el juzgado)  │
│  3. Se fijan honorarios del Liquidador                          │
│  4. El juzgado emite comunicaciones, autos, resoluciones        │
│  5. Si no hay bienes → deudas declaradas insolutas → FIN        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Módulo 2: Repositorio de Liquidación Patrimonial

Cuando el proceso fracasa en conciliación, pasa a **liquidación patrimonial** en un **juzgado**. Este es el desenlace de **la mayoría de los casos** ("los clientes quieren eso: no pagar, en su mayoría; casi siempre se firman actas de fracaso, muy pocos dicen 'yo quiero pagar'").

**Diferencias clave con el Repositorio de Solicitudes:**
- Es información **completamente distinta** porque corresponde a **otra etapa procesal** (ya no la maneja el Centro de Conciliación sino el Juzgado).
- La abogada fue explícita: "Esta información no tiene que estar [en el repositorio de solicitudes]. Porque esta es la información que yo necesito cuando se hacen las solicitudes, o sea, cuando inicia el proceso. Y cuando termina, este proceso se va a [liquidación], y aquí salen otros documentos que me da el juzgado."

**Contenido de cada carpeta de liquidación:**
- Auto de apertura
- Comunicaciones que expide el juzgado
- Poder otorgado por el cliente a la abogada
- Documentos adicionales que va generando el juzgado durante el proceso judicial
- Cualquier otra documentación relevante al proceso judicial

**Situación actual:**
- Este repositorio se lleva actualmente en **"carpetas amarillas"** (carpetas físicas en Drive/OneDrive).
- Cada cliente tiene su propia carpeta donde la abogada guarda los documentos del juzgado: "yo ahí le hago control de los documentos que va sacando el juzgado para yo estar revisándolos."
- La abogada expresó la necesidad de digitalizarlo: "necesitamos porque a veces Edwin dice 'necesito buscar un acta', entonces que busquen el proceso de la persona y 'aquí fue la admisión, aquí fue el acta'."
- La auxiliar Daniela también necesita tener acceso a este repositorio: "Daniela tiene que tener alcance también porque [busca] la información."

**Base de datos asociada:**
- Existe una base de datos en Excel con las columnas:
  - Radicado del proceso
  - Nombre del proceso
  - Juzgado asignado
  - Nombre del cliente (Edwin/Julián Becerra como ejemplo mencionado)
  - Cédula del cliente
  - Observaciones (espacio libre para notas)
  - Última actuación (lo último que pasó en el proceso)
  - Si fue aperturado (Sí/No)
  - Si pagó liquidador (Sí/No)
- "Aperturado quiere decir que ya lo admitieron. Cuando lo admiten, fijan unos honorarios de liquidador. La gente le tiene que pagar a otro fulano que asigna el juzgado. Entonces yo pongo: ya lo aperturaron sí, pagó liquidador sí/no."

### 3.4 Módulo 3: Agenda de audiencias

**Campos obligatorios de cada entrada:**

| Campo | Descripción | Fuente |
|---|---|---|
| **Fecha** | Fecha y hora de la audiencia | Programada por el Centro de Conciliación |
| **Cliente** | Nombre del cliente asociado | Referencia desde la base de datos de clientes |
| **Resumen** | Resumen de lo ocurrido en la audiencia anterior, para contexto de la siguiente | Redactado por la abogada después de cada audiencia |

**Decisión sobre el link de la audiencia:**
- Se discutió ampliamente si incluir el link de la audiencia virtual en la plataforma.
- **[DECISIÓN TOMADA]** Se prescinde de incluirlo. Textualmente: "siento yo que ya está [en el chat de WhatsApp], se puede seguir mandando el link."
- El desarrollador recomendó evaluar con cuidado: "analizalo, porque si yo siempre va a estar regresando a la aplicación [es mejor tenerlo ahí]."
- Finalmente se optó por mantener el flujo actual por WhatsApp/correo.

**Flujo de uso actual (que la plataforma debe replicar y mejorar):**
1. La abogada asiste a las audiencias del día (puede tener hasta 3 audiencias por día).
2. Después de cada audiencia, la abogada redacta un resumen: "yo hoy salí de 3 audiencias y en las 3 audiencias yo pongo un resumen [ej.] 'Pérez y Evangelista: van a notificar a Juriscoop porque hay una cooperativa', 'Betty Isabel Buitrago: liquidación ya terminó', 'la audiencia se suspende'..."
3. La abogada envía esos resúmenes a la auxiliar (Daniela).
4. La auxiliar actualiza la agenda con fecha, cliente y resumen.
5. La abogada consulta la agenda **del día siguiente** para contextualizarse antes de cada audiencia: "yo miro todos los días que me mandó ella el día anterior para saber [qué tengo mañana]."
6. Ejemplo concreto de la reunión: "mañana tengo una audiencia de la 1:00 de la tarde. Esa audiencia dice que se suspendió por [razón]. Entonces ya sé que mañana va a llegar otra persona a decir que quiere comprar esa deuda."

**Funcionalidades deseadas a futuro (Fase 3, no confirmadas, alta complejidad):**
- Envío automático de recordatorios de audiencia.
- Conexión/sincronización con Google Calendar.
- Automatización tipo IA: un sistema que lea el nombre del cliente en el correo/comunicación del Centro de Conciliación, lo busque en la base de datos, arme el resumen y agende automáticamente. El desarrollador lo describió así: "cuando tú le colocas el nombre [del cliente], hace una relación interna en la base de datos, asigna el caso, asigna un resumen detallado, y automáticamente manda el mensaje."

### 3.5 Módulo 4: Pagos pendientes (gestión oficina)

Módulo separado del repositorio de solicitudes, con **dos categorías de pago claramente distintas**:

#### 3.5.1 Pagos de honorarios de abogados
- Lo que el cliente debe pagar a la oficina/abogados por llevar su proceso.
- La abogada lo mencionó explícitamente como una necesidad separada: "pagos de honorarios de abogados, a nosotros, de nosotros."

#### 3.5.2 Pagos al liquidador
- Honorarios que fija el **juzgado** cuando se admite el proceso a liquidación patrimonial.
- Es un pago a un **tercero designado por el juzgado** (el liquidador), no a la oficina.
- La oficina necesita hacer seguimiento porque afecta directamente al cliente y al avance del proceso.
- Textualmente: "cuando lo admiten, fijan unos honorarios de liquidador. La gente le tiene que pagar a otro fulano que asigna el juzgado."

#### 3.5.3 Flujo operativo
1. El cliente envía el comprobante de pago por **WhatsApp al número corporativo**.
2. La auxiliar **carga el soporte/comprobante** al sistema.
3. Se registra el pago asociado al cliente y al proceso correspondiente.
4. Edwin (o la abogada) **valida y registra el monto final** en el sistema.
5. El cliente puede ver el historial de pagos actualizado desde su interfaz.
6. Opcionalmente: se le envía al cliente un mensaje de confirmación desde el número corporativo ("usted ha hecho un pago con tal [monto]").

**[PENDIENTE]** Definir el alcance exacto de la auxiliar en este módulo (ver 3.1).

### 3.6 Módulo 5: Bases de datos internas

La oficina maneja **3 bases de datos independientes entre sí** (no están relacionadas; cada una responde a una necesidad diferente):

#### 3.6.1 Base de datos de Liquidaciones Patrimoniales
- Información de seguimiento de los procesos que están en etapa de liquidación patrimonial (en juzgado).
- Campos (extraídos directamente de la transcripción y del Excel que mostró la abogada):
  - Radicado del proceso
  - Nombre del proceso
  - Juzgado asignado
  - Nombre del cliente
  - Cédula del cliente
  - Si fue aperturado (Sí/No) — "aperturado quiere decir que ya lo admitieron"
  - Si pagó liquidador (Sí/No)
  - Última actuación — "como lo último que pasó"
  - Observaciones — espacio libre para notas y seguimiento

#### 3.6.2 Base de datos de Información de acreedores
- Tabla simple con tres columnas principales:
  - NIT / Cédula del acreedor
  - Nombre del acreedor
  - Correo electrónico del acreedor
- **Importante:** Los acreedores **no son los clientes**. Son las entidades o personas a quienes el cliente les debe: bancos, cooperativas, Secretaría de Movilidad, etc.
- La abogada describió una de las bases: "es una base de datos sencilla... tiene NIT, acreedor y correo electrónico del acreedor."
- Esta base es necesaria porque la oficina envía comunicaciones a los acreedores como parte del proceso.

#### 3.6.3 Base de datos de Acuerdos / No acuerdos / Liquidación
- Bitácora de seguimiento del estado de cada proceso.
- Registra si el proceso terminó en acuerdo, si fracasó, si pasó a liquidación.
- Incluye observaciones y últimas actuaciones.
- Es la base que hoy se lleva en Excel y sirve como seguimiento interno general.

**Nota técnica del desarrollador:** Las tres bases de datos son **independientes entre sí**: "¿las tres están relacionadas? No, todas son independientes, cada una es otro proceso." Esto simplifica la implementación pero requiere un diseño cuidadoso para no duplicar datos que podrían correlacionarse.

### 3.7 Módulo 6: Base de datos de clientes

**Campos:**

| Campo | Descripción |
|---|---|
| Usuario | Nombre de usuario en la plataforma |
| Cédula | Documento de identidad del cliente |
| Email | Correo electrónico |
| Teléfono | Número de teléfono / WhatsApp |
| Dirección | Dirección física |
| Dirección de correo | Dirección para recepción de notificaciones postales |
| Tipo de cliente | Deudor / Acreedor / Garantista / Fiador — determina el rol del cliente dentro de un proceso específico |
| Radicado(s) asociado(s) | Código(s) interno(s) de los procesos del cliente |

**Relación con procesos:**
- **Un cliente puede tener varios procesos**, cada uno con su propio radicado. Se corrigió el supuesto inicial de "un cliente = un proceso."
- El desarrollador lo estructuró así: "yo creo un cliente que tiene que estar asociado a un repositorio. El cliente Pepito Fuentes va a estar asociado al repositorio 28, 27800, etc."

**Usos:**
- Módulo de solicitudes (vincular cliente con su proceso y documentos).
- Consulta rápida para la auxiliar cuando un cliente llama o escribe: "le sirve consultar al auxiliar para que 'Pepito' llame un cliente, pues le escriba ahí y para que esté el contacto interno."
- Alimentación automática: "cada que llegue un fulano, llegó Pepito Pérez Fuentes, yo ingreso a Pepito Pérez Fuentes, pongo la dirección, los datos de contacto y el radicado. Internamente me va llenando esa base de datos."

**Base de datos de abogados/personal:**
- El desarrollador mencionó que también se necesita una base de datos de los abogados/personal de la oficina: "tiene que haber una base de datos de abogados porque hoy está Edwin, está tú [Hannahi], está tu marido y está la secretaria. Pero mañana puede crecer, pueden llegar 20 personas más, tiene que crearse y todo eso tiene que tener diferentes permisos."

---

## 4. Arquitectura técnica

### 4.1 Plataforma

- **Fase 1:** Aplicación web (no app móvil nativa). Textualmente: "para la página web es más fácil" / "la aplicación es más complejo." Es más simple y rápida de construir, con la puerta abierta a convertirla en web app instalable en Fase 2.
- El desarrollador mencionó el concepto de **PWA (Progressive Web App)**: "web app que se puede convertir en aplicación celular."
- El cliente accede desde navegador en cualquier dispositivo. La abogada confirmó: "para la página web también se podría, la persona se mete y confía."

### 4.2 Base de datos y servidor

- El sistema requiere **múltiples bases de datos separadas** (no solo una):
  - Base de datos de **credenciales/acceso** (claves, tokens OTP)
  - Base de datos de **usuarios/clientes**
  - Base de datos de **operatividad** (procesos, repositorios, pagos)
  - Bases de datos internas de la oficina (liquidadores, acreedores, seguimiento)
- La separación es por **seguridad estructural**: "para que si yo entro al usuario José no me vaya a mostrar lo del usuario Camila" / "evita que la información de un usuario quede expuesta a otro por errores de correlación."
- La oficina **no cuenta con servidor propio**. Textualmente: "¿ustedes tienen servidor? No."
- Será necesario **contratar hosting externo**.

### 4.3 Flujo de estados — Desbloqueo secuencial

Idea planteada por el desarrollador para automatizar el avance procesal y reducir errores manuales. En vez de que todos los campos estén abiertos simultáneamente, **cada paso desbloquea el siguiente**:

1. **Radicar** — La auxiliar registra el radicado del proceso. Esto **habilita el paso 2**.
2. **Agendar audiencia** — Solo disponible para procesos ya radicados sin audiencia agendada (o con audiencia fallida). Se elige fecha, hora y enlace. Al enviarse, se notifica al cliente y se cierra este paso. Textualmente: "la secretaria puede agendar audiencia, le aparece el calendario, le dice aquí, le quiere agendar, y entonces se remita a lo que ustedes ya hicieron en el primer paso. Como ya sabemos que siempre antes de agendar audiencia tuvo que dar una audiencia previa o tiene que estar bien radicado, entonces van a estar disponibles solo los que están radicados sin agendar o agendados fallidos."
3. **Audiencia agendada** — El proceso queda "en espera" hasta que ocurra la audiencia.
4. **Resultado de audiencia** — La abogada entra, el caso está abierto. Marca si la audiencia pasó o no, ingresa el resumen, registra el estado/resultado. Textualmente: "tú como abogada ya entras y ya el caso está abierto. Tú lo colocas: en la audiencia pasó esto y se hizo esto y el estado [fue] este. ¿Pasó? Sí/No. Finalizar."
5. **Definición** — Al finalizar el paso anterior, se desbloquea la definición:
   - **Acuerdo** → Inicia etapa de pagos, fin del trámite conciliatorio.
   - **Fracaso** → El proceso pasa a Liquidación Patrimonial (módulo 3.3).

**Beneficio:** "cada paso desbloquea el siguiente, en vez de que todos los campos estén abiertos simultáneamente — esto busca ordenar el flujo de trabajo entre auxiliar y abogada y reducir errores."

### 4.4 Integración con almacenamiento actual

- La oficina actualmente usa **One Drive** para almacenar los repositorios de solicitudes y documentos. Textualmente: "en el Drive tenemos estas carpetas, cada carpeta es de [cada] cliente."
- También usan **OneDrive** para parte de la información.
- El desarrollador sugirió la posibilidad de que la plataforma se **conecte con la nube** existente: "puede ser que este [sistema] se conecte a la nube" / "digamos que estés en un caso y entonces que aquí diga: nuevo avance tal al cliente. Y aquí subir archivo. Automáticamente solo subió lo que ya subió [a Drive]. Me parece como que sería ordenado."
- **[PENDIENTE]** Definir si la plataforma reemplaza el Drive completamente (almacenamiento propio) o se integra con él.

---

## 5. Costos y modelo de cobro

### 5.1 Costos referenciales discutidos en la reunión

| Concepto | Costo estimado | Notas |
|---|---|---|
| **Desarrollo inicial** | ~$2.000.000 COP | El desarrollador mencionó: "me dijeron que por eso cobraría 2 millones por la página que yo les había pensado" — refiriéndose a un alcance más simple. El alcance actual es mayor. |
| **Mantenimiento mensual** | ~$120.000 COP/mes | Incluye: administración del servidor, ajustes menores (cambios de texto, colores), monitoreo. No incluye: cambios grandes de funcionalidad, nuevos módulos, Fase 2 ni Fase 3. |
| **Hosting** | ~$15 – $20 USD/mes | Para una web con base de datos ligera. "No se justifica un proveedor tipo AWS mientras el volumen de datos sea bajo." |
| **Dominio** | Variable (costo anual) | Depende del nombre elegido. "Si no es un dominio tan bonito, no vale tanto." |
| **Base de datos** | ~$5 USD/mes (adicional) | Mencionado como costo separado: "la base de datos por ahí 5 dólares, no mucho tampoco." |
| **[NUEVO — sin cotizar]** Servicio OTP por WhatsApp | **Pendiente** | Necesario para el login del cliente. Requiere WhatsApp Business API (Meta Cloud API, Twilio u otro). Tiene costo propio por mensaje o por mes. |

### 5.2 Modelo de cobro

- **Pago inicial** por el desarrollo completo de la Fase 1.
- **Mensualidad** que cubre:
  - Administración del servidor
  - Ajustes menores (texto, colores, correcciones)
  - Monitoreo de funcionamiento
- **Cambios grandes** de funcionalidad (nuevos módulos, rediseños) se cotizan aparte.
- El desarrollador mencionó un modelo que ya ha usado: "un código que fuera creciendo poquito; la página va creciendo, va creciendo la página."

**[PENDIENTE]** Definir valores definitivos para el pago inicial y la mensualidad, considerando que el alcance actual es más amplio que lo originalmente estimado por el desarrollador.

---

## 6. Resumen completo de decisiones tomadas

| # | Decisión | Detalle |
|---|---|---|
| 1 | Priorizar página web sobre app | Fase 1 es web; app queda para Fase 2 |
| 2 | Login con cédula + OTP (no solo cédula) | Se descartó acceso solo con cédula por inseguro |
| 3 | Un cliente puede tener múltiples procesos | Cada proceso con su propio radicado |
| 4 | No se borra información de procesos cerrados | Se archivan visualmente, no se eliminan |
| 5 | Línea de tiempo visual para avance procesal | Estilo "tracking de pedido" |
| 6 | El cliente no realiza pagos desde la plataforma | Solo consulta; pagos se registran manualmente por la oficina |
| 7 | No se incluye link de audiencia en la plataforma (cliente) | Se sigue manejando por WhatsApp |
| 8 | No se incluye calendario de audiencias para el cliente | No aporta valor adicional al cliente |
| 9 | La auxiliar tiene restricción sobre información financiera | Alcance exacto pendiente |
| 10 | Repositorio de solicitudes y de liquidación son módulos separados | Etapas procesales distintas |
| 11 | Tres bases de datos internas independientes | Liquidadores, Acreedores, Seguimiento |
| 12 | Link de audiencia no se incluye en la agenda de la plataforma | Se sigue por WhatsApp/correo |
| 13 | IA y automatizaciones fuera del alcance inicial | Fase 3, complejidad alta |

---

## 7. Resumen completo de pendientes por decidir

| # | Pendiente | Impacto | Prioridad |
|---|---|---|---|
| 1 | **Paleta completa de colores/estados para los casos** — ¿Cuántos estados existen (hasta ~20) y qué color corresponde a cada uno? | Bloquea el diseño visual del semáforo de estados en repositorios y línea de tiempo. | 🔴 Alta |
| 2 | **Alcance exacto de permisos de la auxiliar sobre pagos** — ¿Solo restricción de edición, o también de visualización? | Cambia el diseño del módulo de pagos y el sistema de permisos. | 🔴 Alta |
| 3 | **¿La auxiliar puede eliminar información?** | Afecta permisos CRUD del rol auxiliar. | 🟡 Media |
| 4 | **Cotización del servicio de mensajería OTP** — Proveedor, costo por mensaje/mes. | Necesario para el login del cliente. Sin esto, no se puede implementar la autenticación. | 🔴 Alta |
| 5 | **Periodo de retención legal de procesos cerrados** — ¿3 años? ¿6 años? ¿Otro? | Obligación legal, no preferencia de producto. Implicaciones de cumplimiento normativo. | 🟡 Media |
| 6 | **Costo definitivo del dominio** — Depende del nombre elegido. | Presupuesto final. | 🟢 Baja |
| 7 | **Valores definitivos de pago inicial y mensualidad** | Negociación comercial con Edwin. | 🔴 Alta |
| 8 | **¿Se cotizan Fase 2 y Fase 3 ahora o se dejan para después?** | Planificación y expectativas del cliente. | 🟡 Media |
| 9 | **¿El cliente podrá subir documentos (checklist)?** | Diseño de la interfaz del cliente; si se añade, implica un módulo de carga con control de acceso. | 🟡 Media |
| 10 | **¿La plataforma reemplaza Drive o se integra con él?** | Arquitectura de almacenamiento de archivos. | 🟡 Media |

---

## 8. Próximos pasos acordados en la reunión

1. **El desarrollador** elabora un diagrama de bloques interconectando todos los módulos: "yo voy a hacer un diagrama de bloques, interconectar todo."
2. **La abogada** presenta la complejidad del proyecto a Edwin para que comprenda el alcance y el costo: "yo le voy a mostrar hoy toda la complejidad" / "cuesta plata."
3. **Antes de construir**, el desarrollador prepara demos visuales: "antes de ponerte a crear todo, más bien revísate, fija tus ideas, si puede hacer demos nomás de lo que dice."
4. **Se itera sobre el diseño** antes de empezar el desarrollo: "podemos ir cuadrando y modificando."
5. **El presupuesto final** se presenta a Edwin con todas las líneas de costo (incluyendo OTP, hosting, dominio, desarrollo y mantenimiento).
