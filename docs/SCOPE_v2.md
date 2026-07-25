# Scope y arquitectura — Plataforma de gestión de procesos legales (negociación de pasivos / insolvencia)

> Documento base consolidado a partir del boceto en papel de la abogada, la reunión de definición de alcance y la ronda de revisión posterior. Las secciones marcadas con **[PENDIENTE]** son decisiones que quedaron abiertas y deben confirmarse antes de iniciar desarrollo.

---

## 0. Fases del proyecto

1. **Fase 1 — Página web (prioridad actual):** interfaz cliente + interfaz oficina descritas en este documento. Es la fase más rápida de construir y la que resuelve el desorden actual de información dispersa en WhatsApp, Excel y Drive.
2. **Fase 2 — Aplicación:** una vez validada la página web, se evalúa convertirla en web app instalable (app de celular).
3. **Fase 3 — Automatizaciones con IA:** lectura automática de correos, agendamiento automático en calendario y notificaciones automáticas. Reconocido como de alta complejidad; **fuera del alcance inicial**, queda como visión a futuro.

---

## 1. Interfaz cliente

### 1.1 Acceso
- El cliente **no** crea usuario y contraseña tradicionales.
- **Mecanismo de seguridad definido:** ingresa con su número de **cédula** + un **código OTP (token dinámico)** enviado a su WhatsApp registrado.
- Se **descartó** usar el número de radicado como clave de acceso, por el riesgo de exposición de datos sensibles si alguien más lo conoce (el radicado no es un dato realmente secreto).
- **[PENDIENTE / NUEVO PUNTO A PRESUPUESTAR]** El envío de OTP por WhatsApp requiere un proveedor de mensajería tipo WhatsApp Business API (Meta Cloud API, Twilio u otro similar). Este servicio tiene **costo propio por mensaje o por mes**, adicional al hosting. Debe cotizarse aparte y añadirse al presupuesto de la sección 3.

### 1.2 Relación cliente–proceso
- Un cliente puede tener **múltiples procesos** (casos) asociados a su cédula (p. ej. un proceso de insolvencia y, aparte, un proceso de divorcio u otro asunto no relacionado).
- Cada proceso tiene su propio radicado interno, aunque estén ligados a la misma cédula.
- Al ingresar, el cliente ve la lista de todos sus procesos y puede entrar a revisar el avance individual de cada uno.
- **Retención:** no se elimina información de ningún proceso. Los procesos cerrados se **archivan visualmente** (cambio de color, ver 1.3) en vez de borrarse.
- **[PENDIENTE — verificar con la abogada]** En la reunión se mencionó un rango de **3 a 6 años** de retención según el tipo de proceso, pero la propia abogada indicó que debía revisar cuál es el periodo normativo exacto exigido por ley. Este dato **no debe tratarse como definitivo** hasta que se confirme; es una obligación legal, no una preferencia de producto, así que un valor incorrecto tiene implicaciones de cumplimiento.

### 1.3 Avance procesal (línea de tiempo por caso)
El cliente visualiza en qué etapa se encuentra su trámite:

1. **Radicar** — se registra el proceso.
2. **Audiencia** — se agenda fecha de audiencia.
3. **Resultado de audiencia** — la abogada marca si la audiencia se realizó y su resultado: **Acuerdo** o **Fracaso**.
   - *Si hay Acuerdo:* el proceso finaliza aquí en cuanto a la conciliación; el cliente pasa a la etapa de pagos según lo acordado.
4. **Fracaso** — si no hubo acuerdo, se registra el acta de fracaso.
5. **Liquidación** — el proceso pasa a liquidación patrimonial ante el juzgado (ya no es un trámite de conciliación sino un proceso judicial).

Los casos se muestran con un **código de colores** según su estado (mismo criterio del repositorio de solicitudes, ver 2.2). **[PENDIENTE]** Definir la paleta completa: cuántos estados existen (se mencionó un máximo de ~20 en el repositorio de solicitudes) y qué color corresponde a cada uno. Sin esta lista cerrada, el desarrollo del semáforo de estados no se puede completar.

### 1.4 Pagos realizados y pendientes
- Cuadro con:
  - Honorarios adeudados.
  - Total pagado hasta el momento.
  - Saldo pendiente.
  - **Desglose por concepto** — el cliente debe poder ver *por qué* debe cada valor (ej. cuota de honorarios de abogado vs. honorarios de liquidador vs. otro concepto), no solo un número consolidado. Esto se pidió explícitamente en la reunión ("que también vea cuánto ha pagado y qué le debe y por concepto de qué").
- El cliente tiene **permisos de solo lectura**; no puede registrar ni modificar pagos.
- Un cliente con varios procesos puede tener pagos asociados a cada proceso por separado.

### 1.5 Fuera de alcance para el cliente
- No se visualiza calendario de audiencias ni links de conexión dentro de la plataforma. Este flujo se sigue manejando directo por WhatsApp con la abogada; se evaluó agregarlo y se descartó por no aportar valor adicional frente al canal que ya usan.

---

## 2. Interfaz oficina

### 2.1 Roles y permisos

