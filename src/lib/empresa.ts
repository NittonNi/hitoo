/**
 * Los datos de quien vende. Viven en un solo sitio porque salen en el aviso
 * legal, en las condiciones, en la politica de privacidad y en las facturas:
 * repetirlos es garantizar que algun dia digan cosas distintas.
 *
 * Rellenados el 1-sep-2026 con los datos que dio Nicolas. Si alguno vuelve a
 * quedar con la palabra «PENDIENTE», las paginas legales se pintan con una
 * franja roja y no se pueden publicar por descuido -ver FALTAN_DATOS.
 */
export const EMPRESA = {
  /** Nombre legal completo, tal y como figura en Hacienda. */
  nombre: "Asociación estudiantil junior empresa Nitton",
  /** Como se la llama de puertas afuera. */
  marca: "NITTON",
  cif: "G56659964",
  domicilio: "Paseo Uribitarte 6, 1.º, 48001 Bilbao",
  provincia: "Bizkaia",
  correo: "hitooclock@gmail.com",
  web: "https://www.hitoo.es",
  webEmpresa: "https://nittoncompany.com",
} as const

/** El precio, en un solo sitio tambien. Lo de Stripe tiene que decir lo mismo. */
export const PRECIO = {
  euros: 19,
  iva: 21,
  /** Con IVA incluido, para poder enseñarlo hecho y no obligar a multiplicar. */
  get conIva() {
    return Math.round(this.euros * (1 + this.iva / 100) * 100) / 100
  },
  /**
   * El mismo numero, escrito como se escribe en castellano: con coma. Un
   * numero suelto se pinta 22.99, con punto, que en una pagina legal en
   * castellano canta.
   */
  get conIvaTexto() {
    return this.conIva.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  },
  personas: 20,
  diasPrueba: 14,
  diasPruebaLeinn: 30,
} as const

/** True si todavia hay huecos sin rellenar. Lo usan las paginas legales. */
export const FALTAN_DATOS =
  EMPRESA.cif.includes("PENDIENTE") || EMPRESA.domicilio.includes("PENDIENTE")
