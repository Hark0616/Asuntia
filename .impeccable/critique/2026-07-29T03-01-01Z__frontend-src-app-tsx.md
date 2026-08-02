---
target: experiencia completa del abogado en Asuntia basada en la transcripcion
total_score: 15
p0_count: 3
p1_count: 2
timestamp: 2026-07-29T03-01-01Z
slug: frontend-src-app-tsx
---
Method: dual-agent (A: /root/ux_abogado · B: /root/detector_visual) + domain review (/root/transcripcion_plan)

# Auditoría UX total de Asuntia — experiencia del abogado

## Dictamen

Asuntia no falla principalmente por su apariencia. Falla porque presenta registros sin organizar el trabajo jurídico.

La pantalla inicial responde “¿qué información tiene el primer cliente de la lista?”, pero la transcripción exige responder “¿qué requiere mi atención hoy, por qué y antes de cuándo?”. El producto actual es un prototipo conectado de clientes, estados, documentos y novedades; todavía no es una plataforma donde un abogado pueda ejecutar y comprobar de principio a fin su trabajo.

La evidencia más seria está en el expediente visible de Carlos Gómez: simultáneamente aparece como **“Sin acción aún”**, está en **“Paso 1: Radicación”** y su timeline afirma que **la solicitud ya fue admitida**. No es un detalle de datos semilla: la interfaz y el backend permiten que esas tres fuentes evolucionen por separado.

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---:|---|
| 1 | Visibilidad del estado del sistema | 2/4 | Hay cargas parciales, pero varias operaciones no confirman éxito ni muestran error; durante la carga aparece falsamente “base limpia”. |
| 2 | Correspondencia con el mundo real | 2/4 | Usa vocabulario jurídico, pero el asunto comienza en radicación y confunde caso, asunto, expediente, código y radicado. |
| 3 | Control y libertad | 2/4 | Se puede cancelar un modal, pero no corregir, reabrir o justificar una transición procesal. |
| 4 | Consistencia y estándares | 2/4 | La estética es consistente; estado, ruta y timeline no lo son. |
| 5 | Prevención de errores | 1/4 | Se puede elegir “Admitido” mientras la ruta continúa en “Radicación”; publicar al cliente es el valor predeterminado. |
| 6 | Reconocimiento antes que recuerdo | 1/4 | No hay bandeja, recientes, búsqueda, responsables visibles ni priorización. |
| 7 | Flexibilidad y eficiencia | 1/4 | No existen filtros operativos, atajos, acciones por lote, agenda o vista personal. |
| 8 | Diseño estético y minimalista | 2/4 | Es sobrio, pero plano y monolítico; todos los paneles compiten en una página larga. |
| 9 | Recuperación de errores | 1/4 | Varias mutaciones pueden fallar silenciosamente y limpiar lo escrito antes de confirmar. |
| 10 | Ayuda y documentación | 1/4 | Hay tooltips aislados, no orientación del trabajo ni explicación de consecuencias. |
| **Total** |  | **15/40** | **Poor — requiere rehacer la columna vertebral antes del piloto** |

## Anti-Patterns Verdict

**Evaluación humana:** visualmente no parece una interfaz “hecha por IA” de forma obvia. La paleta es sobria, la tipografía es legible y los controles comparten vocabulario visual. El problema es *product slop*: un CRUD genérico organizado alrededor de entidades técnicas —clientes, casos, estados— en lugar de términos, decisiones, actuaciones, evidencia y responsables.

**Detector determinista:** encontró un solo warning, `overused-font`, por el uso de Inter en `frontend/src/styles/globals.css:15`. Se considera una prioridad falsa para una aplicación autenticada: Inter es adecuada para este tipo de producto. Como señales de mantenimiento encontró 101 estilos inline y 25 colores hexadecimales fuera de `tokens.css`; no explican la desconexión principal, pero dificultan consolidar estados y accesibilidad.

