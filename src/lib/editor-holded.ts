/**
 * El editor de Gestión → Holded, la parte que no pinta: junta el catálogo, los
 * cierres, los enlaces y las horas en lo que enseña la pantalla. Se calcula en
 * el servidor y viaja entero al navegador.
 *
 * Lo que manda:
 * - Un sitio es donde puede ir el dinero: cada edición, o el proyecto entero
 *   si no tiene ediciones (y el cierre general de antes de tenerlas, si aún
 *   guarda algo).
 * - Cada proyecto de Holded va a un sitio o está «por decidir». Un sitio junta
 *   los que le lleguen, y la base suma sus cifras.
 */

import {
  claveSitio,
  sugerirEnlaces,
  type CierrePosible,
  type HoldedProyecto,
  type Sitio,
} from "@/lib/holded"
import type { Edicion, Proyecto } from "@/lib/tipos"

export type SitioEditor = Sitio & {
  clave: string
  /** El nombre dentro del proyecto: la edición, o «Todo el proyecto». */
  nombre: string
  archivado: boolean
  segundos: number
  facturables: number
  /** Ingresos y gastos del cierre, si lo hay (Holded más ajustes, o a mano). */
  ingresos: number | null
  gastos: number | null
  /**
   * Lo que no viene de Holded en un cierre enlazado (los ajustes), para
   * rehacer la cuenta al momento cuando se mueve un enlace, antes de que
   * vuelva la cifra de la base.
   */
  extraIngresos: number
  extraGastos: number
  holdedIds: string[]
}

export type ProyectoEditor = {
  id: string
  nombre: string
  archivado: boolean
  conEdiciones: boolean
  sitios: SitioEditor[]
}

export type HoldedEditor = {
  holdedId: string
  nombre: string
  /** Lo último traído de Holded; null si nunca se ha enlazado. */
  ingresos: number | null
  gastos: number | null
  /** Clave del sitio donde está, o null si está por decidir. */
  sitio: string | null
  /** A dónde se propone llevarlo, si está por decidir y se parece a algo. */
  propuesta: string | null
  /** Con qué otro de Holded se juntaría, si la propuesta viene de ahí. */
  hermano: string | null
}

export type ModeloEditor = {
  proyectos: ProyectoEditor[]
  holded: HoldedEditor[]
}

type Cierre = {
  id: string
  project_id: string
  edition_id: string | null
  income: number
  expenses: number
}
type Enlace = {
  holded_project_id: string
  result_id: string | null
  income: number | null
  expenses: number | null
}
type Horas = { p: string; e: string | null; s: number; f: number }

