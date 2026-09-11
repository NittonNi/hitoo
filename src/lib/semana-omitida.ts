/**
 * «Omitir» en el aviso de días sin apuntar: lo quita esa semana, en ese
 * navegador y en ese espacio. Va en una cookie y no en localStorage para que el
 * servidor ya no lo pinte al cargar: si no, saldría un momento y se iría.
 *
 * El valor es el lunes de la semana y los espacios donde se omitió, con
 * caracteres que una cookie admite sin codificar: "2026-09-07~id1_id2". Otra
 * semana deja de contar sola, sin tener que borrar nada. El nombre de la cookie
 * vive con los demás, en cookies.ts.
 */

function omitidos(valor: string | undefined, lunes: string): string[] {
  if (!valor) return []
  const [semana, ids = ""] = valor.split("~")
  return semana === lunes ? ids.split("_").filter(Boolean) : []
}

export function estaOmitida(valor: string | undefined, lunes: string, espacioId: string) {
  return omitidos(valor, lunes).includes(espacioId)
}

/** El valor nuevo de la cookie con este espacio omitido esta semana. */
export function conOmitida(valor: string | undefined, lunes: string, espacioId: string) {
  const resto = omitidos(valor, lunes).filter((id) => id !== espacioId)
  return `${lunes}~${[...resto, espacioId].join("_")}`
}

/** Y sin él: vacío si no queda ninguno, que es borrar la cookie. */
export function sinOmitida(valor: string | undefined, lunes: string, espacioId: string) {
  const resto = omitidos(valor, lunes).filter((id) => id !== espacioId)
  return resto.length > 0 ? `${lunes}~${resto.join("_")}` : ""
}