**Evidencia de navegador:** no fue posible inyectar overlays porque la pestaña solo ofreció evaluación de solo lectura. Se usaron como respaldo snapshots accesibles, capturas de escritorio/móvil, mediciones de foco, tamaño y contraste, y revisión del código. No existe un overlay humano visible.

## Qué sí funciona

- La dirección visual es profesional y puede conservarse: sobria, desaturada y sin decoración innecesaria.
- Los formularios de cliente y asunto muestran el contexto de persona y responsable, lo que reduce errores de asociación.
- La ruta distingue estados mediante texto además de color.
- Ajustes y almacenamiento ya están fuera de la portada y restringidos visualmente a administración.
- OneDrive está oculto; Google Drive y servidor local quedan como opciones de prueba.

## Contraste con la transcripción

La fuente primaria disponible no es una transcripción cruda independiente. `docs/SCOPE_FINAL.md` conserva la memoria de reunión en sus secciones 0–7 y después añade trazabilidad jurídica y de producto. Se aplicó su jerarquía real: `[T]` transcripción, `[N]` necesidad, `[L]` requisito legal, `[D]` decisión y `[P]` pendiente. La adenda prevalece cuando corrige una afirmación de reunión.

| Trabajo esperado | Evidencia de la transcripción/SCOPE | Experiencia actual | Brecha |
|---|---|---|---|
| Empezar por lo urgente | Términos, audiencias, correcciones, clientes pendientes y decisiones del abogado (`SCOPE` 856–869) | Abre el primer cliente y su primer caso | El abogado no sabe por qué está allí ni qué debe hacer |
| Preparar antes de presentar | Recepción, anexos, datos económicos, acreedores y redacción ocurren antes de radicar (`SCOPE` 5–16, 181–219) | El primer paso es “Radicación” | El sistema comienza después del trabajo jurídico real |
| Retomar un asunto con contexto | Estado, fuente, riesgo, responsable, término y siguiente acción (`SCOPE` 872–888, 2339–2399) | Estado, código, responsable genérico y wizard | No permite decidir con seguridad |
| Registrar una vez | Una actuación validada actualiza estado, tareas, agenda y portal (`SCOPE` 1235–1254, 3355–3369) | Estado, ruta y novedad son formularios independientes | Duplica trabajo y genera contradicciones |
| Admitir rutas no lineales | Corrección, rechazo, recurso, suspensión, varias audiencias, liquidación directa (`SCOPE` 580–633, 807–852) | Cinco pasos rígidos | Obliga una ficción procesal |
| Coordinar roles | Auxiliar prepara; abogado valida; publicación requiere permiso (`SCOPE` 1029–1053) | `require_office_user` habilita acciones críticas a todo el personal interno | Los roles son etiquetas, no segregación real |
| Controlar agenda y términos | Audiencia con preparación, enlace, resultado y tareas (`SCOPE` 292–317, 2731–2767) | Fecha guardada dentro de JSON de un paso | No hay agenda, alertas, conflictos ni cierre |
| Diferenciar identidades | Código interno y radicado oficial son datos distintos (`SCOPE` 876–880) | `radicado` contiene el código interno y el oficial queda en JSON | Búsqueda, lenguaje y trazabilidad se mezclarán |

## Priority Issues

### [P0] No existe una columna vertebral orientada al trabajo

**Qué:** la entrada selecciona `clientes[0]` y `casos[0]`. No hay “Mi trabajo”, agenda, tareas ni decisiones pendientes.

**Por qué importa:** el abogado no puede comprobar su jornada operativa ni confiar en que Asuntia le muestra lo urgente.

**Corrección:** hacer de **Mi trabajo** la pantalla inicial, priorizada por vencimientos, audiencias, decisiones, revisiones, solicitudes al cliente, pagos bloqueantes y asuntos sin siguiente acción.

**Comando sugerido:** `$impeccable shape`

### [P0] El modelo procesal comienza tarde y fuerza una ruta falsa

