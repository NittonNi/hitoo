/**
 * Holded, la parte que no habla con Holded: tipos, cómo se leen sus datos y
 * cómo se propone con qué cierre va cada proyecto. Sirve igual en el servidor
 * que en el navegador. Las llamadas y la clave viven en `holded-servidor.ts`.
 *
 * Lo que se aprendió probando la API de verdad (14-sep-2026):
 * - Solo vale la API v2 (`/api/v2`, cabecera `Authorization: Bearer`). Las
 *   claves nuevas no entran en la v1.
 * - Los importes de las facturas llegan como texto con coma decimal
 *   ("1453,83"); los del resumen de un proyecto, como número.
 * - La fecha de inicio de un proyecto viene en dd/mm/aaaa; la de una factura,
 *   en aaaa-mm-dd.
 * - El resumen de un proyecto cuenta también las facturas anuladas. Por eso se
 *   buscan aparte y se propone restarlas con un ajuste.
 */

/** Una factura anulada que Holded sigue sumando en las ventas del proyecto. */
export type HoldedAnulada = {
  id: string
  numero: string
  fecha: string
  importe: number
}

export type HoldedProyecto = {
  holded_id: string
  name: string
  start_date: string | null
}

export type HoldedConexion = {
  key_last4: string
  connected_at: string
  last_synced_at: string | null
  last_error: string | null
  usage_count: number | null
  usage_limit: number | null
}

export type Ajuste = {
  id: string
  result_id: string
  field: "income" | "expenses"
  amount: number
  note: string
  holded_document: string | null
  created_by: string | null
  created_at: string
}

/** Un proyecto de Holded dentro de un cierre, con lo último traído. */
export type EnlaceCierre = {
  holdedId: string
  resultId: string
  income: number | null
  expenses: number | null
  syncedAt: string | null
}

/** Lo que la ficha de un proyecto necesita saber de Holded. */
export type DatosHolded = {
  conectado: boolean
  proyectos: HoldedProyecto[]
  /** Proyecto de Holded -> el cierre de hitoo con el que ya está enlazado. */
  enlazados: Record<string, string>
  /** Los enlaces de los cierres de este proyecto, cada uno con sus cifras. */
  enlaces: EnlaceCierre[]
  ajustes: Ajuste[]
  /** Quién es quién, para firmar los ajustes. */
  nombres: Record<string, string>
}

/** "1.453,83" o "1453,83" o 1453.83 -> 1453.83. */
export function importeHolded(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0
  if (typeof valor !== "string") return 0
  const limpio = valor.trim()
  if (!limpio) return 0
  // Con coma decimal, los puntos son de miles; sin coma, el punto es decimal
  const normal = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio
  const n = Number(normal)
  return Number.isFinite(n) ? n : 0
}

export function redondear(n: number) {
  return Math.round(n * 100) / 100
}

/** "25/03/2026" -> "2026-03-25". Lo que no tenga esa forma, null. */
export function fechaProyectoHolded(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : null
}

/* ------------------------------------------------------------- sugerencias */

function palabras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1 || /\d/.test(p))
    // «2025» y «25» son el mismo año: «FERIA 24 25» es «FERIA 2024-25»
    .map((p) => (/^20\d\d$/.test(p) ? p.slice(2) : p))
}

/** Lo que separa una edición de otra: el año, el número, el mes o la estación. */
const SEPARAN = new Set([
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "setiembre", "octubre", "noviembre", "diciembre",
  "primavera", "verano", "otono", "invierno",
])
const separa = (p: string) => /\d/.test(p) || SEPARAN.has(p)

/**
 * Cuánto se parecen dos nombres, de 0 a 1: palabras en común sobre las del
 * más largo. «CHUPA CHUSES ENERO 2026» y «Chupa Chuses · Enero 2026» dan 1.
 * Un año, un número o un mes que no coincide (2025 contra 2026, enero contra
 * febrero) resta, porque en LEINN es justo lo que separa una edición de otra.
 */
export function parecido(a: string, b: string): number {
  const pa = new Set(palabras(a))
  const pb = new Set(palabras(b))
  if (pa.size === 0 || pb.size === 0) return 0
  let comunes = 0
  for (const p of pa) if (pb.has(p)) comunes++
  const numerosA = [...pa].filter(separa)
  const numerosB = [...pb].filter(separa)
  // Si los dos dicen de cuándo son, tienen que decir lo mismo
  const chocan =
    numerosA.length > 0 &&
    numerosB.length > 0 &&
    (numerosA.some((n) => !numerosB.includes(n)) || numerosB.some((n) => !numerosA.includes(n)))
  const base = comunes / Math.max(pa.size, pb.size)
  return chocan ? base / 2 : base
}

