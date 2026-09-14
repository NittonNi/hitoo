import type { EntradaVista } from "@/lib/tipos"

export type Resultado = {
  id: string
  edition_id: string | null
  label: string
  starts_on: string
  ends_on: string
  income: number
  expenses: number
  notes: string
  /** Enlazado con Holded: entonces `income` y `expenses` son Holded más los ajustes. */
  holded_project_id?: string | null
  holded_income?: number | null
  holded_expenses?: number | null
  holded_synced_at?: string | null
  holded_cancelled?: unknown
}

/**
 * Si esta hora es de este cierre. Un solo sitio con el criterio: la edicion
 * manda, y un cierre del proyecto entero solo alcanza a las horas que no son
 * de ninguna edicion -si no, un cierre reguardado despues de crear ediciones
 * se estira hasta hoy y cuenta dos veces las horas que ya llevaba cada una-.
 * Solo cuentan las que llevan el euro: son las que se han hecho para ganar
 * ese dinero.
 */
function esDeEsteCierre(entrada: EntradaVista, cierre: Resultado) {
  if (!entrada.end_at || !entrada.billable) return false
  return cierre.edition_id
    ? entrada.edition_id === cierre.edition_id
    : !entrada.edition_id &&
        entrada.local_date >= cierre.starts_on &&
        entrada.local_date <= cierre.ends_on
}

/**
 * Las horas que se cobran y todavia no cuenta ningun cierre: trabajo hecho del
 * que aun no se ha apuntado que ha dejado. Es lo que le falta al €/h del
 * proyecto para ser el de verdad.
 */
export function horasSinCerrar(
  entradas: EntradaVista[],
  resultados: Resultado[],
) {
  const sueltas = entradas.filter(
    (e) => e.end_at && e.billable && !resultados.some((r) => esDeEsteCierre(e, r)),
  )
  return {
    segundos: sueltas.reduce((s, e) => s + (e.duration_seconds ?? 0), 0),
    entradas: sueltas.length,
  }
}

/**
 * Lo que ha dejado un trabajo y lo que ha costado en horas: ingresos, gastos y
 * la facturacion por hora. Que horas son de cada cierre lo decide
 * `esDeEsteCierre`.
 */
export function resumenDeResultados(
  entradas: EntradaVista[],
  resultados: Resultado[],
) {
  const horasDe = (r: Resultado) =>
    entradas
      .filter((e) => esDeEsteCierre(e, r))
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)

  const ingresos = resultados.reduce((s, r) => s + Number(r.income), 0)
  const gastos = resultados.reduce((s, r) => s + Number(r.expenses), 0)
  const segundos = resultados.reduce((s, r) => s + horasDe(r), 0)
  const horas = segundos / 3600
  return {
    ingresos,
    gastos,
    neto: ingresos - gastos,
    segundos,
    /**
     * Con menos de una hora marcada el reparto no dice nada: mil euros entre
     * dieciocho segundos son doscientos mil euros la hora, y eso no es un dato,
     * es una division. Por debajo de ahi no se ensena.
     */
    porHora: horas >= 1 ? ingresos / horas : null,
    /** Hay dinero apuntado pero faltan horas con el euro para repartirlo. */
    faltanHoras: ingresos > 0 && horas < 1,
  }
}
