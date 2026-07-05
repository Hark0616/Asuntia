# Engineering Principles

Estas reglas guian los cambios de Asuntia. Aplican antes de mover codigo, crear funciones, editar funciones o modificar datos.

## Regla Principal

Antes de cambiar algo, analizar si ya existe una estructura, funcion, componente, tabla, tipo o flujo que resuelva lo mismo o algo similar.

El objetivo es evitar duplicidad y mantener coherencia en todo el producto.

## Checklist Antes De Editar

1. Buscar primero en el codigo existente.
2. Reutilizar componentes, tipos y helpers cuando tengan el mismo proposito.
3. Extender una abstraccion existente solo si mantiene claridad.
4. Crear una nueva funcion o componente solo si resuelve una responsabilidad nueva y concreta.
5. Evitar tablas o estructuras duplicadas para el mismo dato.
6. Mantener una sola fuente de verdad para cada dato importante.
7. Revisar que las relaciones de datos sigan conectadas.
8. Actualizar pruebas cuando cambie un flujo visible o una regla de negocio.
9. Verificar con `typecheck`, `lint`, `build` y pruebas e2e cuando aplique.

## Datos Y Tablas

Los datos deben estar conectados por relaciones claras:

- Una firma tiene clientes.
- Un cliente tiene casos.
- Un caso tiene hitos, avances, solicitudes y documentos.
- Un usuario pertenece a una firma y puede tener permisos sobre clientes o casos.

No se debe duplicar informacion entre tablas si se puede referenciar por ID.

Ejemplos:

- El nombre del cliente vive en `clients`, no copiado dentro de cada caso.
- El estado actual del caso vive en `cases`.
- Los eventos historicos viven en `case_updates` o `audit_events`.
- Los hitos del asunto viven en `case_milestones` y se conectan por `case_id`.
- Los documentos viven como metadata en `documents` y el archivo vive en storage.

## UX Y Producto

Cada cambio visual debe mantener el flujo principal claro:

> El cliente entra con un codigo, ve el tracking de su asunto, entiende el estado actual y consulta lo que se ha hecho.

Si una seccion ocupa mucho espacio sin acelerar ese flujo, debe simplificarse.

## Commits

Trabajar por hitos pequenos:

- Un commit por cambio funcional coherente.
- Un commit separado para documentacion importante.
- Un commit separado para infraestructura o tooling.
- Evitar mezclar refactors grandes con cambios visibles.
