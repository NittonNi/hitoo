import { NextResponse, type NextRequest } from "next/server"

import { createClient, createClientSinTocarSesion } from "@/lib/supabase/server"
import { cifrar } from "@/lib/cifrado"
import { rutaSegura } from "@/lib/rutas"

/**
 * Vuelta del acceso con Google. Supabase manda aquí un `code` de un solo uso
 * que hay que canjear por la sesion; a partir de ahi es una sesion normal.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = rutaSegura(searchParams.get("next"))

  // Google puede volver con un "no" (permiso denegado, cuenta equivocada...)
  // y, al enlazar (ver linkIdentity en ajustes-calendario-google.tsx), Supabase
  // con un fallo propio -esa cuenta de Google ya es de otro usuario, enlazado
  // manual apagado-. error_code trae el motivo exacto y siempre es el mismo
  // texto pase lo que pase con el idioma, así que es lo primero que se mira
  // -error_description es una frase pensada para logs, no para traducir-.
  const fallo =
    searchParams.get("error_code") ??
    searchParams.get("error_description") ??
    searchParams.get("error")
  if (fallo) {
    /* Con la sesion abierta -conectar el calendario desde dentro- no se puede
       volver a /acceso: el proxy manda al panel a quien ya ha entrado y el
       aviso se pierde por el camino. Se vuelve a donde se estaba, que lo
       cuenta (?error_google=). Sin sesion, a /acceso, como siempre. */
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const url = new URL(user ? next : "/acceso", origin)
    url.searchParams.set(user ? "error_google" : "error", fallo)
    const reenviado = request.headers.get("x-forwarded-host")
    if (user && process.env.NODE_ENV === "production" && reenviado) url.host = reenviado
    return NextResponse.redirect(url)
  }

  if (code) {
    /* Conectar el calendario manda `esperado`: el id de quien pulso. Con el,
       el canje se hace con un cliente que lee cookies pero no las escribe,
       asi se sabe de quien es la cuenta de Google **antes** de tocar la
       sesion del navegador. Si en el selector de Google se elige otra cuenta
       -de otro usuario de hitoo, o de nadie-, aqui no se guarda nada y quien
       estaba dentro sigue dentro. Sin `esperado` (el acceso normal) va todo
       como siempre. */
    const esperado = searchParams.get("esperado")
    const supabase = esperado ? await createClientSinTocarSesion() : await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (esperado && data.user?.id !== esperado) {
        const url = new URL(next, origin)
        url.searchParams.set("error_google", "otra_cuenta_google")
        const reenviado = request.headers.get("x-forwarded-host")
        if (process.env.NODE_ENV === "production" && reenviado) url.host = reenviado
        return NextResponse.redirect(url)
      }

      // Es quien decia ser: ahora si, la sesion se guarda en las cookies
      const conCookies = esperado ? await createClient() : supabase
      if (esperado && data.session) {
        await conCookies.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
      /* Si esta vuelta tambien pedia el calendario (ver boton-conectar-
         calendario.tsx), Google solo manda refresh_token la primera vez que
         se consiente el permiso -o cuando se fuerza con prompt=consent-. Se
         guarda aqui, en el servidor: nunca llega al navegador. */
      const refreshToken = data.session?.provider_refresh_token
      if (refreshToken && data.user) {
        try {
          await conCookies
            .from("google_connections")
            .upsert({ user_id: data.user.id, refresh_token: cifrar(refreshToken) })
        } catch (e) {
          /* Sin clave de cifrado no se guarda nada: preferimos que el
             calendario salga como no conectado -y se pueda reintentar- antes
             que dejar el token en claro en la base. El acceso en si ya esta
             hecho, asi que la vuelta sigue igual. */
          console.error("No se ha podido guardar la conexion con Google:", e)
        }
      }

      // Detras de un proxy (Vercel) el host real viene en la cabecera
      const reenviado = request.headers.get("x-forwarded-host")
      const enProduccion = process.env.NODE_ENV === "production"
      const destino = new URL(next, origin)
      if (enProduccion && reenviado) destino.host = reenviado
      return NextResponse.redirect(destino)
    }
  }

  const url = new URL("/acceso", origin)
  url.searchParams.set("error", "No se ha podido completar el acceso con Google.")
  return NextResponse.redirect(url)
}
