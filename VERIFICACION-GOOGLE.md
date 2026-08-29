# Verificación de Google: la ronda de respuesta

Google contestó a la solicitud (proyecto `hitoo-506113`, número 917208882470)
el 23-ago-2026, en el correo **"[Action Needed] OAuth Verification Request
Acknowledgement"** que está en `hitooclock@gmail.com`. Pedían cuatro cosas.

Este fichero es el guion de esa respuesta. El estado general de la
verificación, con los pasos previos, sigue en `ROADMAP.md`.

> **Este repositorio es público.** La contraseña de la cuenta de prueba y la
> clave de cifrado no se escriben aquí: van directamente en el correo a Google
> y en el panel de Vercel.

## Lo que falta, en orden

1. **Pegar `TOKEN_ENCRYPTION_KEY` en Vercel.** El valor está en `.env.local`
   (`tail -1 ~/nitton-horas/.env.local`). Va en
   [vercel.com/nittonnis-projects/hitoo/settings/environment-variables](https://vercel.com/nittonnis-projects/hitoo/settings/environment-variables),
   marcando **Production** y **Preview**, y luego hay que **volver a
   desplegar**: Vercel no aplica variables nuevas a un despliegue ya hecho.

   **Esto va primero, antes de grabar nada.** Sin la clave, conectar un
   calendario en producción no guarda la conexión: se registra el error y la
   app dice que no estás conectado. Es decir, el vídeo saldría mal y la
   revisión se toparía con lo mismo.

2. **Grabar el vídeo** (guion completo más abajo).

3. **Reenviar la ficha desde Cloud Console** —
   [console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent),
   proyecto `hitoo`. Los dos puntos de la política de privacidad se envían por
   ahí; no basta con responder al correo.

4. **Responder al correo** con el texto de más abajo, rellenando el enlace del
   vídeo y la contraseña.

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
- **Cuenta y espacio de prueba**, creados el 29-ago-2026:
  - Cuenta: `hitooclock+google@gmail.com`, correo ya confirmado (sin
    verificación por teléfono ni ningún otro freno). Comprobado que entra.
  - Espacio **"Equipo de demostración"**, con 4 ramas en dos niveles, 5
    proyectos y 36 horas apuntadas de las tres últimas semanas, para que la
    revisión no vea la app vacía.
  - Enlace de invitación con tres plazas libres:
    **`https://www.hitoo.es/unirse/4thp5yhrn2`**
    (plazas "Google reviewer 1", "2" y "3").

## Ojo con el camino que se les indica

Conectar el calendario **no es un permiso que se añada a la sesión que ya
tienes**: `ajustes-calendario-google.tsx` llama a `signInWithOAuth`, o sea, es
otra entrada con Google pidiendo además el permiso de calendario. Para quien
entró con Google desde el principio -que es como entra todo el mundo en la
práctica- da igual: sale el mismo usuario. Pero para una cuenta de correo y
contraseña, conectar el calendario **te deja dentro como el usuario de Google
que elijas**, no como la cuenta con la que entraste.

Por eso las instrucciones que se le mandan a Google llevan a entrar **con
Google desde el primer paso** y unirse al espacio con el enlace de invitación.
La cuenta de correo y contraseña se les da igualmente -la pidieron- pero como
lo que es: una forma de ver la app con datos dentro.

Está apuntado en el ROADMAP como cosa a arreglar (`linkIdentity` en vez de
`signInWithOAuth`), pero no es para esta ronda.

## Guion del vídeo

Dura entre minuto y medio y dos minutos. No hace falta narración: Google mira,
no escucha.

### Antes de darle a grabar

- [ ] `TOKEN_ENCRYPTION_KEY` puesta en Vercel **y redesplegado**. Si no, el
      plano 7 no funciona.
- [ ] Una cuenta de Google con **al menos una reunión de esta semana,
      aceptada y con hora de inicio y fin**. hitoo descarta a propósito los
      eventos de todo el día y los que no has aceptado, así que sin eso el
      calendario sale vacío después de conectar y el vídeo no demuestra nada.
      Vale crear la reunión a mano un rato antes.
- [ ] Sesión de hitoo cerrada, para poder grabar la entrada desde cero.
- [ ] Navegador limpio: sin pestañas ni marcadores personales a la vista, zoom
      al 100%, ventana grande. Esto lo va a ver un desconocido.
- [ ] No hace falta revocar nada en `myaccount.google.com/permissions`: el
      código pide `prompt=consent`, así que la pantalla de permisos sale
      siempre aunque ya lo hubieras dado antes.

Grabar con `Win + G` (Xbox Game Bar) → el vídeo queda en `Vídeos\Captures`.
Subirlo a YouTube como **"Oculto" / "No listado"** y pegar ese enlace en el
correo.

### Los planos, en orden

| # | Qué se ve | Cuánto | Por qué está |
|---|-----------|--------|--------------|
| 1 | `www.hitoo.es`, la portada quieta | 5 s | Que el revisor ate el nombre "hitoo" con la web y con la ficha de OAuth. Era uno de los avisos automáticos. |
| 2 | `/acceso` → **Continuar con Google** → elegir la cuenta | 10 s | La entrada normal. Aquí **no** se pide el calendario: eso se ve en el plano 6, y es el argumento de que el permiso es opcional. |
| 3 | `https://www.hitoo.es/unirse/4thp5yhrn2` → elegir "Google reviewer 1" → entrar | 10 s | El mismo camino que van a seguir ellos. |
| 4 | El **Panel** con horas dentro | 5 s | Que se vea una app de verdad, no una demo vacía. |
| 5 | Barra lateral → **Calendario** | 5 s | |
| 6 | Botón **Conectar Google Calendar** → **Conectar con Google Calendar** | 5 s | |
| 7 | **La pantalla de consentimiento de Google** | 15-20 s | **El plano que rechazaron.** Ver abajo. |
| 8 | Volver a hitoo, se lee **"Conectado"** | 5 s | |
| 9 | El calendario con la reunión de Google, borde a rayas | 8 s | El uso real del permiso: leer y enseñar. |
| 10 | Clic en la reunión → aceptarla → se convierte en hora fichada | 15 s | El único uso del permiso, de principio a fin. |
| 11 | Mismo botón → **Desconectar** → vuelve a "Conectar Google Calendar" | 10 s | Que se pueda revocar, grabado. |

### El plano 7, con detalle

Es por el que te lo devolvieron. Textual del correo: *"The OAuth consent flow
and permission screen must be displayed with all requested scopes fully
expanded and readable—if the scopes are obscured, click 'Show all services'."*

1. Que se lea el **nombre de la app** ("hitoo") y se vea el **logo**.
2. Si Google resume los permisos en una línea del tipo *"hitoo quiere acceder a
   tu cuenta de Google"*, hay que **pulsar "Mostrar todos los servicios" /
   "Show all services"** para que se despliegue el permiso completo.
3. Dejar el texto del permiso -*"Ver eventos de todos tus calendarios"* /
   *"See the events on all your calendars"*- **quieto en pantalla 3 o 4
   segundos**, sin mover el ratón por encima ni hacer scroll.
4. Solo entonces, aceptar.

Si dudas, alarga este plano. Es preferible un vídeo lento a una tercera vuelta.

### Lo que hunde el vídeo

- La pantalla de permisos colapsada, o pasando tan rápido que no se lee.
- Cortar antes del plano 10: sin el uso real del permiso, no hay nada que
  aprobar.
- Empezar con la sesión ya iniciada: no se ve de dónde sale el consentimiento.
- Conectar y que el calendario salga vacío porque no había ninguna reunión
  aceptada esa semana.
- Que se cuele en pantalla otra cuenta, otro proyecto o correo personal.

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
the requested scope (.../auth/calendar.readonly) fully expanded and readable,
followed by the actual use we make of it inside the app.

2) Test access