/** Dónde puede ir el dinero: una edición, o el proyecto entero con `edicionId` null. */
export type Sitio = { proyectoId: string; edicionId: string | null }

export const claveSitio = (s: Sitio) => `${s.proyectoId}|${s.edicionId ?? ""}`

/** Un sitio con su nombre («Proyecto Edición», como se llamaría en Holded). */
export type CierrePosible = Sitio & {
  nombre: string
  /** Los proyectos de Holded que ya están en este sitio. */
  holdedIds: string[]
}

export const UMBRAL_SUGERENCIA = 0.6
/** Para juntar con otro de Holded hace falta que se llamen casi igual. */
export const UMBRAL_HERMANO = 0.75

/**
 * Para cada proyecto de Holded sin sitio, a dónde se propone llevarlo:
 * - al sitio vacío que más se le parece por nombre (cada sitio vacío se
 *   propone una sola vez: gana el que más se parece), o
 * - al sitio de otro proyecto de Holded que se llama casi igual y ya está
 *   enlazado: «FERIA 25 26 (TIENDA)» va con «FERIA 25 26 EQUIPO».
 * `hermano` dice con cuál se juntaría, para explicarlo.
 */
export function sugerirEnlaces(
  proyectos: HoldedProyecto[],
  sitios: CierrePosible[],
): Map<string, { sitio: CierrePosible; hermano: string | null }> {
  const sitioDe = new Map<string, CierrePosible>()
  for (const s of sitios) for (const h of s.holdedIds) sitioDe.set(h, s)
  const nombreDe = new Map(proyectos.map((p) => [p.holded_id, p.name]))
  const libres = sitios.filter((s) => s.holdedIds.length === 0)
  const parejas: { holdedId: string; sitio: CierrePosible; nota: number; hermano: string | null }[] = []

  for (const p of proyectos) {
    if (sitioDe.has(p.holded_id)) continue
    for (const s of libres) {
      const nota = parecido(p.name, s.nombre)
      if (nota >= UMBRAL_SUGERENCIA) parejas.push({ holdedId: p.holded_id, sitio: s, nota, hermano: null })
    }
    for (const [otro, s] of sitioDe) {
      const nota = parecido(p.name, nombreDe.get(otro) ?? "")
      if (nota >= UMBRAL_HERMANO) {
        parejas.push({ holdedId: p.holded_id, sitio: s, nota, hermano: nombreDe.get(otro) ?? null })
      }
    }
  }

  parejas.sort((x, y) => y.nota - x.nota)
  const resultado = new Map<string, { sitio: CierrePosible; hermano: string | null }>()
  const usados = new Set<string>()
  for (const { holdedId, sitio, hermano } of parejas) {
    const clave = claveSitio(sitio)
    if (resultado.has(holdedId) || (!hermano && usados.has(clave))) continue
    resultado.set(holdedId, { sitio, hermano })
    if (!hermano) usados.add(clave)
  }
  return resultado
}

/** Los proyectos de Holded ordenados por lo que más se parece a `nombre`. */
export function ordenarPorParecido(proyectos: HoldedProyecto[], nombre: string) {
  return [...proyectos]
    .map((p) => ({ p, nota: parecido(p.name, nombre) }))
    .sort(
      (a, b) =>
        b.nota - a.nota ||
        String(b.p.start_date ?? "").localeCompare(String(a.p.start_date ?? "")),
    )
}

/** Las anuladas que todavía no se han restado con un ajuste. */
export function anuladasPendientes(anuladas: HoldedAnulada[], ajustes: Ajuste[]) {
  const hechas = new Set(ajustes.map((a) => a.holded_document).filter(Boolean))
  return anuladas.filter((a) => !hechas.has(a.numero))
}

/** «hace 3 h», «hace 2 días»... para decir de cuándo son las cifras. */
export function haceCuanto(iso: string | null, ahora = Date.now()): string {
  if (!iso) return "sin traer todavía"
  const minutos = Math.round((ahora - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return "ahora mismo"
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? "ayer" : `hace ${dias} días`
}
