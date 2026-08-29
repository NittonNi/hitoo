import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
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
  const fallo = searchParams.get("error_description") ?? searchParams.get("error")
  if (fallo) {
    const url = new URL("/acceso", origin)
    url.searchParams.set("error", fallo)
    return NextResponse.redirect(url)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      /* Si esta vuelta tambien pedia el calendario (ver boton-conectar-
         calendario.tsx), Google solo manda refresh_token la primera vez que
         se consiente el permiso -o cuando se fuerza con prompt=consent-. Se
         guarda aqui, en el servidor: nunca llega al navegador. */
      const refreshToken = data.session?.provider_refresh_token
      if (refreshToken && data.user) {
        try {
          await supabase
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
