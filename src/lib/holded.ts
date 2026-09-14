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

/** Lo que la ficha de un proyecto necesita saber de Holded. */
export type DatosHolded = {
  conectado: boolean
  proyectos: HoldedProyecto[]
  /** Proyecto de Holded -> el cierre de hitoo con el que ya está enlazado. */
  enlazados: Record<string, string>
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
}

/**
 * Cuánto se parecen dos nombres, de 0 a 1: palabras en común sobre las del
 * más largo. «CHUPA CHUSES ENERO 2026» y «Chupa Chuses · Enero 2026» dan 1.
 * Un número que no coincide (2025 contra 2026) resta, porque en LEINN el año
 * es justo lo que separa una edición de otra.
 */
export function parecido(a: string, b: string): number {
  const pa = new Set(palabras(a))
  const pb = new Set(palabras(b))
  if (pa.size === 0 || pb.size === 0) return 0
  let comunes = 0
  for (const p of pa) if (pb.has(p)) comunes++
  const numerosA = [...pa].filter((p) => /\d/.test(p))
  const numerosB = [...pb].filter((p) => /\d/.test(p))
  const chocan =
    numerosA.length > 0 &&
    numerosB.length > 0 &&
    !numerosA.some((n) => numerosB.includes(n))
  const base = comunes / Math.max(pa.size, pb.size)
  return chocan ? base / 2 : base
}

/** Un sitio donde puede ir el dinero: una edición, o el proyecto entero. */
export type CierrePosible = {
  proyectoId: string
  edicionId: string | null
  nombre: string
  /** El proyecto de Holded con el que ya está enlazado, si lo está. */
  holdedId: string | null
}

export const UMBRAL_SUGERENCIA = 0.6

/**
 * Para cada proyecto de Holded sin enlazar, el cierre sin enlazar que más se
 * le parece. Cada cierre se propone una sola vez: gana el que más se parece.
 */
export function sugerirEnlaces(
  proyectos: HoldedProyecto[],
  cierres: CierrePosible[],
): Map<string, CierrePosible> {
  const enlazados = new Set(cierres.map((c) => c.holdedId).filter(Boolean))
  const libres = cierres.filter((c) => !c.holdedId)
  const parejas: { holdedId: string; cierre: CierrePosible; nota: number }[] = []

  for (const p of proyectos) {
    if (enlazados.has(p.holded_id)) continue
    for (const c of libres) {
      const nota = parecido(p.name, c.nombre)
      if (nota >= UMBRAL_SUGERENCIA) parejas.push({ holdedId: p.holded_id, cierre: c, nota })
    }
  }

  parejas.sort((x, y) => y.nota - x.nota)
  const resultado = new Map<string, CierrePosible>()
  const usados = new Set<string>()
  for (const { holdedId, cierre } of parejas) {
    const clave = `${cierre.proyectoId}|${cierre.edicionId ?? ""}`
    if (resultado.has(holdedId) || usados.has(clave)) continue
    resultado.set(holdedId, cierre)
    usados.add(clave)
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