**Qué:** todo asunto nace en “Paso 1: Radicación” y recorre cinco pasos lineales.

**Por qué importa:** omite diagnóstico, viabilidad, documentos, acreencias y preparación; tampoco registra correcciones, suspensiones, reprogramaciones, múltiples audiencias o liquidación directa.

**Corrección:** comenzar en **Recepción y evaluación**, modelar eventos/actuaciones con ramas y excepciones, y reservar radicación oficial para cuando exista evidencia de presentación.

**Comando sugerido:** `$impeccable clarify`

### [P0] Existen tres fuentes de verdad incompatibles

**Qué:** el selector de Estado Procesal, `AsuntoPaso` y la novedad publicada se actualizan de manera independiente.

**Por qué importa:** el equipo y el cliente pueden ver relatos distintos; además, el abogado digita la misma realidad varias veces.

**Corrección:** convertir la **actuación validada** en el registro fuente. De ella se derivan estado, siguiente acción, tarea, término, agenda, historial y borrador publicable. Las correcciones requieren motivo y conservan historia.

**Comando sugerido:** `$impeccable shape`

### [P1] La interacción no confirma ni protege el trabajo

**Qué:** varias mutaciones no muestran éxito/error; cliente y avance limpian información antes de confirmación; durante carga se muestra “base limpia”.

**Por qué importa:** un abogado puede creer que publicó o guardó algo que realmente falló.

**Corrección:** skeletons, guardado confirmado, mensajes accionables, reintento, borradores persistentes y comprobante de acciones sensibles.

**Comando sugerido:** `$impeccable harden`

### [P1] La página monolítica y los modales excluyen usuarios

**Qué:** no hay landmark `main`, no existen regiones `aria-live`, los modales carecen de semántica, foco, Escape y fondo inerte; el menú móvil pierde su nombre accesible.

**Por qué importa:** el trabajo profundo queda en una página extensa y usuarios de teclado/lector de pantalla pueden quedar desorientados.

**Corrección:** workspace con URL y navegación estable; modales solo para captura breve; foco administrado; objetivos táctiles de 44 px; contraste AA; jerarquía de encabezados correcta.

**Comando sugerido:** `$impeccable audit`

## Arquitectura de información objetivo

### Navegación de la firma

- **Mi trabajo** — entrada predeterminada.
- **Asuntos** — inventario, filtros y búsqueda.
- **Personas** — clientes y demás relaciones, sin duplicar identidades.
- **Agenda** — audiencias, términos, reuniones y tareas con fecha.
- **Finanzas** — por permiso.
- **Directorios e informes**.
- **Administración** — equipo, permisos, publicación, privacidad e integraciones; solo administración.

### Dentro de un asunto

- **Resumen:** situación, evidencia, riesgo, responsable, término y acción principal.
- **Preparación:** viabilidad, personas/acreedores, bienes, ingresos/gastos, procesos y documentos.
- **Procedimiento:** actuaciones/términos, audiencias, propuesta/acuerdo y liquidación.
- **Gestión:** tareas, finanzas, comunicaciones, historial y auditoría.

El encabezado debe conservar cliente, código interno, radicado oficial si existe, ruta, estado, responsable, riesgo, siguiente evento y fecha de última validación.

## Flujo objetivo del abogado

```text
Mi trabajo
  → abrir tarea, término o audiencia prioritaria
  → entender el resumen persistente del asunto
  → ejecutar una acción contextual
  → preparar y enviar a revisión
  → validar por el rol autorizado
  → derivar automáticamente estado, tarea, agenda, historial y portal
  → corregir con motivo sin destruir historia
```

### Alta coherente

La petición reciente de “crear el cliente y recibir automáticamente el paso 1” contradice la regla documental que evita crear un asunto por cada persona registrada (`SCOPE` 2100). La solución de producto es una acción compuesta **Nuevo asunto**:

