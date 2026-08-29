# Verificación de Google: la ronda de respuesta

Google contestó a la solicitud (proyecto `hitoo-506113`, número 917208882470)
el 23-ago-2026, en el correo **"[Action Needed] OAuth Verification Request
Acknowledgement"** que está en `hitooclock@gmail.com`. Pedían cuatro cosas. Dos
ya están hechas y desplegadas; las otras dos solo las puede hacer Nicolás.

Este fichero es el guion de esa respuesta. El estado general de la
verificación, con los pasos previos, sigue en `ROADMAP.md`.

> **Este repositorio es público.** No escribas aquí la contraseña de la cuenta
> de prueba ni la clave de cifrado: van directamente en el correo a Google y en
> el panel de Vercel.

## Lo que falta, en orden

1. **Pegar `TOKEN_ENCRYPTION_KEY` en Vercel.** El valor está generado y
   esperando en `.env.local` (última línea). Copiarlo tal cual en
   [vercel.com/nittonnis-projects/hitoo/settings/environment-variables](https://vercel.com/nittonnis-projects/hitoo/settings/environment-variables),
   marcando **Production** y **Preview**, y volver a desplegar para que la
   variable entre. Sin esto, conectar un calendario nuevo en producción no
   guarda la conexión, y la revisión de Google se encontraría justo con eso.

2. **Crear la cuenta de prueba.** En `https://www.hitoo.es/acceso`, con
   correo y contraseña (no con Google). Vale un alias del propio buzón, por
   ejemplo `hitooclock+demo@gmail.com`. Que la contraseña sea sencilla de
   teclear: la va a escribir alguien de Google a mano. Una vez creada, se le
   puede sembrar un espacio con proyectos y horas de mentira para que la
   revisión vea la app con contenido en vez de vacía.

3. **Grabar el vídeo** (guion abajo).

4. **Reenviar la ficha desde Cloud Console** —
   [console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent),
   proyecto `hitoo`. Es lo que Google pide para los dos puntos de la política
   de privacidad: no basta con responder al correo.

5. **Responder al correo** con el texto de más abajo, rellenando el enlace del
   vídeo y las credenciales.

## Lo que ya está hecho (23→29-ago-2026)

- **"Your privacy policy does not state with whom you share, transfer, or
  disclose Google user data"** → apartado **"Con quién se comparten"** en
  `/privacidad`, con los cuatro destinatarios reales: el resto del espacio de
  trabajo, Supabase, Vercel y Google. Incluye el que faltaba de verdad: al
  convertir un evento en hora fichada, su título pasa a ser la descripción de
  esa hora y la ve el equipo.
- **"Your privacy policy does not specify any data protection mechanisms for
  sensitive data"** → apartado **"Cómo se protegen"**, y el mecanismo que
  faltaba, que ahora existe de verdad: el `refresh_token` se guarda cifrado
  con AES-256-GCM (`src/lib/cifrado.ts`).

Las dos están en vivo en `https://www.hitoo.es/privacidad`.

## Guion del vídeo

Igual que el del ROADMAP, con el detalle que pide el correo: **los permisos
tienen que verse desplegados**.

1. Entrar en `https://www.hitoo.es/acceso` con la cuenta de prueba.
2. Barra lateral → **Calendario**.
3. Arriba a la derecha → **Conectar Google Calendar** → **Conectar con Google
   Calendar**.
4. **Que se vea entera la pantalla de consentimiento de Google**: el nombre de
   la app, el logo y el permiso. Si Google agrupa los permisos, pulsar
   **"Mostrar todos los servicios" / "Show all services"** y esperar a que se
   lea `.../auth/calendar.readonly` antes de aceptar. Esto es lo que rechazaron
   la primera vez.
5. Aceptar, volver a hitoo, enseñar el **"Conectado"**.
6. En el calendario, enseñar una reunión de Google con el borde a rayas y
   convertirla en una hora fichada.
7. Volver al mismo botón y pulsar **Desconectar**.

Grabar con `Win + G` (Xbox Game Bar) → el vídeo queda en `Vídeos\Captures`.
Subirlo a YouTube como **"Oculto" / "No listado"**.

## Texto de la respuesta al correo

Responder en el mismo hilo (`api-oauth-dev-verification-reply+...@google.com`),
en inglés, rellenando lo que está entre `<>`:

```
Hello,

Thank you for the review. Here is the information you requested for project
hitoo-506113 (project number 917208882470).

1) Demo video

<ENLACE DE YOUTUBE, NO LISTADO>

The video shows the complete OAuth flow. The consent screen is displayed with
the requested scope (.../auth/calendar.readonly) fully expanded and readable.

2) Test credentials

URL:      https://www.hitoo.es/acceso
Email:    <CORREO DE LA CUENTA DE PRUEBA>
Password: <CONTRASENA>

This is a regular member account in a demo workspace with sample data. It has
no phone verification, no payment details and no other authentication blocker.

3) Step-by-step navigation instructions

The interface is in Spanish; the English translation is in brackets.

1. Open https://www.hitoo.es/acceso and sign in with the credentials above
   using the email and password fields. Please do not use the "Continuar con
   Google" [Continue with Google] button: the calendar permission is requested
   separately, inside the app, in step 4.
2. You will land on "Panel" [Dashboard].
3. In the left sidebar, click "Calendario" [Calendar].
4. At the top right of that page, click the button "Conectar Google Calendar"
   [Connect Google Calendar]. A dialog opens; click "Conectar con Google
   Calendar" [Connect with Google Calendar].
5. Google's consent screen appears and requests
   https://www.googleapis.com/auth/calendar.readonly. Accept it with a Google
   account that has at least one accepted meeting in the current week.
6. You are returned to hitoo and the same dialog now shows "Conectado"
   [Connected].
7. The accepted Google Calendar events of the current week now appear in the
   calendar grid with a dashed border. Click one and confirm it to turn it
   into a tracked time entry. This is the only use we make of the scope: we
   read the event list to display it and let the user log it as worked time
   with one click, instead of typing it twice.
8. To revoke, open the same button again and click "Desconectar"
   [Disconnect]. hitoo calls https://oauth2.googleapis.com/revoke with the
   stored token and then deletes it from the database.

4) Privacy policy

https://www.hitoo.es/privacidad has been updated to address both points, and
the app has been resubmitted in the Cloud Console.

- "Con quién se comparten" [Who we share data with] now names every recipient
  of Google user data: the other members of the user's own workspace (when the
  user chooses to turn a calendar event into a tracked time entry, the event
  title becomes the description of that entry and is visible to their team),
  Supabase as our database processor (EU region), and Vercel as our hosting
  processor. It also states explicitly that Google user data is never sold,
  never shared with advertisers, analytics providers or data brokers, and
  never used to train AI models.
- "Cómo se protegen" [How data is protected] now lists the protection
  mechanisms: HTTPS/TLS in transit with HSTS; encryption at rest; the Google
  refresh token additionally encrypted by the application itself with
  AES-256-GCM, using a key that exists only in the server environment and
  never in the database or the browser; row-level security policies enforced
  in the database; the read-only scope as our least-privilege choice;
  revocation with Google plus deletion of the token on disconnect; and
  security headers in the browser.

The Limited Use statement remains in the "Acceso a Google Calendar" [Google
Calendar access] section of the same page.

Best regards,
Nicolas Martinez Riego
hitoo - hitooclock@gmail.com
```
