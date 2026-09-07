"use server"

import { getSesion } from "@/lib/sesion"
import { esAdmin } from "@/lib/roles"
import { getSuscripcion } from "@/lib/suscripcion"
import { stripe, precioMensual, tipoDeIva } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import { mensajeError } from "@/lib/errores"

/**
 * Las tres cosas que se pueden hacer con el dinero desde la app. Ninguna
 * escribe en `workspace_subscriptions`: eso es cosa del webhook. Aqui solo se
 * abre la puerta de Stripe y se vuelve.
 *
 * El rol se comprueba en el servidor en cada accion, no en el boton: quien
 * sepa llamar a la accion a mano no es admin por eso.
 */

function volverA(ruta: string) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.hitoo.es"
  return `${sitio}${ruta}`
}

/** Abre el Checkout de Stripe. Devuelve la URL a la que hay que ir. */
export async function crearPago(): Promise<{ url: string } | { error: string }> {
  const { espacio, rol, perfil } = await getSesion()
  if (!esAdmin(rol)) return { error: "Solo quien administra el espacio puede suscribirlo" }

  const suscripcion = await getSuscripcion(espacio.id)
  if (suscripcion.estado === "pagando") {
    return { error: "Este espacio ya tiene una suscripción en marcha" }
  }

  try {
    const sesion = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: precioMensual(), quantity: 1, tax_rates: tipoDeIva() }],
      // Si ya hubo un cliente, se reutiliza; si no, Stripe lo crea con este
      // correo y el webhook se queda con su identificador.
      ...(suscripcion.clienteStripe
        ? { customer: suscripcion.clienteStripe }
        : { customer_email: perfil.email }),
      client_reference_id: espacio.id,
      // El webhook llega sin sesion: el espacio viaja en la suscripcion.
      subscription_data: { metadata: { workspace_id: espacio.id } },
      // Quien cobra es NITTON y factura en España: hay que recoger el pais
      // y el NIF para poder emitir la factura.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      // Que acepte las condiciones aqui, en la pasarela, y quede constancia
      // en la propia sesion de Stripe. El texto y el enlace salen de la URL
      // de condiciones configurada en el panel de Stripe -sin ella, Stripe
      // rechaza la sesion; lo traduce `mensajeError` mas abajo-.
      consent_collection: { terms_of_service: "required" },
      // La pasarela en castellano, como el resto. Sin esto Stripe la pinta
      // en el idioma del navegador, que no siempre es el de quien paga.
      locale: "es",
      success_url: volverA("/gestion/suscripcion?pago=hecho"),
      cancel_url: volverA("/gestion/suscripcion"),
    })

    if (!sesion.url) return { error: "Stripe no ha devuelto la página de pago" }
    return { url: sesion.url }
  } catch (error) {
    // El fallo de configuracion mas probable la primera vez que se cobra en
    // real: el modo real es una cuenta distinta del sandbox y hay que volver
    // a poner ahi la URL de las condiciones. El mensaje de Stripe es claro
    // pero llega en ingles y sin decir donde se arregla.
    const texto = mensajeError(error)
    if (/terms.of.service|consent_collection/i.test(texto)) {
      return {
        error:
          "Falta la URL de las condiciones en el panel de Stripe (Configuración > Público). Sin ella no se puede pedir que se acepten al pagar.",
      }
    }
    return { error: texto }
  }
}

/** El portal de Stripe: cambiar la tarjeta, ver facturas o cancelar. */
export async function abrirPortal(): Promise<{ url: string } | { error: string }> {
  const { espacio, rol } = await getSesion()
  if (!esAdmin(rol)) return { error: "Solo quien administra el espacio puede tocar el pago" }

  const { clienteStripe } = await getSuscripcion(espacio.id)
  if (!clienteStripe) return { error: "Todavía no hay ningún pago que gestionar" }

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: clienteStripe,
      return_url: volverA("/gestion/suscripcion"),
    })
    return { url: portal.url }
  } catch (error) {
    return { error: mensajeError(error) }
  }
}

/** Canjear un código que alarga la prueba (LEINNHITOO son 30 días). */
export async function canjearCodigo(
  codigo: string,
): Promise<{ finPrueba: string } | { error: string }> {
  const { espacio, rol } = await getSesion()
  if (!esAdmin(rol)) return { error: "Solo quien administra el espacio puede usar un código" }

  const supabase = await createClient()
  // La comprobacion de verdad esta en la funcion de la base, que ademas
  // vuelve a mirar el rol: esta de aqui solo evita el viaje.
  const { data, error } = await supabase.rpc("aplicar_codigo_prueba", {
    p_workspace: espacio.id,
    p_codigo: codigo,
  })

  if (error) return { error: mensajeError(error) }
  return { finPrueba: data }
}
