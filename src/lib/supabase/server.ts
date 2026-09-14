import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"

/**
 * Igual que `createClient`, pero **sin escribir cookies**: lee la sesion y el
 * verificador de PKCE, y lo que pase con ellos -canjear el `code` de una
 * vuelta de Google, por ejemplo- no toca la sesion del navegador. Sirve para
 * mirar de quien es esa vuelta antes de decidir si se guarda (`auth/callback`).
 */
export async function createClientSinTocarSesion() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    },
  )
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Los Server Components no pueden escribir cookies. El middleware
            // ya refresca la sesion, así que aquí se puede ignorar.
          }
        },
      },
    },
  )
}
