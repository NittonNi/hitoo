"use client"

import { useOptimistic, useTransition } from "react"
import { unstable_rethrow } from "next/navigation"

import { cambiarEspacio } from "@/app/acciones"

/**
 * Cambiar de espacio es un viaje entero al servidor: guarda la cookie, vuelve a
 * pintar la sesion desde el layout de (app) y acaba en el cronometro. Va dentro
 * de una transicion, y mientras dura una transicion React deja la pantalla
 * vieja quieta hasta tener la nueva: ese era el segundo en que "no pasaba nada".
 *
 * Aqui se lleva la cuenta de que hay un cambio en camino (`cambiando`) y de a
 * cual va (`elegido`), para que la pantalla lo diga en el mismo clic. Los dos
 * duran lo mismo que la transicion, navegacion del redirect incluida: el router
 * hace su cambio dentro de ella, asi que React lo pinta todo junto. Al llegar
 * el espacio nuevo, o al fallar, vuelven solos a su sitio sin deshacer nada a
 * mano.
 */
export function useCambioEspacio(alFallar: () => void) {
  const [cambiando, empezarTransicion] = useTransition()
  const [elegido, marcarElegido] = useOptimistic<string | null>(null)

  function cambiar(id: string) {
    empezarTransicion(async () => {
      marcarElegido(id)
      try {
        await cambiarEspacio(id)
      } catch (err) {
        if (!esNavegacion(err)) alFallar()
      }
    })
  }

  return { cambiando, elegido, cambiar }
}

export type CambioEspacio = ReturnType<typeof useCambioEspacio>

/* Cuando todo va bien, la promesa de la accion no se resuelve: se rechaza con
   el propio redirect justo antes de navegar (server-action-reducer.js de Next).
   Eso no es un fallo, y relanzarlo lo mandaria a un limite de error.
   unstable_rethrow es la forma publica de reconocerlo: relanza justo los
   errores con los que navega Next, y nada mas. */
function esNavegacion(err: unknown) {
  try {
    unstable_rethrow(err)
    return false
  } catch {
    return true
  }
}