| Rol | Persona | Permisos |
|---|---|---|
| **Administrador** | Edwin | Control total: crear, editar, eliminar, asignar y modificar montos/saldos. |
| **Abogada** | Hannahi | Permisos operativos amplios: gestión de agendas, avances procesales, actas y resultados de audiencia. No tiene control de administración del sistema (no gestiona usuarios ni configuración). |
| **Auxiliar** | Daniela | Ingresa datos operativos: radica procesos, sube documentos/soportes, actualiza la agenda de audiencias, carga comprobantes de pago recibidos. |

**Nota operativa sobre pagos (auxiliar):** la auxiliar puede **cargar los soportes/comprobantes** de pago al sistema, pero **no tiene capacidad de asignar ni editar los saldos finales** — eso queda reservado al administrador/abogada, para proteger la privacidad de los honorarios.

**[PENDIENTE — ambigüedad detectada]** No quedó resuelto si el auxiliar solo tiene restringida la **edición** de montos, o si además tiene restringida la **visualización** (es decir, si puede ver cuánto debe un cliente aunque no pueda modificarlo, o si esa información le queda completamente oculta). En la reunión la pregunta original era "¿se podría que el auxiliar no pueda **revisar** eso?", lo cual apunta a ocultar también la lectura, no solo el edit. Esto cambia el diseño de permisos del módulo de pagos (2.4) y debe confirmarse antes de construirlo.

- El sistema debe permitir crear roles adicionales a futuro (la oficina puede crecer más allá de las 3 personas actuales, sin que eso implique rediseñar el sistema de permisos).

### 2.2 Repositorio de Solicitudes
Contiene toda la información necesaria para elaborar las solicitudes de negociación de pasivos.

- **Organización:** cada carpeta/caso tiene un **color según su estado** (hasta ~20 estados posibles, aún sin listar — ver pendiente en 1.3).
- **Subestructura del caso:**
  - **Anexos** — documentación entregada por el cliente para construir el escrito de solicitud: cédula, desprendible de pago, certificado laboral, REDAM, registros, etc. Tanto el cliente como la oficina pueden subir estos documentos; no hay restricción estricta sobre quién sube primero.
  - **Escrito de solicitud** — documento operativo (Word) redactado por la abogada con la información del cliente: acreedores, ingresos, gastos de subsistencia y propuesta de pago (capital condonado de intereses, plazo, ej. 120 meses).
  - **Audiencias** — documentos generados en esta etapa: auto admisorio, actas, acta de fracaso o acta de acuerdo.

**Flujo del proceso de conciliación:**
1. Se arma la solicitud con los anexos del cliente.
2. Se presenta al **Centro de Conciliación**.
3. El centro **admite la negociación** (o la rechaza).
4. Se **fija fecha de audiencia**.
5. Ocurre la **audiencia** (normalmente una por proceso) → se genera **un acta**.
6. Resultado:
   - **Acuerdo** → el cliente empieza a pagar según lo acordado.
   - **Fracaso** (el resultado más frecuente) → se genera **acta de fracaso** y el proceso pasa a Liquidación patrimonial.

### 2.3 Repositorio Liquidación Patrimonial (módulo juzgado)
Cuando el proceso fracasa en conciliación, pasa a **liquidación patrimonial** en un juzgado — es el desenlace de la mayoría de los casos.

- Es información **distinta** a la del repositorio de solicitudes, porque corresponde a otra etapa procesal (ya no la maneja el centro de conciliación sino el juzgado).
- Almacena: auto de apertura, comunicaciones que expide el juzgado, poderes otorgados por el cliente, y demás documentos que van saliendo durante el proceso judicial.
- Este módulo **reemplaza las carpetas físicas amarillas** que hoy usa la oficina; actualmente esta información no está digitalizada de forma organizada, así que es una de las prioridades de la plataforma.

### 2.4 Pagos pendientes
Módulo separado del repositorio de solicitudes, con dos categorías de pago claramente distintas:

- **Pagos de honorarios** — lo que el cliente debe pagar a la oficina/abogados por llevar su proceso.
- **Pagos al liquidador** — honorarios que fija el juzgado cuando se admite el proceso a liquidación; es un pago a un **tercero designado por el juzgado**, no a la oficina, pero la oficina necesita hacerle seguimiento porque afecta directamente al cliente.

Flujo operativo:
- El cliente envía el comprobante de pago por WhatsApp al número corporativo.
- La auxiliar carga ese soporte al sistema.
- El registro del saldo/monto final queda sujeto a la restricción de permisos descrita en 2.1 (pendiente de confirmar alcance exacto).

### 2.5 Agenda de audiencias
Campos obligatorios:
- **Fecha**.
- **Cliente**.
- **Resumen de la audiencia previa** — contexto que la abogada redacta después de cada audiencia, para que la siguiente audiencia (propia o de otra abogada) tenga el histórico de lo ocurrido.

Se **prescinde** de incluir el link de la audiencia dentro de la plataforma (decisión tomada, no pendiente): se sigue enviando por WhatsApp/correo como hasta ahora.

