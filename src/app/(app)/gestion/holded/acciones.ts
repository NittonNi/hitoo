"use server"

import { revalidatePath } from "next/cache"

import { getSesion } from "@/lib/sesion"
import { esAdmin, puedeGestionar } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { mensajeError } from "@/lib/errores"
import { todayKey } from "@/lib/time"
import type { Sitio } from "@/lib/holded"
import {
  actualizarEspacio,
  borrarClave,
  ErrorHolded,
  guardarClave,
  probarClave,
  type ResultadoActualizar,
} from "@/lib/holded-servidor"

/**
 * Lo que se puede hacer con Holded desde la app. El rol se comprueba aquí,
 * en cada acción: quien sepa llamarla a mano no es admin por eso.
 *
 * - Conectar y desconectar: solo quien administra el espacio.
 * - Enlazar, aparcar, meter y actualizar: quien puede apuntar el resultado de
 *   un cierre, que son los mismos que escriben `project_results` (admin y
 *   responsable; un coach mira, pero no toca).
 *
 * Un proyecto de Holded va a un solo sitio (una edición, o el proyecto entero
 * si no tiene ediciones), y un sitio puede juntar varios. Quitarlo de un sitio
 * no lo borra: lo aparca con sus cifras, y así deshacer no gasta cupo.
 */

