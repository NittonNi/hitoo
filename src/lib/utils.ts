import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Para buscar sin que importen mayúsculas ni tildes: «tech» encuentra «TECH SKILLS». */
export function paraBuscar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

/**
 * Un codigo corto y facil de dictar por telefono, para el enlace de unirse a
 * un espacio. `crypto.getRandomValues` en vez de `Math.random()` -no es
 * criptografia pesada, pero es la puerta de entrada a un espacio de trabajo,
 * asi que mejor no depender de un generador predecible.
 *
 * El alfabeto tiene 32 caracteres (sin "l"/"o", que se confunden con "1"/"0")
 * y se reparte sobre enteros de 32 bits: 2**32 es multiplo de 32, asi que el
 * modulo no sesga ningun caracter.
 */
export function nuevoCodigo(): string {
  const letras = "abcdefghijkmnpqrstuvwxyz23456789"
  const aleatorios = new Uint32Array(10)
  crypto.getRandomValues(aleatorios)
  return Array.from(aleatorios, (n) => letras[n % letras.length]).join("")
}
