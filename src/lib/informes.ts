/** Agregaciones de los informes: siempre en segundos, y el dinero aparte. */

import { toDateKey, fromDateKey, addDays, startOfWeek } from "@/lib/time"
import type { EntradaVista } from "@/lib/tipos"

export type Grupo = {
  clave: string
  etiqueta: string
  color?: string | null
  segundos: number
  facturables: number
  importe: number
  entradas: number
}

export function totales(entradas: EntradaVista[]) {
  let segundos = 0
  let facturables = 0
  let importe = 0

  for (const entrada of entradas) {
    const duracion = entrada.duration_seconds ?? 0
    segundos += duracion
    if (entrada.billable) {
      facturables += duracion
      importe += Number(entrada.amount ?? 0)
    }
  }

  return { segundos, facturables, importe, entradas: entradas.length }
}

export function agrupar(
  entradas: EntradaVista[],
  clave: (e: EntradaVista) => string,
  etiqueta: (e: EntradaVista) => string,
  color?: (e: EntradaVista) => string | null,
): Grupo[] {
  const mapa = new Map<string, Grupo>()

  for (const entrada of entradas) {
    const id = clave(entrada)
    if (!mapa.has(id)) {
      mapa.set(id, {
        clave: id,
        etiqueta: etiqueta(entrada),
        color: color?.(entrada) ?? null,
        segundos: 0,
        facturables: 0,
        importe: 0,
        entradas: 0,
      })
    }
    const grupo = mapa.get(id)!
    const duracion = entrada.duration_seconds ?? 0
    grupo.segundos += duracion
    grupo.entradas += 1
    if (entrada.billable) {
      grupo.facturables += duracion
      grupo.importe += Number(entrada.amount ?? 0)
    }
  }

  return [...mapa.values()].sort((a, b) => b.segundos - a.segundos)
}

/**
 * Las horas repartidas por etiqueta. Una hora puede llevar varias, así que
 * cuenta entera en cada una: por eso vuelve también cuántas horas llevan
 * etiqueta, que es contra lo que hay que sacar los porcentajes -contra el
 * total sumarían más de 100-.
 */
export function agruparPorEtiqueta(entradas: EntradaVista[]) {
  const mapa = new Map<string, Grupo>()
  let segundos = 0

  for (const entrada of entradas) {
    if (entrada.tags.length === 0) continue
    const duracion = entrada.duration_seconds ?? 0
    segundos += duracion

    for (const nombre of entrada.tags) {
      if (!mapa.has(nombre)) {
        mapa.set(nombre, {
          clave: nombre,
          etiqueta: nombre,
          color: null,
          segundos: 0,
          facturables: 0,
          importe: 0,
          entradas: 0,
        })
      }
      const grupo = mapa.get(nombre)!
      grupo.segundos += duracion
      grupo.entradas += 1
      if (entrada.billable) {
        grupo.facturables += duracion
        grupo.importe += Number(entrada.amount ?? 0)
      }
    }
  }

  return {
    grupos: [...mapa.values()].sort((a, b) => b.segundos - a.segundos),
    segundos,
  }
}

export type UnidadSerie = "dia" | "semana" | "mes"

/**
 * De qué tamaño es cada barra según lo largo que sea el periodo: hasta dos
 * meses, días; hasta un año largo, semanas; más, meses. Un año por días eran
 * 250 barras de un píxel, y pasados 400 días el gráfico se cortaba sin avisar.
 */
export function unidadSerie(desde: string, hasta: string): UnidadSerie {
  const dias = Math.round((fromDateKey(hasta).getTime() - fromDateKey(desde).getTime()) / 86_400_000) + 1
  if (dias <= 62) return "dia"
  if (dias <= 400) return "semana"
  return "mes"
}

/** El primer día del tramo de la barra en que cae `dia`. */
function inicioDeTramo(dia: string, unidad: UnidadSerie): string {
  if (unidad === "dia") return dia
  if (unidad === "mes") return dia.slice(0, 8) + "01"
  return toDateKey(startOfWeek(fromDateKey(dia)))
}

