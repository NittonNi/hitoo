/**
 * Holded, la parte que habla con Holded. Solo para el servidor: aquí se
 * descifra la clave de cada espacio y se escriben las cifras con la clave de
 * servicio de Supabase, que es la única mano que puede escribirlas (lo
 * garantiza el disparador `project_results_holded`).
 *
 * Nunca lo importe un componente "use client".
 *
 * El cupo de llamadas manda en todo el diseño: en los planes pequeños de
 * Holded son 500 al mes. Por eso se trae de golpe y se guarda, y nada llama
 * a Holded al abrir una pantalla.
 */

import { createClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/database.types"
import { cifrar, descifrar } from "@/lib/cifrado"
import {
  fechaProyectoHolded,
  importeHolded,
  redondear,
  type HoldedAnulada,
} from "@/lib/holded"

const BASE = "https://api.holded.com/api/v2"

/** Por debajo de este cupo mensual, la actualización automática va semanal. */
export const CUPO_PEQUENO = 5000

export function servicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY")
  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/* ---------------------------------------------------------------- llamadas */

export class ErrorHolded extends Error {
  constructor(
    public tipo: "clave" | "permiso" | "cupo" | "no_existe" | "caido",
    mensaje: string,
  ) {
    super(mensaje)
  }
}

async function llamar<T>(clave: string, ruta: string): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(BASE + ruta, {
      headers: { Accept: "application/json", Authorization: `Bearer ${clave}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new ErrorHolded("caido", "Holded no responde. Prueba otra vez en un rato.")
  }

  if (respuesta.ok) return (await respuesta.json()) as T

  // La v1 contestaba 400 «Invalid key»; la v2, 401. Se aceptan las dos.
  const invalida =
    respuesta.status === 401 ||
    (respuesta.status === 400 && /invalid key/i.test(await respuesta.text()))
  if (invalida) {
    throw new ErrorHolded(
      "clave",
      "Holded no acepta la clave: puede que se haya borrado o que esté mal copiada.",
    )
  }
  if (respuesta.status === 403) {
    throw new ErrorHolded(
      "permiso",
      "La clave no tiene permiso de lectura en Proyectos o en Ventas. Edítala en Holded y dale lectura a los dos.",
    )
  }
  if (respuesta.status === 404) {
    throw new ErrorHolded("no_existe", "Ese proyecto ya no existe en Holded.")
  }
  if (respuesta.status === 429) {
    const ventana = respuesta.headers.get("x-ratelimit-window")
    throw new ErrorHolded(
      "cupo",
      ventana === "minute"
        ? "Holded pide ir más despacio. Vuelve a actualizar en un minuto."
        : "Se ha acabado el cupo de llamadas de Holded de este mes. Se ven las últimas cifras traídas.",
    )
  }
  throw new ErrorHolded("caido", `Holded ha fallado (${respuesta.status}). Prueba otra vez en un rato.`)
}

type Pagina<T> = { items?: T[]; cursor?: string | null; has_more?: boolean }

async function todasLasPaginas<T>(clave: string, ruta: string): Promise<T[]> {
  const todo: T[] = []
  let cursor: string | null = null
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const separador = ruta.includes("?") ? "&" : "?"
    const pagina: Pagina<T> = await llamar<Pagina<T>>(
      clave,
      `${ruta}${separador}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
    todo.push(...(pagina.items ?? []))
    if (!pagina.has_more || !pagina.cursor) break
    cursor = pagina.cursor
  }
  return todo
}

type ProyectoApi = { id: string; name: string; start_date?: string | null }
type LineaApi = { project_id?: string | null; price?: unknown; units?: unknown; discount?: unknown }
type FacturaApi = {
  id: string
  document_number?: string | null
  date?: string | null
  status?: string | null
  lines?: LineaApi[]
}
type ResumenApi = {
  profitability?: { sales?: unknown; expenses?: { total?: unknown } }
}
type UsoApi = { usage?: number; limit?: number }

async function uso(clave: string): Promise<UsoApi | null> {
  try {
    return await llamar<UsoApi>(clave, "/usage")
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ clave */

/**
 * Comprueba una clave antes de guardarla: que Holded la acepte y que pueda
 * leer Proyectos y Ventas, que es lo único que hitoo usa. Tres llamadas.
 */
export async function probarClave(clave: string) {
  await llamar(clave, "/projects?limit=1")
  await llamar(clave, "/invoices?limit=1")
  return uso(clave)
}

export async function guardarClave(espacioId: string, clave: string, userId: string, usoActual: UsoApi | null) {
  const db = servicio()
  const { error: e1 } = await db
    .from("holded_credentials")
    .upsert({ workspace_id: espacioId, api_key: cifrar(clave) })
  if (e1) throw e1
  const { error: e2 } = await db.from("holded_connections").upsert({
    workspace_id: espacioId,
    key_last4: clave.slice(-4),
    connected_by: userId,
    connected_at: new Date().toISOString(),
    last_error: null,
    usage_count: usoActual?.usage ?? null,
    usage_limit: usoActual?.limit ?? null,
  })
  if (e2) throw e2
}

/** Borra la clave y la copia del listado. Los enlaces y las cifras se quedan. */
export async function borrarClave(espacioId: string) {
  const db = servicio()
  for (const tabla of ["holded_credentials", "holded_connections", "holded_projects"] as const) {
    const { error } = await db.from(tabla).delete().eq("workspace_id", espacioId)
    if (error) throw error
  }
}

async function leerClave(espacioId: string): Promise<string | null> {
  const { data } = await servicio()
    .from("holded_credentials")
    .select("api_key")
    .eq("workspace_id", espacioId)
    .maybeSingle()
  return data ? descifrar(data.api_key) : null
}

/* ------------------------------------------------------------ actualizar */

/** Las facturas anuladas de cada proyecto de Holded, con lo que suman sus líneas. */
function anuladasPorProyecto(facturas: FacturaApi[]) {
  const mapa = new Map<string, HoldedAnulada[]>()
  for (const f of facturas) {
    if (f.status !== "cancelled") continue
    const porProyecto = new Map<string, number>()
    for (const l of f.lines ?? []) {
      if (!l.project_id) continue
      const base =
        importeHolded(l.price) * importeHolded(l.units) * (1 - importeHolded(l.discount) / 100)
      porProyecto.set(l.project_id, (porProyecto.get(l.project_id) ?? 0) + base)
    }
    for (const [proyecto, importe] of porProyecto) {
      if (redondear(importe) === 0) continue
      const lista = mapa.get(proyecto) ?? []
      lista.push({
        id: f.id,
        numero: f.document_number ?? f.id,
        fecha: (f.date ?? "").slice(0, 10),
        importe: redondear(importe),
      })
      mapa.set(proyecto, lista)
    }
  }
  return mapa
}

export type ResultadoActualizar =
  | { ok: true; actualizados: number; aviso: string | null }
  | { ok: false; error: string }

/**
 * Trae de Holded lo que hace falta y lo guarda:
 * - el listado de proyectos (para el selector),
 * - el resumen de cada proyecto enlazado (ventas y gastos, sin IVA), en su
 *   enlace: la base suma los enlaces de cada cierre,
 * - las facturas, para encontrar las anuladas que Holded cuenta.
 *
 * `soloCierre` actualiza los enlaces de un único cierre (el botón de la
 * tarjeta) y `soloHolded`, unos proyectos de Holded concretos (los recién
 * enlazados). `sinCerradas` salta los cierres de ediciones cerradas (la vuelta
 * diaria). Los enlaces aparcados, sin sitio, no se actualizan.
 */
export async function actualizarEspacio(
  espacioId: string,
  opciones: { soloCierre?: string; soloHolded?: string[]; sinCerradas?: boolean } = {},
): Promise<ResultadoActualizar> {
  const db = servicio()
  const clave = await leerClave(espacioId)
  if (!clave) return { ok: false, error: "Este espacio no tiene Holded conectado." }

  let actualizados = 0
  let aviso: string | null = null

  try {
    // 1. El listado, salvo si solo se actualiza una tarjeta o unos enlaces
    if (!opciones.soloCierre && !opciones.soloHolded) {
      const proyectos = await todasLasPaginas<ProyectoApi>(clave, "/projects")
      const ahora = new Date().toISOString()
      if (proyectos.length > 0) {
        const { error } = await db.from("holded_projects").upsert(
          proyectos.map((p) => ({
            workspace_id: espacioId,
            holded_id: p.id,
            name: p.name,
            start_date: fechaProyectoHolded(p.start_date),
            synced_at: ahora,
          })),
        )
        if (error) throw error
      }
      // Lo que ya no está en Holded sale del listado
      const { error } = await db
        .from("holded_projects")
        .delete()
        .eq("workspace_id", espacioId)
        .lt("synced_at", ahora)
      if (error) throw error
    }

    // 2. Los enlaces que tienen sitio
    let consulta = db
      .from("holded_enlaces")
      .select("holded_project_id, project_results!inner(project_editions(archived))")
      .eq("workspace_id", espacioId)
      .not("result_id", "is", null)
    if (opciones.soloCierre) consulta = consulta.eq("result_id", opciones.soloCierre)
    if (opciones.soloHolded) consulta = consulta.in("holded_project_id", opciones.soloHolded)
    const { data: enlaces, error: errEnlaces } = await consulta
    if (errEnlaces) throw errEnlaces

    const pendientes = (enlaces ?? []).filter(
      (e) => !(opciones.sinCerradas && e.project_results?.project_editions?.archived),
    )

    if (pendientes.length > 0) {
      // 3. Las anuladas: una pasada por todas las facturas, que son muchas
      //    páginas. Al enlazar uno suelto no se hace, para no gastar el cupo:
      //    llegan con la vuelta diaria o con «Actualizar».
      const anuladas = opciones.soloHolded
        ? null
        : anuladasPorProyecto(await todasLasPaginas<FacturaApi>(clave, "/invoices"))

      // 4. Un resumen por proyecto enlazado, de cuatro en cuatro
      const noExisten: string[] = []
      for (let i = 0; i < pendientes.length; i += 4) {
        const tanda = pendientes.slice(i, i + 4)
        await Promise.all(
          tanda.map(async (enlace) => {
            const holdedId = enlace.holded_project_id
            let resumen: ResumenApi
            try {
              resumen = await llamar<ResumenApi>(clave, `/projects/${holdedId}/summary`)
            } catch (e) {
              if (e instanceof ErrorHolded && e.tipo === "no_existe") {
                noExisten.push(holdedId)
                return
              }
              throw e
            }
            const { data, error } = await db
              .from("holded_enlaces")
              .update({
                income: redondear(importeHolded(resumen.profitability?.sales)),
                expenses: redondear(importeHolded(resumen.profitability?.expenses?.total)),
                synced_at: new Date().toISOString(),
                ...(anuladas ? { cancelled: (anuladas.get(holdedId) ?? []) as unknown as Json } : {}),
              })
              .eq("workspace_id", espacioId)
              .eq("holded_project_id", holdedId)
              .select("holded_project_id")
            if (error) throw error
            if (data?.length) actualizados++
          }),
        )
      }
      if (noExisten.length > 0) {
        aviso =
          noExisten.length === 1
            ? "Un proyecto enlazado ya no existe en Holded: se quedan sus últimas cifras."
            : `${noExisten.length} proyectos enlazados ya no existen en Holded: se quedan sus últimas cifras.`
      }
    }

    const usoActual = await uso(clave)
    await db
      .from("holded_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: aviso,
        ...(usoActual ? { usage_count: usoActual.usage ?? null, usage_limit: usoActual.limit ?? null } : {}),
      })
      .eq("workspace_id", espacioId)

    return { ok: true, actualizados, aviso }
  } catch (e) {
    const mensaje =
      e instanceof ErrorHolded ? e.message : "No se ha podido actualizar desde Holded."
    await db
      .from("holded_connections")
      .update({ last_error: mensaje })
      .eq("workspace_id", espacioId)
    if (!(e instanceof ErrorHolded)) console.error("[holded] actualizar", e)
    return { ok: false, error: mensaje }
  }
}