hitoo signs users in with Google, and the calendar permission is granted per
Google account, so the smoothest way to test the integration is with your own
test Google account. We have prepared a demo workspace with sample data for
you to join:

Sign-in page:    https://www.hitoo.es/acceso
Invitation link: https://www.hitoo.es/unirse/4thp5yhrn2
                 (three free seats: "Google reviewer 1", "2" and "3")

If you also want an account of ours, this one is a member of the same demo
workspace and can be used with the email and password fields:

Email:    hitooclock+google@gmail.com
Password: <CONTRASENA>

It has no phone verification, no payment details and no other authentication
blocker. Please use the Google sign-in path described below when testing the
calendar permission itself, since the connection is bound to the Google
account you choose on the consent screen.

3) Step-by-step navigation instructions

The interface is in Spanish; the English translation is in brackets.

1. Open https://www.hitoo.es/acceso and click "Continuar con Google"
   [Continue with Google], using your own test Google account. This is a plain
   sign-in: it does NOT request the calendar scope. That is intentional —
   users who never use the calendar are never asked for that permission.
2. Open https://www.hitoo.es/unirse/4thp5yhrn2 , pick one of the free seats
   ("Google reviewer 1", "2" or "3") and confirm. You are now a member of the
   demo workspace "Equipo de demostración" [Demo team], which already contains
   projects and logged hours.
3. In the left sidebar, click "Calendario" [Calendar].
4. At the top right of that page, click "Conectar Google Calendar" [Connect
   Google Calendar]. A dialog opens; click "Conectar con Google Calendar"
   [Connect with Google Calendar].
5. Google's consent screen appears and requests
   https://www.googleapis.com/auth/calendar.readonly . Please use the same
   Google account as in step 1, and make sure it has at least one accepted
   meeting in the current week.
6. You are returned to hitoo and the dialog now shows "Conectado" [Connected].
7. Your accepted Google Calendar meetings for the current week now appear in
   the calendar grid with a dashed border. hitoo only displays events that
   have a start and end time and that the user has accepted; all-day events
   and declined invitations are filtered out.
8. Click one of them and confirm it to turn it into a tracked time entry.
   This is the only use we make of the scope: we read the event list (title,
   start/end time, attendee response) to display it, and let the user log it
   as worked time with one click instead of typing it twice. hitoo never
   creates, edits or deletes any calendar event.
9. To revoke, open the same button again and click "Desconectar"
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
