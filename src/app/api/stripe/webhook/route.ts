import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { stripe } from "@/lib/stripe"
import type { Database } from "@/lib/database.types"

/**
 * Lo que Stripe cuenta sobre el dinero entra por aqui y por ningun otro sitio.
 *
 * Dos cosas que parecen manias y no lo son:
 *
 * - Se lee el cuerpo **en crudo** y se comprueba la firma. Sin eso, cualquiera
 *   que sepa la URL se regala una suscripcion con un `curl`.
 * - Se escribe con la clave de servicio. La tabla no tiene politica de
 *   escritura para nadie -ni para el propio equipo-, asi que esta es la unica
 *   mano que la toca. La clave no sale de este fichero.
 */

function base() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY")
  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Stripe -> nosotros. Lo que no reconocemos se trata como cancelado. */
function estadoDe(estado: Stripe.Subscription.Status) {
  switch (estado) {
    case "trialing":
      return "trialing"
    case "active":
      return "active"
    case "past_due":
    case "unpaid":
      return "past_due"
    default:
      return "canceled"
  }
}

/**
 * El fin del periodo vive en la linea de la suscripcion desde que Stripe
 * partio la facturacion por items; en las versiones viejas de la API estaba
 * en la suscripcion. Se miran las dos para no depender de cual conteste.
 */
function finDePeriodo(sub: Stripe.Subscription): string | null {
  const enLinea = sub.items?.data?.[0]?.current_period_end
  const suelto = (sub as unknown as { current_period_end?: number }).current_period_end
  const segundos = enLinea ?? suelto
  return segundos ? new Date(segundos * 1000).toISOString() : null
}

/**
 * Guarda lo que Stripe cuenta. Lanza si no ha podido: quien llama traduce eso
 * en un 500 para que Stripe reintente.
 *
 * Antes esto se tragaba los fallos en un console.error y contestaba 200 igual.
 * Es la peor combinacion posible con dinero de por medio: alguien paga, la
 * fila no se escribe, Stripe da el evento por entregado y NO reintenta. La
 * app no se entera nunca y no hay segunda oportunidad.
 */
async function guardar(sub: Stripe.Subscription) {
  const espacio = sub.metadata?.workspace_id
  if (!espacio) {
    // Esto si es definitivo: sin espacio no hay nada que escribir, y
    // reintentarlo daria igual. Se registra y se da por entregado.
    console.error("Suscripcion de Stripe sin workspace_id:", sub.id)
    return
  }

  const { data, error } = await base()
    .from("workspace_subscriptions")
    .update({
      status: estadoDe(sub.status),
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: finDePeriodo(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("workspace_id", espacio)
    .select("workspace_id")

  if (error) {
    throw new Error(`No se ha podido guardar la suscripcion de ${espacio}: ${error.message}`)
  }

  // Un UPDATE que no encuentra fila no es un error para Postgres: devuelve
  // cero filas y ya. Con el disparador `workspaces_abrir_prueba` la fila
  // siempre deberia existir, asi que si no esta es un fallo nuestro y hay que
  // enterarse -no dejar el cobro sin registrar en silencio-.
  if (!data || data.length === 0) {
    throw new Error(
      `El espacio ${espacio} no tiene fila en workspace_subscriptions: el cobro ${sub.id} se ha quedado sin registrar`,
    )
  }
}

export async function POST(peticion: Request) {
  const firma = peticion.headers.get("stripe-signature")
  const secreto = process.env.STRIPE_WEBHOOK_SECRET
  if (!firma || !secreto) return new Response("Sin firma", { status: 400 })

  let evento: Stripe.Event
  try {
    evento = stripe().webhooks.constructEvent(await peticion.text(), firma, secreto)
  } catch (error) {
    // Firma que no cuadra: o es un impostor, o el secreto esta mal puesto.
    console.error("Webhook de Stripe rechazado:", (error as Error).message)
    return new Response("Firma invalida", { status: 400 })
  }

  // Un 5xx le dice a Stripe "no lo he podido procesar, vuelve a intentarlo";
  // un 200 le dice "entregado, olvidate". Con dinero de por medio, cualquier
  // fallo al guardar tiene que ser lo primero y nunca lo segundo: Stripe
  // reintenta durante dias y el cobro acaba entrando.
  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sesion = evento.data.object
        // La sesion puede traer la suscripcion como identificador o ya
        // expandida, segun como se haya pedido: se aceptan las dos.
        const suscripcion =
          typeof sesion.subscription === "string"
            ? await stripe().subscriptions.retrieve(sesion.subscription)
            : sesion.subscription
        if (suscripcion) await guardar(suscripcion)
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await guardar(evento.data.object)
        break
      default:
        // El resto no cambia lo que la app necesita saber.
        break
    }
  } catch (error) {
    console.error(`Webhook ${evento.type} (${evento.id}) sin procesar:`, error)
    return new Response("No se ha podido procesar", { status: 500 })
  }

  return Response.json({ recibido: true })
}
