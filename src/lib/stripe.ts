import Stripe from "stripe"

/**
 * Solo servidor. La clave secreta de Stripe no se importa nunca desde un
 * componente "use client": ahi acabaria dentro del paquete que baja el
 * navegador.
 *
 * El cliente se crea a la primera llamada y no al importar el modulo, para
 * que una compilacion sin las variables puestas no reviente: falla quien
 * intenta cobrar, no la pagina entera.
 */
let cliente: Stripe | null = null

export function stripe(): Stripe {
  if (!cliente) {
    const clave = process.env.STRIPE_SECRET_KEY
    if (!clave) {
      throw new Error("Falta STRIPE_SECRET_KEY en el entorno del servidor")
    }
    cliente = new Stripe(clave)
  }
  return cliente
}

/**
 * El IVA no viaja en el precio: el precio es "sin impuestos" y el 21% se
 * añade como linea aparte en el cobro. Si algun dia se vende fuera de España
 * esto se cambia por Stripe Tax, que calcula el tipo de cada pais; para
 * vender a equipos españoles, un tipo fijo sobra y no cuesta comision.
 */
export function tipoDeIva(): string[] {
  const tipo = process.env.STRIPE_TAX_RATE_ID
  return tipo ? [tipo] : []
}

/** El precio vive en Stripe; aqui solo el identificador y como se cuenta. */
export function precioMensual(): string {
  const precio = process.env.STRIPE_PRICE_ID
  if (!precio) throw new Error("Falta STRIPE_PRICE_ID en el entorno del servidor")
  return precio
}
