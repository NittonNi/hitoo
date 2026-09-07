"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { COOKIE_ESPACIO } from "@/lib/sesion"
import { RUTA_APP, rutaSegura } from "@/lib/rutas"

/**
 * Deja este espacio como el activo, sin moverse de donde estas.
 *
 * El revalidatePath no sobra: el espacio activo vive en una cookie y no en la
 * URL, asi que para el router del navegador no ha cambiado nada y reutiliza lo
 * que ya tenia guardado. Y lo que tiene guardado incluye el layout de (app),
 * que es justo donde viven el nombre del espacio y la sesion que se reparte a
 * toda la app. Sin esta linea se cambia la cookie y la pantalla se queda
 * enseñando el espacio anterior.
 */
export async function activarEspacio(id: string) {
  const almacen = await cookies()
  almacen.set(COOKIE_ESPACIO, id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  revalidatePath("/", "layout")
}

/** Cambia de espacio y vuelve al cronometro. */
export async function cambiarEspacio(id: string) {
  await activarEspacio(id)
  redirect(RUTA_APP)
}

/** Cambia de espacio y va a donde se le diga. */
export async function entrarEnEspacio(id: string, destino: string) {
  await activarEspacio(id)
  redirect(rutaSegura(destino))
}