Flujo de uso:
- La abogada, después de cada audiencia, envía a la auxiliar el resumen de lo ocurrido.
- La auxiliar actualiza la agenda con fecha, cliente y resumen.
- La abogada consulta la agenda del día siguiente para contextualizarse antes de cada audiencia.

Ideas a futuro (Fase 3, no confirmadas):
- Envío automático de recordatorios.
- Conexión con Google Calendar.
- Automatización tipo IA que lea el nombre del cliente, lo busque en la base de datos, arme el resumen y agende automáticamente.

### 2.6 Bases de datos internas
Las bases de datos son **independientes entre sí**, para evitar cruce accidental de información entre módulos:

1. **Liquidadores** — información de los liquidadores asignados por el juzgado a cada proceso.
2. **Información de acreedores** — tabla simple: identificación del acreedor (NIT/cédula), nombre y correo electrónico. *Importante: los acreedores no son los clientes*, son las entidades (bancos, cooperativas, etc.) a quienes el cliente les debe.
3. **Seguimiento de Acuerdos / Liquidación** — bitácora de observaciones y estados de cada proceso (si se aperturó, si se pagó al liquidador, última actuación, etc.). Es la base que hoy se lleva en Excel y sirve como seguimiento interno.

### 2.7 Base de datos de clientes
Campos:
- Usuario
- Cédula
- Email
- Teléfono
- Dirección
- Dirección de correo
- **Tipo de cliente:** Deudor / Acreedor / Garantista / Fiador — campo del alcance original que debe conservarse; determina el rol del cliente dentro de un proceso específico y puede afectar qué información se le muestra.
- Radicado(s)/código(s) interno(s) asociado(s)

Relación con procesos:
- Un cliente puede tener **varios procesos**, cada uno con su propio radicado.
- Sirve tanto para el módulo de solicitudes como para consulta rápida del auxiliar cuando un cliente llama o escribe.

---

## 3. Arquitectura técnica y presupuesto

### 3.1 Plataforma
- **Fase 1:** aplicación web (no app móvil nativa). Es más simple y rápida de construir, con la puerta abierta a convertirla en web app instalable en Fase 2.
- **Bases de datos:** múltiples bases de datos separadas (credenciales, usuarios, operatividad) por seguridad estructural — evita que la información de un usuario quede expuesta a otro por errores de correlación.
- La oficina **no cuenta con servidor propio**; se requiere contratar hosting externo.

### 3.2 Costos referenciales acordados
| Concepto | Costo estimado |
|---|---|
| Desarrollo inicial | ~$2.000.000 COP |
| Mantenimiento mensual (administración y ajustes menores) | ~$1.000.000 COP/mes |
| Hosting e infraestructura base | $15 – $20 USD/mes |
| Dominio | Variable según nombre elegido (costo anual) — sin cifra cerrada |
| **[NUEVO — falta cotizar]** Servicio de mensajería OTP por WhatsApp (Meta Cloud API / Twilio u otro) | **Sin cotizar.** Necesario para el login del cliente (ver 1.1). Debe añadirse como línea de costo antes de presentar el presupuesto final a Edwin, ya que hoy el presupuesto solo contempla hosting/dominio y no el envío de mensajes. |

**Nota sobre el alcance de la mensualidad:** cubre administración del servidor y ajustes menores (cambios de texto, colores). Cambios grandes de funcionalidad (nuevos módulos, Fase 2, Fase 3) se cotizan aparte.

### 3.3 Flujo de estados (desbloqueo secuencial)
Idea para automatizar el avance y reducir errores manuales — cada paso desbloquea el siguiente, en vez de tener todos los campos abiertos simultáneamente:

1. **Radicar** — la auxiliar registra el radicado del proceso. Habilita el paso 2.
2. **Agendar audiencia** — solo disponible para procesos ya radicados sin audiencia agendada (o con audiencia fallida). Requiere fecha, hora y enlace; al enviarse, notifica al cliente y cierra este paso.
3. **Audiencia agendada** — el proceso queda "en espera" hasta que ocurra la audiencia.
4. **Resultado de audiencia** — la abogada ingresa el acta y el resumen; marca si la audiencia se realizó o no. Habilita la definición.
5. **Definición** — Acuerdo (inicia etapa de pagos) o Fracaso (envía el proceso a Liquidación patrimonial, módulo 2.3).

---

## 4. Resumen de pendientes por decidir

- [ ] Paleta completa de colores/estados para los casos (cuántos estados existen y qué color corresponde a cada uno).
- [ ] Alcance exacto del permiso del auxiliar sobre pagos: ¿solo restringido para editar, o también para ver/consultar montos?
- [ ] Confirmación legal del periodo de retención de procesos cerrados (rango mencionado: 3–6 años, sin verificar formalmente).
- [ ] Cotización del servicio de mensajería OTP por WhatsApp (proveedor, costo por mensaje/mes) e inclusión en el presupuesto final.
- [ ] Costo definitivo del dominio (depende del nombre elegido).
- [ ] Confirmar si Fase 2 (app) y Fase 3 (automatización con IA) se cotizan ahora junto con Fase 1 o se dejan totalmente para después.