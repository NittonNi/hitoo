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

- **El login con Google va por `signInWithOAuth` de Supabase.** Conectar el calendario también, y por eso quien entró con correo y contraseña **acaba siendo otro usuario**. Arreglo pendiente: `linkIdentity()` cuando ya hay sesión.
- **Pedir scopes nuevos o tocar la pantalla de consentimiento obliga a pasar otra vez la verificación de Google.** No se hace sin hablarlo antes.
- **El `refresh_token` va cifrado** con AES-256-GCM (`cifrado.ts`, `TOKEN_ENCRYPTION_KEY`) y solo se lee en el servidor. Cambiar la clave deja sin descifrar las conexiones ya guardadas.
- **Desconectar** revoca el permiso en Google (`oauth2.googleapis.com/revoke`) antes de borrar la fila (`desconectarGoogle`).
- `eventosDeGoogle` recibe el `userId` ya resuelto: no volver a llamar ahí dentro a `auth.getUser()`.
- `getSesion`, `getPerfil`, `getPertenencias` y `cargarCatalogo` van envueltas en `cache()` de React y comparten resultado dentro de un mismo request.
- **Cada dominio nuevo** necesita su Redirect URL con `**` en Supabase, porque el `?next=` entra en la comparación. Sin ella no hay error: se vuelve en silencio al Site URL.
- El alta no revela si un correo ya tiene cuenta (mensaje neutro en `errores.ts`). `?volver=` y `?next=` solo aceptan rutas propias.
- La cookie `espacio` (el espacio activo) vive en `sesion.ts`; la de «llévame directo», en `cookies.ts`.
