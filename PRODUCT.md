# Product

## Register

product

## Users

Asuntia sirve a dos grupos principales:

- Clientes de una firma de abogados que necesitan consultar el estado de un asunto sin llamar ni pedir explicaciones adicionales.
- Abogados, auxiliares y socios de la firma que gestionan casos, hitos, solicitudes, documentos y avances internos o visibles al cliente.

El cliente llega con un codigo, radicado, documento u otro dato asociado al caso. Su trabajo principal es entender que esta pasando, que sigue y que documentos puede consultar o enviar. La firma entra por un acceso separado para organizar el trabajo por casos, responsables, vencimientos y necesidades del cliente.

## Product Purpose

Asuntia existe para dar seguimiento claro y seguro a asuntos legales. El MVP valida el flujo central: una persona consulta su caso con un codigo, ve hitos, estado actual, solicitudes y documentos publicados; la firma crea y actualiza casos sin exponer informacion interna.

El producto es exitoso cuando:

- El cliente entiende el estado del asunto en segundos.
- La firma puede publicar avances y pedir informacion sin duplicar trabajo.
- Los documentos y avances internos permanecen separados de lo visible para clientes.
- La estructura local del MVP puede migrar a Supabase, Auth, Storage y Row Level Security sin rehacer el modelo mental.

## Brand Personality

Sobria, confiable y clara.

La interfaz debe sentirse profesional, minimalista pero no vacia. Debe comunicar fidelidad, seguridad y control operativo, sin caer en solemnidad pesada ni decoracion legal generica.

## Anti-references

Evitar estos patrones:

- Sitios legales oscuros, densos o llenos de lenguaje institucional que no ayuda a completar la accion.
- Landing pages con gradientes decorativos, brillos, tarjetas repetidas y promesas vagas.
- Interfaces tipo CRUD donde todos los formularios compiten por atencion al mismo tiempo.
- Portales que mezclan conceptos de cliente y abogado en la misma pantalla.
- Falsos indicadores de seguridad, metricas inventadas o copys que suenan grandilocuentes.

## Design Principles

1. La consulta del cliente manda. Cada pantalla publica debe acelerar el flujo de consultar, entender y actuar.
2. Separacion antes que sorpresa. Cliente y firma deben tener rutas, lenguaje y permisos claramente separados.
3. Confianza por claridad. La seguridad se comunica con jerarquia, estados, visibilidad y trazabilidad, no con decoracion.
4. Trabajo primero. El espacio de firma debe evolucionar hacia bandejas, vencimientos y responsabilidades, no hacia formularios visibles sin orden.
5. Preparado para produccion. Cada decision de UI y datos debe poder conectarse luego a autenticacion, base de datos, storage, auditoria y permisos reales.

## Accessibility & Inclusion

Asuntia debe apuntar como minimo a WCAG AA:

- Contraste legible en texto, botones, formularios y estados.
- Navegacion usable con teclado y foco visible.
- Mensajes de error y estados vacios claros.
- Movimiento discreto, con respeto por `prefers-reduced-motion`.
- Lenguaje directo para usuarios no tecnicos y clientes bajo estres.
