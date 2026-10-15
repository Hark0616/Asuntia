# Almacenamiento local y OneDrive personal

Estado del 2026-10-15: integración implementada con pruebas controladas. Falta
configurar la aplicación de Microsoft, autorizar la cuenta real y aceptar el
recorrido desplegado. Google Drive continúa como extensión posterior; el código
legado no equivale a un proveedor aceptado con estas garantías.

## Configuración del servidor

**Prerrequisito de Asuntia:** disponer de un directorio (tenant) propio de Microsoft
Entra y de una identidad con permiso para registrar aplicaciones. Una cuenta
personal de OneDrive, por sí sola, no proporciona ese acceso administrativo.
Microsoft explica cómo [usar o crear el directorio de desarrollo](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant).

El registro pertenece al operador de Asuntia y se configura una vez por entorno.
Cada firma solo autoriza su OneDrive personal desde Asuntia; no tiene que entrar
al portal administrativo ni crear un directorio para conectar sus archivos.

Si el portal muestra «Selected user account does not exist in tenant 'Microsoft
Services'», comprobar en Azure **Cuenta → Switch directory** si existe un directorio
propio accesible. Ese mensaje no prueba que la contraseña sea incorrecta ni que
OneDrive personal sea incompatible. Si no hay un directorio accesible, completar
primero el alta de Azure/Entra del operador o usar otro directorio autorizado.
Un alta que solicite términos, tarjeta o datos de facturación debe completarla
el titular; no crear recursos facturables para resolver este paso.

1. Registrar una aplicación para **cuentas Microsoft personales** en Microsoft
   Entra. Usar plataforma **Web**: el backend intercambia el código y conserva
   el secreto. No registrar este callback como SPA ni habilitar flujo implícito.
2. Añadir permisos **delegados** de Microsoft Graph `Files.ReadWrite` y
   `offline_access`. La autorización es del titular de la cuenta, mediante
   `consumers`; no se solicita acceso de aplicación sin usuario.
3. Registrar exactamente el callback del servidor:
   `http://127.0.0.1:8000/api/v1/storage/onedrive/callback` en desarrollo,
   o `https://api.SU-DOMINIO/api/v1/storage/onedrive/callback` en producción.
   Para HTTP con `127.0.0.1`, Microsoft indica configurar `replyUrlsWithType`
   desde el manifiesto; el cuadro habitual del portal puede rechazarlo.
   Mantener el mismo host local al ingresar a Asuntia y al recibir el callback,
   porque este necesita la cookie de la sesión administrativa.
4. Crear el secreto de cliente y configurar **solo en el servidor**, fuera de Git:

   ```dotenv
   MICROSOFT_CLIENT_ID=<id de aplicación>
   MICROSOFT_CLIENT_SECRET=<valor del secreto, no su identificador>
   MICROSOFT_OAUTH_REDIRECT_URI=<callback registrado>
   STORAGE_TOKEN_ENCRYPTION_KEY=<clave Fernet persistente>
   REDIS_URL=redis://127.0.0.1:6379/0
   ```

   La plantilla completa está en `.env.example`. API y worker deben compartir
   base de datos, clave de cifrado y raíz privada de archivos. Conservar la clave
   con los respaldos: cambiarla impide descifrar conexiones existentes.
5. Instalar dependencias y aplicar `alembic upgrade head` antes de arrancar la API.
   La revisión `8a4f24321a7b` agrega conexiones, trabajos y metadatos sin reinterpretar
   referencias históricas. La reversión se bloquea si perdería datos nuevos.
6. Ejecutar Redis y `arq app.workers.storage.WorkerSettings` desde `backend`,
   además de la API y el frontend. Los Compose de desarrollo y producción incluyen
   Redis y `storage-worker`, con volumen compartido. Con Docker disponible:

   ```powershell
   docker compose up -d --build
   ```

   En una instalación nativa, iniciar Redis por el medio disponible y ejecutar
   el comando ARQ con el entorno virtual activo. No hacen falta archivos jurídicos
   dentro de la imagen; el volumen contiene originales locales y temporales privados.