1. Buscar o registrar persona.
2. Registrar control inicial y servicio solicitado.
3. Crear asunto “En evaluación”.
4. Generar código interno.
5. Asignar abogado y auxiliar.
6. Crear automáticamente la primera tarea: **Completar recepción y evaluación inicial**.
7. Mostrar checklist de identidad, conflicto, contrato/poder, viabilidad y documentos.
8. Crear radicado oficial únicamente al presentar la solicitud.

“Registrar persona” puede mantenerse en el directorio para acreedores, cónyuges, representantes y contactos que no originan un asunto.

## Persona Red Flags

**Abogado responsable:** no ve términos, responsable real, evidencia ni consecuencia de no actuar. “Equipo jurídico asignado” no establece responsabilidad. Puede modificar información pública sin una actuación validada.

**Auxiliar:** no recibe una bandeja de documentos, agenda y datos por preparar, ni puede enviar trabajo a revisión. El sistema la trata casi igual que al abogado.

**Primer usuario:** ve a Carlos sin saber por qué; “situación inicial”, “estado procesal”, “ruta” y “próxima acción” parecen versiones diferentes de lo mismo.

**Usuario de teclado/lector de pantalla:** los modales no se anuncian ni aíslan el fondo; Escape no cierra; el perfil móvil no tiene nombre accesible; faltan anuncios de éxito/error.

## Roadmap: causa y corrección

El roadmap actual fue diseñado para validar primero “cliente lee estado / oficina cambia estado”. Después aplaza hasta la Subfase 3 la bandeja, agenda, viabilidad, acreedores y búsqueda. Por eso la implementación se acerca al roadmap y, al mismo tiempo, no satisface el nuevo objetivo de una plataforma funcional para el despacho.

La secuencia debe cambiar de módulos horizontales a **cortes verticales completos**:

1. **Columna vertebral:** navegación, Mi trabajo, resumen de asunto, tareas y fuente única de actuaciones.
2. **Apertura real:** persona + asunto en evaluación + checklist + documentos + revisión.
3. **Preparación y radicación:** viabilidad mínima, acreedores/obligaciones, ingresos/gastos, escrito, evidencia de presentación y actualización controlada al cliente.
4. **Procedimiento:** admisión/corrección, agenda, múltiples audiencias, acuerdo/fracaso y liquidación.
5. **Confiabilidad de piloto:** permisos efectivos, auditoría, errores, versionado, privacidad y respaldo.
6. **Después:** finanzas completas, comunicaciones, IA, correo, Calendar, WhatsApp y PWA según prioridad validada.

## Minor Observations

- Al cargar, la vista pasa por “Clientes (0)” y “La base de datos está limpia” antes de mostrar cinco clientes.
- El botón `+` de Nuevo cliente exige inferencia y mide 38×38 px.
- En móvil hay dos carruseles horizontales y más de tres viewports de contenido.
- Textos pequeños fallan AA por poco: 4.49:1 y 4.32:1.
- No existe enrutamiento de frontend: toda la experiencia vive en un `App.tsx` de 793 líneas, sin URLs recuperables para trabajo profundo.
- El login y OTP prellenados son aceptables solo como condición explícita de desarrollo; deben salir de una interfaz de piloto con datos reales.
- “Aperturar expediente” debería ser “Abrir asunto”; “apertura” tiene además un significado procesal específico en liquidación.

## Questions to Consider

1. ¿Debe la acción principal llamarse **Nuevo asunto** y crear/seleccionar la persona dentro del flujo, dejando **Registrar persona** como acción secundaria del directorio?
2. Para el primer piloto, ¿la bandeja debe priorizar solo **audiencias + tareas + documentos faltantes**, o incluir también **términos y revisiones jurídicas** desde el inicio?
3. ¿La primera ruta funcional se limitará a negociación de pasivos de persona natural no comerciante, incluyendo sus ramas de corrección, acuerdo, fracaso y liquidación?