type Hecho = { ok: true } | { error: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

/** Lo que devuelve enlazar o aparcar: dónde estaba, para poder deshacerlo. */
export type HechoEnlace = { ok: true; antes: Sitio | null; aviso: string | null } | { error: string }

function refrescar() {
  revalidatePath("/gestion/holded")
  revalidatePath("/proyectos/[id]", "page")
}

/* ----------------------------------------------------------------- clave */

export async function conectarHolded(clave: string): Promise<Hecho> {
  const { espacio, rol, perfil } = await getSesion()
  if (!esAdmin(rol)) return { error: "Solo quien administra el espacio puede conectar Holded." }

  const limpia = clave.trim().replace(/^["']|["']$/g, "")
  if (limpia.length < 20) return { error: "Eso no parece una clave de Holded: pégala entera." }

  let uso
  try {
    uso = await probarClave(limpia)
  } catch (e) {
    return { error: e instanceof ErrorHolded ? e.message : "No se ha podido comprobar la clave." }
  }

  try {
    await guardarClave(espacio.id, limpia, perfil.id, uso)
  } catch (e) {
    return { error: mensajeError(e) }
  }

  const traido = await actualizarEspacio(espacio.id)
  refrescar()
  return traido.ok ? { ok: true } : { error: traido.error }
}

export async function desconectarHolded(): Promise<Hecho> {
  const { espacio, rol } = await getSesion()
  if (!esAdmin(rol)) return { error: "Solo quien administra el espacio puede desconectar Holded." }
  try {
    await borrarClave(espacio.id)
  } catch (e) {
    return { error: mensajeError(e) }
  }
  refrescar()
  return { ok: true }
}

export async function actualizarHolded(cierreId?: string): Promise<ResultadoActualizar> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { ok: false, error: "No tienes permiso para actualizar desde Holded." }
  const resultado = await actualizarEspacio(espacio.id, { soloCierre: cierreId })
  refrescar()
  return resultado
}

/* --------------------------------------------------------------- cierres */

/**
 * El cierre de un sitio. Si no existe, se crea con las fechas de sus horas,
 * igual que al apuntar el resultado a mano.
 */
async function cierreDelSitio(
  supabase: Supabase,
  espacio: { id: string; timezone: string },
  sitio: Sitio,
): Promise<{ cierreId: string } | { error: string }> {
  const buscar = supabase.from("project_results").select("id").eq("project_id", sitio.proyectoId)
  const { data: existente, error: errBuscar } = await (sitio.edicionId
    ? buscar.eq("edition_id", sitio.edicionId)
    : buscar.is("edition_id", null)
  ).maybeSingle()
  if (errBuscar) return { error: mensajeError(errBuscar) }
  if (existente) return { cierreId: existente.id }

  // Las fechas no se escriben: salen de la primera y la última hora
  const extremo = (ascendente: boolean) => {
    const q = supabase
      .from("time_entries")
      .select("local_date")
      .eq("project_id", sitio.proyectoId)
      .not("local_date", "is", null)
    return (sitio.edicionId ? q.eq("edition_id", sitio.edicionId) : q.is("edition_id", null))
      .order("local_date", { ascending: ascendente })
      .limit(1)
      .maybeSingle()
  }
  const [primera, ultima, edicion] = await Promise.all([
    extremo(true),
    extremo(false),
    sitio.edicionId
      ? supabase.from("project_editions").select("name").eq("id", sitio.edicionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const hoy = todayKey(espacio.timezone)
  const { data, error } = await supabase
    .from("project_results")
    .insert({
      workspace_id: espacio.id,
      project_id: sitio.proyectoId,
      edition_id: sitio.edicionId,
      label: edicion.data?.name ?? "Todo el proyecto",
      starts_on: primera.data?.local_date ?? hoy,
      ends_on: ultima.data?.local_date ?? hoy,
    })
    .select("id")
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: "No tienes permiso para crear el cierre de ese sitio." }
  return { cierreId: data[0].id }
}

/**
 * Un cierre que se ha quedado sin nada al quitarle su último enlace: sin
 * cifras, sin ajustes y sin notas. Se borra, para que la ficha no enseñe un
 * resultado de 0 € que nadie ha apuntado.
 */
async function limpiarCierre(supabase: Supabase, cierreId: string) {
  const { data } = await supabase
    .from("project_results")
    .select("income, expenses, notes, holded_project_id")
    .eq("id", cierreId)
    .maybeSingle()
  if (
    !data ||
    data.holded_project_id ||
    Number(data.income) !== 0 ||
    Number(data.expenses) !== 0 ||
    data.notes.trim()
  ) {
    return
  }
  const { count } = await supabase
    .from("result_adjustments")
    .select("id", { count: "exact", head: true })
    .eq("result_id", cierreId)
  if (count) return
  await supabase.from("project_results").delete().eq("id", cierreId)
}

/** Dónde está ahora un proyecto de Holded, y si ya tiene cifras traídas. */
async function dondeEsta(
  supabase: Supabase,
  espacioId: string,
  holdedId: string,
): Promise<{ cierreId: string | null; sitio: Sitio | null; traido: boolean } | { error: string }> {
  const { data, error } = await supabase
    .from("holded_enlaces")
    .select("result_id, synced_at, project_results(project_id, edition_id)")
    .eq("workspace_id", espacioId)
    .eq("holded_project_id", holdedId)
    .maybeSingle()
  if (error) return { error: mensajeError(error) }
  const cierre = data?.project_results
  return {
    cierreId: data?.result_id ?? null,
    sitio: cierre ? { proyectoId: cierre.project_id, edicionId: cierre.edition_id } : null,
    traido: Boolean(data?.synced_at),
  }
}

/* --------------------------------------------------------------- enlaces */

/** Pone un proyecto de Holded en un sitio, sin traer nada de Holded todavía. */
async function enlazarSinTraer(
  supabase: Supabase,
  espacio: { id: string; timezone: string },
  holdedId: string,
  sitio: Sitio,
): Promise<{ antes: Sitio | null; traido: boolean } | { error: string }> {
  const antes = await dondeEsta(supabase, espacio.id, holdedId)
  if ("error" in antes) return antes

  const cierre = await cierreDelSitio(supabase, espacio, sitio)
  if ("error" in cierre) return cierre
  if (antes.cierreId === cierre.cierreId) return { antes: antes.sitio, traido: antes.traido }

  const { data, error } = await supabase
    .from("holded_enlaces")
    .upsert(
      { workspace_id: espacio.id, holded_project_id: holdedId, result_id: cierre.cierreId },
      { onConflict: "workspace_id,holded_project_id" },
    )
    .select("holded_project_id")
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: "No se ha podido enlazar: no tienes permiso sobre ese cierre." }

  if (antes.cierreId) await limpiarCierre(supabase, antes.cierreId)
  return { antes: antes.sitio, traido: antes.traido }
}

/**
 * Enlaza un proyecto de Holded con un sitio. Si ya estaba en otro, se mueve
 * con sus cifras; si es la primera vez, se traen de Holded.
 */
export async function enlazarHolded(holdedId: string, sitio: Sitio): Promise<HechoEnlace> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para enlazar con Holded." }

  const supabase = await createClient()
  const r = await enlazarSinTraer(supabase, espacio, holdedId, sitio)
  if ("error" in r) return r

  let aviso: string | null = null
  if (!r.traido) {
    const traido = await actualizarEspacio(espacio.id, { soloHolded: [holdedId] })
    if (!traido.ok) aviso = `Enlazado, pero sin cifras todavía: ${traido.error}`
    else aviso = traido.aviso
  }
  refrescar()
  return { ok: true, antes: r.antes, aviso }
}

/** Lo quita de su sitio y lo deja «por decidir», con sus cifras guardadas. */
export async function aparcarHolded(holdedId: string): Promise<HechoEnlace> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para quitar enlaces de Holded." }

  const supabase = await createClient()
  const antes = await dondeEsta(supabase, espacio.id, holdedId)
  if ("error" in antes) return antes
  if (!antes.cierreId) return { ok: true, antes: null, aviso: null }

  const { data, error } = await supabase
    .from("holded_enlaces")
    .update({ result_id: null })
    .eq("workspace_id", espacio.id)
    .eq("holded_project_id", holdedId)
    .select("holded_project_id")
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: "No se ha podido quitar: no tienes permiso sobre ese cierre." }

  await limpiarCierre(supabase, antes.cierreId)
  refrescar()
  return { ok: true, antes: antes.sitio, aviso: null }
}