En producción se requieren HTTPS, CORS con credenciales, dominio raíz compartido
y `COOKIE_DOMAIN` apropiado. Si existe otro proxy delante de Nginx, sus logs también
deben omitir el query del callback OAuth. El Nginx del repositorio y la API ya lo
omiten. No compartir secretos, códigos de autorización ni tokens por chat.

Microsoft documenta los [permisos delegados y cuentas personales](https://learn.microsoft.com/en-us/graph/permissions-reference#filesreadwrite)
y las [restricciones del callback](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).
`Files.ReadWrite` permite acceso a archivos de la cuenta; elegir una carpeta delimita
el uso dentro de Asuntia, no reduce el permiso de Microsoft a esa carpeta.

## Recorrido de la firma

1. Entrar como administrador en **Ajustes → Almacenamiento**. Debe aparecer el
   procesador disponible y la configuración Microsoft completa.
2. Pulsar **Conectar OneDrive**, autorizar la cuenta personal y elegir la carpeta
   de trabajo existente. Elegirla activa esa conexión para nuevas cargas.
3. En **Expediente → Documentos → Vincular desde OneDrive**, un administrador o
   auxiliar asigna la carpeta existente del expediente. La oficina puede navegar
   esa carpeta y vincular archivos sin copiarlos ni reorganizarlos.
4. El formulario habitual de carga usa el destino activo. Si el expediente carece
   de carpeta, una carga crea `Expediente_<UUID>` dentro de la raíz seleccionada.
   El nombre físico incluye el UUID de la operación para recuperar reintentos;
   el nombre original se conserva como metadato.
5. **Preparar documento** solicita una lectura al worker. El resultado permite
   descargar PDF/Office o ver imágenes/texto mediante una ruta privada de la API.
   Publicar al cliente sigue siendo una acción de abogado o administrador;
   los documentos se incorporan privados por defecto.

Cambiar el destino afecta a las nuevas cargas. Los documentos anteriores conservan
su conexión y unidad. Desconectar retira tokens y bloquea lecturas pendientes y
preparadas; no borra archivos ni activa local automáticamente. Reconectar la misma
unidad conserva su identidad; otra cuenta crea otra conexión.

## Integridad y recuperación

- Cada comando tiene UUID y huella de solicitud. Repetir la misma carga recupera
  el resultado; reutilizar el UUID con otro contenido responde 409.
- PostgreSQL conserva el trabajo antes de enviarlo a Redis. El dispatcher recupera
  pendientes y leases vencidas; Redis solo recibe identificadores. Hay hasta tres
  intentos automáticos para fallos recuperables, con espera, y reintento explícito
  de cargas fallidas. La validez normal es 20 minutos; OAuth tiene 10 minutos.
- La API y el worker revalidan firma, sesión, rol, asunto, conexión y publicación.
  La URL temporal de Microsoft nunca se entrega al navegador. Los temporales
  privados vencidos de trabajos conocidos se retiran sin borrar originales cloud.
- Un archivo ausente o rechazado no produce un documento disponible. Cambios
  externos se detectan al preparar una lectura. **Revisar cambios** acepta el
  contenido actual y lo vuelve privado; luego se publica con la acción habitual.
- No se ofrece sincronización completa, edición Office, versionado, migración
  automática de proveedores ni traslado del archivo histórico local.

## Aceptación pendiente antes del piloto

Verificar con un expediente y archivos de prueba: autorización y renovación reales,
selección de carpeta existente, navegación paginada, vinculación, carga, reintento,
lectura de oficina y cliente, cambio externo, revisión/republicación y desconexión.
Ejecutar el conjunto API/worker/Redis/proxy con su volumen persistente y comprobar
reinicio y recuperación. El desarrollo local de esta entrega no dispone de Docker
ni Redis nativo; CI incorpora Redis real para probar despacho y ejecución de ARQ.
Los intercambios Microsoft de las pruebas siguen siendo controlados.

D01–D04 conservan pendientes de aceptación: referencias locales históricas,
reconciliación de temporales que no alcanzaron a registrar un trabajo, vías Google
legadas y prueba del proxy desplegado. No se deben marcar cerrados por esta entrega.