/**
 * Serie continua para el gráfico: los tramos sin horas también ocupan sitio.
 * `dia` es el primer día de cada tramo.
 */
export function porTramos(
  entradas: EntradaVista[],
  desde: string,
  hasta: string,
  unidad: UnidadSerie = unidadSerie(desde, hasta),
) {
  const acumulado = new Map<string, { segundos: number; facturables: number }>()

  for (const entrada of entradas) {
    const tramo = inicioDeTramo(entrada.local_date, unidad)
    if (!acumulado.has(tramo)) acumulado.set(tramo, { segundos: 0, facturables: 0 })
    const punto = acumulado.get(tramo)!
    const duracion = entrada.duration_seconds ?? 0
    punto.segundos += duracion
    if (entrada.billable) punto.facturables += duracion
  }

  const serie: { dia: string; horas: number; facturables: number }[] = []
  let tramo = inicioDeTramo(desde, unidad)
  while (tramo <= hasta) {
    const punto = acumulado.get(tramo)
    serie.push({
      dia: tramo,
      horas: Math.round(((punto?.segundos ?? 0) / 3600) * 100) / 100,
      facturables: Math.round(((punto?.facturables ?? 0) / 3600) * 100) / 100,
    })
    if (unidad === "dia") tramo = toDateKey(addDays(fromDateKey(tramo), 1))
    else if (unidad === "semana") tramo = toDateKey(addDays(fromDateKey(tramo), 7))
    else {
      const [a, m] = tramo.split("-").map(Number)
      tramo = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`
    }
  }

  return serie
}

/**
 * Las horas que se pisan con otra de la misma persona. Casi siempre es un
 * rato apuntado dos veces -en Clockify pasaba y se importó tal cual-, así que
 * informes las señala para poder revisarlas. Tocarse en el borde (una acaba a
 * las 10:00 y la otra empieza a las 10:00) no es pisarse.
 */
export function horasQueSePisan(entradas: EntradaVista[]): Set<string> {
  const pisadas = new Set<string>()
  const porPersona = new Map<string, EntradaVista[]>()
  for (const e of entradas) {
    if (!e.end_at) continue
    const lista = porPersona.get(e.user_id)
    if (lista) lista.push(e)
    else porPersona.set(e.user_id, [e])
  }

  for (const lista of porPersona.values()) {
    lista.sort((a, b) => a.start_at.localeCompare(b.start_at))
    // La que más tarde acaba de las ya vistas: basta con compararse con ella
    let abierta: EntradaVista | null = null
    for (const e of lista) {
      if (abierta && new Date(e.start_at) < new Date(abierta.end_at!)) {
        pisadas.add(e.id)
        pisadas.add(abierta.id)
      }
      if (!abierta || new Date(e.end_at!) > new Date(abierta.end_at!)) abierta = e
    }
  }
  return pisadas
}

/** Rangos de uso diario, ya calculados en fechas concretas. */
export function rangos(hoy = new Date()) {
  const dia = (d: Date) => toDateKey(d)
  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  const inicioMesPasado = new Date(
    finMesPasado.getFullYear(),
    finMesPasado.getMonth(),
    1,
  )

  return [
    { clave: "semana", etiqueta: "Esta semana", desde: dia(inicioSemana), hasta: dia(hoy) },
    { clave: "mes", etiqueta: "Este mes", desde: dia(inicioMes), hasta: dia(hoy) },
    {
      clave: "mes-pasado",
      etiqueta: "Mes pasado",
      desde: dia(inicioMesPasado),
      hasta: dia(finMesPasado),
    },
    {
      clave: "trimestre",
      etiqueta: "Últimos 90 días",
      desde: dia(addDays(hoy, -89)),
      hasta: dia(hoy),
    },
    {
      clave: "ano",
      etiqueta: "Este año",
      desde: dia(new Date(hoy.getFullYear(), 0, 1)),
      hasta: dia(hoy),
    },
  ]
}