/**
 * Varios de golpe (las propuestas). Se enlazan todos y luego se trae una sola
 * vez lo que no tenía cifras: con uno por uno se gastaría el cupo.
 */
export async function enlazarVarios(
  lista: { holdedId: string; sitio: Sitio }[],
): Promise<{ enlazados: number; errores: string[] } | { error: string }> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para enlazar con Holded." }

  const supabase = await createClient()
  let enlazados = 0
  const errores: string[] = []
  const sinCifras: string[] = []
  for (const { holdedId, sitio } of lista) {
    const r = await enlazarSinTraer(supabase, espacio, holdedId, sitio)
    if ("error" in r) {
      errores.push(r.error)
      continue
    }
    enlazados++
    if (!r.traido) sinCifras.push(holdedId)
  }

  if (sinCifras.length > 0) {
    const traido = await actualizarEspacio(espacio.id, { soloHolded: sinCifras })
    if (!traido.ok) errores.push(`Enlazados, pero sin cifras todavía: ${traido.error}`)
  }
  refrescar()
  return { enlazados, errores }
}

/* ----------------------------------------------------------------- meter */

export type Origen = { proyectoId: string; edicionId: string | null }
export type Destino = Sitio & { nueva: boolean; nombre?: string }

export type HechoMeter =
  | {
      ok: true
      deshacer: string
      /** La edición donde han quedado las horas (la nueva, si se ha creado). */
      edicionId: string | null
      entradas: number
      segundos: number
      /** Los proyectos de Holded que venían con lo metido. */
      enlaces: string[]
    }
  | { error: string }

/**
 * Mete un proyecto entero, o una edición, en otro sitio: sus horas, sus
 * propuestas pendientes y su dinero. Lo hace la base de una vez
 * (`meter_en`), y deja guardado cómo estaba para deshacerlo.
 */
export async function meterEn(origen: Origen, destino: Destino): Promise<HechoMeter> {
  const { rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para mover horas entre proyectos." }

  const supabase = await createClient()
  // Los tipos generados no saben que las ediciones pueden ir a null
  const { data, error } = await supabase.rpc("meter_en", {
    p_origen_proyecto: origen.proyectoId,
    p_origen_edicion: origen.edicionId as string,
    p_destino_proyecto: destino.proyectoId,
    p_destino_edicion: destino.edicionId as string,
    p_nueva: destino.nueva,
    p_nombre: destino.nombre,
  })
  if (error) return { error: mensajeError(error) }

  const r = data as {
    deshacer: string
    edicion: string | null
    entradas: number
    segundos: number
    enlaces: string[]
  }
  refrescar()
  revalidatePath("/proyectos")
  return {
    ok: true,
    deshacer: r.deshacer,
    edicionId: r.edicion,
    entradas: r.entradas,
    segundos: Number(r.segundos),
    enlaces: r.enlaces ?? [],
  }
}

export async function deshacerMeter(id: string): Promise<Hecho> {
  const { rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para deshacer esto." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("deshacer_meter", { p_id: id })
  if (error) return { error: mensajeError(error) }
  refrescar()
  revalidatePath("/proyectos")
  return { ok: true }
}
