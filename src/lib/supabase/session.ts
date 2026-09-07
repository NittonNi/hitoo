import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"
import { RUTA_APP } from "@/lib/rutas"

/** Rutas accesibles sin sesion: la raiz es la landing pública. */
// El webhook de Stripe entra aqui porque llega sin sesion y sin cookies: si
// el proxy lo manda a /acceso, Stripe recibe un 307 y da el aviso por
// fallido. Su seguridad es la firma del cuerpo, no la sesion.
//
// Va la ruta exacta y no `/api` a secas: el emparejado es por prefijo, asi
// que `/api` dejaria publica cualquier ruta que se cuelgue de ahi en el
// futuro, sin que nadie se entere al escribirla.
const PUBLIC_PATHS = [
  "/",
  "/acceso",
  "/auth",
  "/privacidad",
  "/condiciones",
  "/aviso-legal",
  "/api/stripe/webhook",
]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Importante: no meter logica entre createServerClient y getUser().
  // getUser() revalida el token contra Supabase y refresca la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  )

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/acceso"
    url.searchParams.set("volver", path)
    return NextResponse.redirect(url)
  }

  // La portada si se puede ver con la sesion abierta: ensena el producto y
  // lleva al espacio. El formulario de acceso, en cambio, ya no pinta nada.
  if (user && path === "/acceso") {
    const url = request.nextUrl.clone()
    url.pathname = RUTA_APP
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
