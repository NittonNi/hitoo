import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/database.types"

export type Suscripcion = Tables<"workspace_subscriptions">

/**
 * Lo que la app necesita saber del dinero, ya masticado: en que situacion
 * esta el espacio y si se pueden apuntar horas nuevas.
 *
 * La regla dura es una sola: **caducar no borra ni esconde nada**. Un equipo
 * que deja de pagar sigue viendo y exportando sus horas; lo que no puede es
 * apuntar mas. Secuestrar el historico de alguien no es cobrar, es otra cosa.
 */
export type Estado =
  | "prueba" // todavia dentro de los dias de prueba
  | "pagando" // suscripcion viva en Stripe
  | "cortesia" // gratis a proposito y sin caducidad
  | "fallo_cobro" // Stripe no ha podido cobrar y lo esta reintentando
  | "caducada" // se acabo la prueba, o se cancelo

export type EstadoSuscripcion = {
  estado: Estado
  puedeEscribir: boolean
  /** Dias que quedan de prueba, redondeando hacia arriba. Solo en prueba. */
  diasRestantes: number | null
  finPrueba: string | null
  finPeriodo: string | null
  cancelaAlFinal: boolean
  clienteStripe: string | null
}

const DIA = 86_400_000

export function leerEstado(fila: Suscripcion | null): EstadoSuscripcion {
  const base = {
    finPrueba: fila?.trial_ends_at ?? null,
    finPeriodo: fila?.current_period_end ?? null,
    cancelaAlFinal: fila?.cancel_at_period_end ?? false,
    clienteStripe: fila?.stripe_customer_id ?? null,
  }

  // Sin fila no se bloquea a nadie: que falte es un fallo nuestro -el
  // disparador no salto-, no que hayan dejado de pagar.
  if (!fila) {
    return { ...base, estado: "cortesia", puedeEscribir: true, diasRestantes: null }
  }

  if (fila.status === "cortesia") {
    return { ...base, estado: "cortesia", puedeEscribir: true, diasRestantes: null }
  }

  if (fila.status === "active") {
    return { ...base, estado: "pagando", puedeEscribir: true, diasRestantes: null }
  }

  // Un cobro fallido no cierra la puerta: Stripe reintenta unos dias y lo
  // normal es que sea una tarjeta caducada, no una fuga.
  if (fila.status === "past_due") {
    return { ...base, estado: "fallo_cobro", puedeEscribir: true, diasRestantes: null }
  }

  if (fila.status === "trialing") {
    const restante = new Date(fila.trial_ends_at).getTime() - Date.now()
    if (restante > 0) {
      return {
        ...base,
        estado: "prueba",
        puedeEscribir: true,
        diasRestantes: Math.ceil(restante / DIA),
      }
    }
  }

  return { ...base, estado: "caducada", puedeEscribir: false, diasRestantes: null }
}

/** La suscripcion del espacio activo. En cache: la piden el armazon y la pagina. */
export const getSuscripcion = cache(async function getSuscripcion(
  espacioId: string,
): Promise<EstadoSuscripcion> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("workspace_subscriptions")
    .select("*")
    .eq("workspace_id", espacioId)
    .maybeSingle()

  return leerEstado(data)
})
