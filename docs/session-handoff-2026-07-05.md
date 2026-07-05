# Handoff De Sesion - 2026-07-05

## Estado Actual

El proyecto ya tiene tres superficies separadas:

- `/`: entrada principal publica.
- `/cliente`: seguimiento de un asunto por codigo/radicado.
- `/firma`: espacio interno de gestion de la firma.
- `/firma/login`: acceso simulado para abogados.

La separacion tecnica ya esta avanzada: cliente y firma no dependen de una misma pagina con selector de modo. La pagina principal ahora es el punto de entrada y el portal cliente puede abrir un asunto usando `?codigo=AS-2026-001` o el valor guardado en `sessionStorage`.

La persistencia sigue siendo `localStorage`; no hay base de datos real todavia.

## Cambios Hechos En Esta Sesion

- Se reemplazo la redireccion de `/` hacia `/cliente` por una pagina principal con `PublicAccess`.
- Se agrego `src/components/public-access.tsx`.
- Se agrego `src/components/firm-login.tsx`.
- Se agrego la ruta `src/app/firma/login/page.tsx`.
- Se simplifico `AppHeader` para evitar navegacion cruzada entre cliente y firma.
- Se retiro el boton visible de reinicio/demo del header.
- Se ajusto `/cliente` para abrir casos desde query/session, no desde selector de modo.
- Se comenzo a limpiar copy innecesario como "Portal cliente", "Seguimiento privado" e instrucciones redundantes.
- Se agrego un control visual propio para inputs de archivo.
- Se actualizaron pruebas E2E para entrar por `/` con codigo y verificacion.
- Se actualizo documentacion del scope MVP para reflejar entrada principal, portal cliente y espacio firma.

## Ultima Direccion Del Usuario

La prioridad de producto quedo asi:

> La pantalla principal debe permitir rapidamente "Consultar asunto" o "Iniciar sesion" para mas funciones del abogado.

El usuario no quiere mensajes innecesarios como:

- "Seguimiento privado"
- "Portal cliente"
- "Inicia la consulta desde la entrada principal"
- textos institucionales decorativos que no ayuden a completar la accion

La interfaz debe sentirse directa, minimalista y funcional.

## Estado Exacto De UI Que Hay Que Continuar

### `/`

Debe quedar como una puerta de dos acciones:

- Accion principal: `Consultar asunto`
- Accion secundaria: `Iniciar sesion`

Estado actual aproximado:

- Ya existe formulario de consulta con codigo/radicado.
- Ya existe verificacion simple tipo suma.
- Ya existe boton/link `Iniciar sesion` hacia `/firma/login`.
- Falta pulir layout: el CSS de `access-layout` venia de una composicion de tres columnas y debe revisarse para la nueva composicion de dos acciones.
- Falta validar visualmente desktop y movil despues del ajuste final.

Recomendacion concreta:

- En desktop, formulario `Consultar asunto` debe ser dominante.
- `Iniciar sesion` debe estar visible pero secundario, como boton/panel compacto.
- En movil, el campo de codigo, verificacion y boton deben caber lo mas arriba posible.

### `/cliente`

Objetivo:

- El cliente debe entender en segundos que pasa y que debe hacer.

Estado actual:

- Abre asunto por codigo desde URL/session.
- Muestra tracking vertical por hitos.
- Hitos completados son opacos y desplegables.
- Hito actual muestra explicacion y carga de evidencia si esta habilitada.
- Header ya no debe mostrar reset de demo.

Falta:

- Si alguien entra a `/cliente` sin codigo valido, redirigir a `/` o mostrar el mismo formulario compacto. No mostrar una pantalla intermedia con frases explicativas.
- Agregar una tarjeta superior de accion del cliente cuando el caso requiere informacion:
  - estado actual
  - que documento/informacion se necesita
  - fecha limite
  - boton de carga
