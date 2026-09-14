---
paths:
  - "src/lib/google.ts"
  - "src/lib/cifrado.ts"
  - "src/lib/sesion.ts"
  - "src/lib/supabase/**"
  - "src/components/ajustes-calendario-google.tsx"
  - "src/components/boton-google.tsx"
  - "src/app/auth/**"
  - "src/app/acceso/**"
  - "src/app/**/calendario/acciones.ts"
---

# Google, sesión y acceso

- **El login con Google va por `signInWithOAuth` de Supabase.** Conectar el calendario, si la cuenta con sesión abierta no tiene ya una identidad de Google, va por `linkIdentity()` con las mismas `scopes`/`redirectTo`/`queryParams` (`ajustes-calendario-google.tsx`): si no, Supabase abriría sesión como el usuario dueño de esa cuenta de Google, que puede no ser quien pulsó «Conectar». Si la cuenta ya entró alguna vez con Google (`user.identities` ya trae `provider: "google"`), se sigue usando `signInWithOAuth`, que resuelve al mismo usuario. `identity_already_exists` (esa cuenta de Google ya es de otro usuario de hitoo) y `manual_linking_disabled` (el enlazado manual está apagado en Supabase) llegan por `error_code` en la URL de vuelta o como `error.code` directo, y están traducidos en `errores.ts`. **Con la sesión abierta, un fallo no vuelve a `/acceso`**: el proxy manda al panel a quien ya ha entrado y el aviso se perdería. `auth/callback` vuelve a `next` con `?error_google=`, y `/calendario` abre el diálogo de Google con el mensaje.
- **Conectar nunca puede cambiarte de usuario** (11-sep-2026). El `redirectTo` lleva `esperado=<user.id>`, y con él `auth/callback` canjea el `code` con `createClientSinTocarSesion()` -lee cookies, no las escribe-: si el usuario que sale no es el esperado, no se guarda nada, la sesión de quien estaba dentro sigue intacta y se vuelve con `?error_google=otra_cuenta_google`. Solo si coincide se guarda la sesión (`setSession`) y la conexión de Google. Además, si ya hay identidad de Google, su correo va como `login_hint` para que Google la preseleccione. Sin `esperado` (el acceso normal desde `/acceso`) el callback hace lo de siempre.
- **Pedir scopes nuevos o tocar la pantalla de consentimiento obliga a pasar otra vez la verificación de Google.** No se hace sin hablarlo antes.
- **El `refresh_token` va cifrado** con AES-256-GCM (`cifrado.ts`, `TOKEN_ENCRYPTION_KEY`) y solo se lee en el servidor. Cambiar la clave deja sin descifrar las conexiones ya guardadas.
- **Desconectar** revoca el permiso en Google (`oauth2.googleapis.com/revoke`) antes de borrar la fila (`desconectarGoogle`).
- `eventosDeGoogle` recibe el `userId` ya resuelto: no volver a llamar ahí dentro a `auth.getUser()`.
- `getSesion`, `getPerfil`, `getPertenencias` y `cargarCatalogo` van envueltas en `cache()` de React y comparten resultado dentro de un mismo request.
- **Cada dominio nuevo** necesita su Redirect URL con `**` en Supabase, porque el `?next=` entra en la comparación. Sin ella no hay error: se vuelve en silencio al Site URL.
- El alta no revela si un correo ya tiene cuenta (mensaje neutro en `errores.ts`). `?volver=` y `?next=` solo aceptan rutas propias.
- La cookie `espacio` (el espacio activo) vive en `sesion.ts`; la de «llévame directo», en `cookies.ts`.
