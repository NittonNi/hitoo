/**
 * Cifra en la base los secretos que no son nuestros: hoy solo el
 * `refresh_token` de Google Calendar. Es AES-256-GCM con una clave que vive
 * en el entorno del servidor (`TOKEN_ENCRYPTION_KEY`), asi que quien llegue a
 * leer la fila -por un fallo de RLS, por un volcado de la base o por el
 * privilegio de columna que el rol `authenticated` todavia tiene sobre
 * `refresh_token`- se lleva un texto inservible, no un permiso vivo sobre el
 * calendario de alguien.
 *
 * GCM y no CBC porque ademas de cifrar autentica: si alguien cambia un byte
 * del texto guardado, descifrar falla en vez de devolver basura.
 *
 * Solo para el servidor -nunca lo importe un componente "use client".
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/** Delante de todo lo cifrado, para poder distinguirlo de lo de antes. */
const MARCA = "v1."

/** GCM estandar: 12 bytes de nonce y 16 de etiqueta de autenticacion. */
const BYTES_IV = 12
const BYTES_ETIQUETA = 16

function clave(): Buffer {
  const bruta = process.env.TOKEN_ENCRYPTION_KEY
  if (!bruta) {
    throw new Error(
      "Falta TOKEN_ENCRYPTION_KEY: sin ella no se pueden guardar ni leer los tokens de Google.",
    )
  }
  const clave = Buffer.from(bruta, "base64")
  if (clave.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY tiene que ser 32 bytes en base64 (44 caracteres).")
  }
  return clave
}

export function cifrar(texto: string): string {
  const iv = randomBytes(BYTES_IV)
  const cifrador = createCipheriv("aes-256-gcm", clave(), iv)
  const cuerpo = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()])
  return MARCA + Buffer.concat([iv, cifrador.getAuthTag(), cuerpo]).toString("base64")
}

/**
 * Las filas guardadas antes de esto son texto plano. Se reconocen por no
 * llevar la marca, y quien las lee las vuelve a guardar cifradas.
 */
export function estaCifrado(valor: string): boolean {
  return valor.startsWith(MARCA)
}

export function descifrar(valor: string): string {
  if (!estaCifrado(valor)) return valor

  const datos = Buffer.from(valor.slice(MARCA.length), "base64")
  const iv = datos.subarray(0, BYTES_IV)
  const etiqueta = datos.subarray(BYTES_IV, BYTES_IV + BYTES_ETIQUETA)
  const cuerpo = datos.subarray(BYTES_IV + BYTES_ETIQUETA)

  const descifrador = createDecipheriv("aes-256-gcm", clave(), iv)
  descifrador.setAuthTag(etiqueta)
  return Buffer.concat([descifrador.update(cuerpo), descifrador.final()]).toString("utf8")
}
