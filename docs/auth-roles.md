# Roles Y Usuarios De Prueba

## Objetivo

Asuntia trabaja localmente con PGlite y una sesion demo en `sessionStorage`, pero el modelo queda preparado para Supabase Auth.

La regla de producto es separar:

- Usuarios internos de firma.
- Usuarios cliente.
- Permisos de lectura y escritura dentro del workspace.

## Roles

| Rol | Uso | Permisos MVP |
| --- | --- | --- |
| `owner` | Socia o responsable principal | Workspace completo, casos, clientes, usuarios |
| `admin` | Administracion de firma | Workspace completo, casos, clientes, usuarios |
| `lawyer` | Abogada responsable | Crear y gestionar casos, hitos, solicitudes, avances y documentos |
| `assistant` | Apoyo operativo | Lectura del workspace sin escritura |
| `client` | Cliente externo | Portal cliente, no workspace de firma |

La matriz vive en `src/lib/auth.ts` y las pruebas en `tests/unit/auth.test.ts`.

## Usuarios Locales

Todos usan la clave `AsuntiaDemo2026!`.

| Rol | Correo |
| --- | --- |
| `owner` | `socia@asuntia.local` |
| `admin` | `admin@asuntia.local` |
| `lawyer` | `daniela@asuntia.local` |
| `assistant` | `asistente@asuntia.local` |
| `client` | `laura@constructoranorte.co` |

El login local de `/firma/login` valida estos usuarios contra el catalogo demo. El usuario cliente no puede entrar al workspace interno.

## Supabase

Las migraciones crean y endurecen `public.profiles`:

- `profiles.role` acepta `owner`, `admin`, `lawyer`, `assistant` o `client`.
- `profiles.status` acepta `active` o `inactive`.
- `profiles.client_id` vincula opcionalmente un perfil cliente con `clients.id`.
- `profiles_firm_email_idx` evita correos duplicados dentro de una firma.

Para crear usuarios reales de Auth y sincronizar `public.profiles`:

```powershell
$env:SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run seed:supabase-users
```

El script usa `supabase.auth.admin.createUser`/`updateUserById`, por eso requiere service role y solo debe correr en entorno local o servidor seguro. No se debe exponer `SUPABASE_SERVICE_ROLE_KEY` al navegador.

## Siguiente Paso

Cuando conectemos Supabase en runtime:

- Reemplazar la sesion demo por `supabase.auth.getUser()`.
- Resolver el perfil actual desde `public.profiles`.
- Mover las reglas de escritura a Server Actions/API con verificacion de rol.
- Agregar RLS por `firm_id`, `client_id`, `visibility` y `auth.uid()`.