export function montarModelo({
  proyectos,
  ediciones,
  holded,
  cierres,
  enlaces,
  horas,
}: {
  proyectos: Proyecto[]
  ediciones: Edicion[]
  holded: HoldedProyecto[]
  cierres: Cierre[]
  enlaces: Enlace[]
  horas: Horas[]
}): ModeloEditor {
  const horasDe = new Map(horas.map((h) => [claveSitio({ proyectoId: h.p, edicionId: h.e }), h]))
  const cierreDe = new Map(
    cierres.map((c) => [claveSitio({ proyectoId: c.project_id, edicionId: c.edition_id }), c]),
  )
  const claveDeCierre = new Map(
    cierres.map((c) => [c.id, claveSitio({ proyectoId: c.project_id, edicionId: c.edition_id })]),
  )
  const enlaceDe = new Map(enlaces.map((e) => [e.holded_project_id, e]))
  const holdedEn = new Map<string, string[]>()
  for (const e of enlaces) {
    const clave = e.result_id ? claveDeCierre.get(e.result_id) : undefined
    if (!clave) continue
    holdedEn.set(clave, [...(holdedEn.get(clave) ?? []), e.holded_project_id])
  }

  const sitioDe = (proyecto: Proyecto, edicion: Edicion | null): SitioEditor => {
    const sitio = { proyectoId: proyecto.id, edicionId: edicion?.id ?? null }
    const clave = claveSitio(sitio)
    const h = horasDe.get(clave)
    const c = cierreDe.get(clave)
    const suyos = holdedEn.get(clave) ?? []
    const deHolded = (campo: "income" | "expenses") =>
      suyos.reduce((s, id) => s + Number(enlaceDe.get(id)?.[campo] ?? 0), 0)
    return {
      ...sitio,
      clave,
      nombre: edicion?.name ?? "Todo el proyecto",
      archivado: edicion?.archived ?? proyecto.archived,
      segundos: Number(h?.s ?? 0),
      facturables: Number(h?.f ?? 0),
      ingresos: c ? Number(c.income) : null,
      gastos: c ? Number(c.expenses) : null,
      extraIngresos: c && suyos.length ? Number(c.income) - deHolded("income") : 0,
      extraGastos: c && suyos.length ? Number(c.expenses) - deHolded("expenses") : 0,
      holdedIds: suyos,
    }
  }

  const tieneAlgo = (s: SitioEditor) =>
    s.holdedIds.length > 0 || Boolean(s.ingresos) || Boolean(s.gastos)

  const lista: ProyectoEditor[] = []
  for (const p of proyectos) {
    const suyas = ediciones.filter((e) => e.project_id === p.id)
    let sitios: SitioEditor[]
    if (suyas.length === 0) {
      sitios = [sitioDe(p, null)]
    } else {
      sitios = suyas.map((e) => sitioDe(p, e)).filter((s) => !s.archivado || tieneAlgo(s))
      // El cierre general de cuando no había ediciones, si aún guarda algo
      const general = sitioDe(p, null)
      if (tieneAlgo(general)) sitios.push({ ...general, nombre: "Resultado del proyecto" })
    }
    if (p.archived && !sitios.some(tieneAlgo)) continue
    lista.push({
      id: p.id,
      nombre: p.name,
      archivado: p.archived,
      conEdiciones: suyas.length > 0,
      sitios,
    })
  }

  // Las propuestas, con el nombre como se llamaría en Holded
  const posibles: CierrePosible[] = lista.flatMap((p) =>
    p.sitios
      .filter((s) => !s.archivado)
      .map((s) => ({
        proyectoId: s.proyectoId,
        edicionId: s.edicionId,
        nombre: s.edicionId ? `${p.nombre} ${s.nombre}` : p.nombre,
        holdedIds: s.holdedIds,
      })),
  )
  const propuestas = sugerirEnlaces(holded, posibles)

  // Un enlace a un proyecto que ya no sale en el listado de Holded sigue ahí
  const nombres = new Map(holded.map((h) => [h.holded_id, h.name]))
  for (const e of enlaces) {
    if (e.result_id && !nombres.has(e.holded_project_id)) {
      nombres.set(e.holded_project_id, "Ya no está en Holded")
    }
  }

  const sitioDeHolded = new Map<string, string>()
  for (const p of lista) for (const s of p.sitios) for (const h of s.holdedIds) sitioDeHolded.set(h, s.clave)

  return {
    proyectos: lista,
    holded: [...nombres].map(([holdedId, nombre]) => {
      const e = enlaceDe.get(holdedId)
      const propuesta = propuestas.get(holdedId)
      return {
        holdedId,
        nombre,
        ingresos: e?.income ?? null,
        gastos: e?.expenses ?? null,
        sitio: sitioDeHolded.get(holdedId) ?? null,
        propuesta: propuesta ? claveSitio(propuesta.sitio) : null,
        hermano: propuesta?.hermano ?? null,
      }
    }),
  }
}

/**
 * Beneficio entre horas facturables. Con menos de una hora no es un dato, es
 * una división: 1.000 € entre 18 segundos.
 */
export function beneficioPorHora(ingresos: number, gastos: number, facturables: number) {
  const horas = facturables / 3600
  return horas >= 1 ? (ingresos - gastos) / horas : null
}