- La carga de evidencia no deberia registrarse solo por seleccionar archivo. Debe haber confirmacion explicita:
  - seleccionar archivo
  - mostrar nombre
  - boton `Enviar documento`
  - estado `Recibido por la firma`
- Reducir texto en el hito actual. Ejemplo: cambiar "La firma habilito carga para esta etapa" por "Sube el certificado solicitado".
- Header cliente ideal: `Asuntia`, codigo/radicado y `Cerrar consulta`.

### `/firma/login`

Objetivo:

- Entrada de abogados separada del portal cliente.

Estado actual:

- Existe formulario simulado con correo y clave.
- Guarda `asuntia.firmSession` en `sessionStorage`.
- Redirige a `/firma`.

Falta:

- Visualmente debe ser sobrio y simple.
- En el futuro se reemplaza por Supabase Auth.
- No debe mezclar conceptos de cliente.

### `/firma`

Objetivo:

- Gestion interna por persona/abogado, no solo por cliente.

Estado actual:

- Permite crear clientes.
- Permite crear casos.
- Permite cambiar estado, prioridad y proximo paso.
- Permite publicar avances visibles o internos.
- Permite crear solicitudes.
- Permite registrar documentos.
- Muestra timeline, solicitudes y documentos.

Falta importante:

- Cambiar la entrada mental de "cliente primero" a "trabajo primero".
- Crear una bandeja de trabajo:
  - `Mis casos`
  - `Requieren cliente`
  - `Vencen pronto`
  - `Por revisar`
  - `Todos`
- Reducir densidad de formularios visibles.
- Convertir detalle de caso a tabs:
  - `Resumen`
  - `Hitos`
  - `Solicitudes`
  - `Documentos`
  - `Avances`
  - `Historial interno`
- Agregar gestion de hitos desde firma:
  - crear hito
  - editar hito
  - marcar actual
  - marcar completado
  - habilitar evidencia
  - definir texto visible para cliente
- Pensar roles:
  - abogado: estrategia, avances, hitos
  - auxiliar: documentos, solicitudes, seguimiento
  - socio: riesgos, vencimientos, carga de trabajo

## Huecos Tecnicos Pendientes

- No hay autenticacion real.
- No hay autorizacion real por firma/cliente.
- No hay base de datos remota.
- No hay storage real de documentos.
- El captcha/verificacion es solo MVP en cliente; produccion debe usar Turnstile/hCaptcha con verificacion de servidor.
- No hay RLS de Supabase.
- No hay modelo multi-tenant real.
- No hay auditoria inmutable.
- Los documentos se registran por nombre, no se suben realmente.

## Orden Recomendado Para La Proxima Sesion

1. Revisar visualmente estado actual en `/`, `/cliente?codigo=AS-2026-001`, `/firma/login` y `/firma`.
2. Terminar `/` como pantalla rapida de dos acciones:
   - `Consultar asunto`
   - `Iniciar sesion`
3. Ajustar CSS de `access-layout` para dos acciones y movil.
4. Hacer que `/cliente` sin codigo redirija a `/`.
5. Crear tarjeta superior de accion en `/cliente`.
6. Cambiar carga de evidencia a seleccion + confirmacion.
7. Despues redisenar `/firma` hacia bandeja de trabajo.
8. Luego agregar editor de hitos en firma.

## Comandos De Verificacion

Ejecutar despues de retomar cambios:

```bash
npm run typecheck
npm run lint
npm run test:e2e
npm run build
```

## Datos Demo Utiles

- Codigo principal: `AS-2026-001`
- Otro codigo: `AS-2026-003`
- Caso principal: `Licitacion municipal 2026`
- Cliente principal: `Constructora Norte S.A.S.`

## Nota Para La Siguiente Sesion

No empezar por Supabase todavia. Primero cerrar la experiencia:

- home rapida
- cliente entendible
- firma menos CRUD y mas bandeja de trabajo

Cuando esos flujos esten claros, conectar Supabase sera mucho mas directo y con menos riesgo de rehacer estructura.
