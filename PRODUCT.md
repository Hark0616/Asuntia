# Product

## Register

product

## Users

La visión de Asuntia contempla los siguientes perfiles. Su enumeración describe responsabilidades de producto, no certifica que todas las funciones estén implementadas. El núcleo vigente se centra en jefe de firma, abogado, auxiliar/secretaria y cliente; soporte técnico excepcional, finanzas y otras ampliaciones necesitan su especificación y autorización propias.

- **Superadministrador técnico:** propietario o responsable técnico de la plataforma. Administra firmas, configuración global, soporte, pruebas y accesos de emergencia. Sus intervenciones deben quedar justificadas y auditadas.
- **Administrador de la firma:** dirige la operación de una oficina, administra su equipo, permisos, asuntos, finanzas y configuración propia.
- **Abogado:** analiza la viabilidad jurídica, toma decisiones profesionales, controla términos, prepara actuaciones, valida información y comunica avances.
- **Auxiliar:** organiza documentos, agenda, solicitudes, datos operativos y seguimiento, dentro de permisos y revisiones definidos por la firma.
- **Cliente:** consulta su asunto, entiende qué ocurrió y qué debe hacer, recibe solicitudes e información financiera autorizada y reporta errores o cambios.

Los usuarios internos trabajan principalmente en escritorio y necesitan densidad informativa, rapidez y trazabilidad. El cliente usa con frecuencia el teléfono, puede tener baja familiaridad digital y necesita lenguaje directo.

## Product Purpose

Asuntia es una herramienta operativa para gestionar asuntos jurídicos de una firma. El expediente compartido es su núcleo general; insolvencia es una especialización que puede aportar una guía de trabajo, sin ser requisito para abrir o gestionar cualquier asunto.

Su propósito es convertir información dispersa entre WhatsApp, hojas de cálculo, carpetas y notas en un expediente único, verificable y accionable. Debe ayudar al equipo a controlar términos, documentos, actuaciones, acreencias, pagos, comunicaciones y responsabilidades, y permitir al cliente comprender el estado de su asunto sin crear falsas expectativas.

El producto tiene éxito cuando cada usuario sabe qué requiere atención, puede encontrar la evidencia correcta rápidamente y ninguna decisión importante depende de memoria, búsquedas en chats o datos duplicados.

La prioridad es facilitar el trabajo diario dentro de un expediente compartido: los abogados actualizan sus asuntos, la auxiliar captura información y ejecuta tareas delegadas, y la dirección consulta el conjunto, asigna responsables y ayuda a resolver pendientes. Documentos, actividad, fechas y tareas se relacionan con el mismo asunto, sin volver a capturar información para cada vista.

El cliente consulta una selección autorizada de ese trabajo. Publicar un avance conserva la nota original y su autoría; la vista del cliente se actualiza sin mantener una segunda historia del expediente. La agenda se alimenta de las fechas existentes y la bandeja muestra el trabajo asignado.

La dirección vigente es construir un producto duradero mediante entregas completas, con datos y permisos reales, migraciones compatibles, recuperación de errores y verificación. La prioridad está en [la base y el checklist del producto](docs/CHECKLIST_PRODUCTO_2026-10-14.md). Una entrega pequeña no reduce esos requisitos. Versionado documental y ampliaciones como IA o sincronización externa no forman parte automática de esta decisión de calidad.

## Brand Personality

Sobria, clara y confiable.

La interfaz debe transmitir control profesional y calma. El tono es directo, respetuoso y preciso; evita tecnicismos innecesarios con clientes y conserva precisión jurídica para el equipo interno. El uso del color para diferenciar estados y etapas debe ser sutil y no marcado (mediante tintes suaves, badges desaturados o indicadores discretos), manteniendo una estética limpia, sobria y profesional sin saturación visual.

## Anti-references

- No debe parecer una página promocional o una plantilla SaaS genérica.
- No debe sentirse como un ERP recargado ni como un Excel incrustado en el navegador.
- No debe convertir cada dato en una tarjeta ni esconder relaciones importantes detrás de modales.
- No debe usar el lenguaje o la estética de seguimiento de paquetes de forma que trivialice un proceso jurídico.
- No debe depender de colores sin texto para comunicar estados.
- No debe usar colores estridentes, fosforescentes o bloques de color saturados que recarguen la interfaz.
- No debe mostrar mensajes institucionales, decorativos o repetitivos que retrasen la acción.
- No debe inventar interacciones llamativas para funciones estándar.

## Design Principles

1. **Trabajo antes que navegación:** cada pantalla comienza por lo que el usuario debe decidir o hacer.
2. **Un asunto, una verdad:** estados, documentos, pagos y comunicaciones comparten una fuente coherente y muestran su nivel de verificación.
3. **Densidad con jerarquía:** la oficina puede manejar mucha información sin perder orientación; se revela detalle progresivamente.
4. **Acción con contexto:** toda tarea muestra asunto, responsable, término, consecuencia y evidencia relacionada.
5. **Confianza verificable:** los cambios sensibles, accesos excepcionales y decisiones profesionales dejan trazabilidad visible.
6. **Cliente sin incertidumbre:** la experiencia externa explica estado, próxima acción y fecha de actualización en lenguaje sencillo.
7. **Consistencia transversal:** los mismos conceptos, estados, acciones y patrones se comportan igual en todos los módulos.
8. **Actualizar una vez, informar en todas partes:** el trabajo interno alimenta automáticamente la bandeja, la agenda, el expediente y la vista autorizada del cliente; nunca se exige mantener dos historias paralelas.

## Accessibility & Inclusion

La accesibilidad es un criterio de calidad de cada recorrido: legibilidad, contraste verificado, navegación por teclado, foco visible y restaurado, etiquetas y errores accesibles, objetivos táctiles cómodos, mensajes que no dependan solo del color y adaptación entre móvil y escritorio. Se comprueba con pruebas automáticas y revisión manual de los recorridos; no se declara conformidad normativa sin evaluarla. El minimalismo debe facilitar encontrar y usar las herramientas, preservando las instrucciones operativas necesarias.
