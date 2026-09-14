"use server"

import { revalidatePath } from "next/cache"

import { getSesion } from "@/lib/sesion"
import { esAdmin, puedeGestionar } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import { mensajeError } from "@/lib/errores"
import { todayKey } from "@/lib/time"
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
 * - Enlazar, desenlazar y actualizar: quien puede apuntar el resultado de un
 *   cierre, que son los mismos que escriben `project_results` (admin y
 *   responsable; un coach mira, pero no toca).
 */

type Hecho = { ok: true } | { error: string }
type Enlace = { proyectoId: string; edicionId: string | null; holdedId: string }

function refrescar() {
  revalidatePath("/gestion/holded")
  revalidatePath("/proyectos/[id]", "page")
}

function mensajeEnlace(error: unknown) {
  if (/project_results_holded_unique/.test(JSON.stringify(error))) {
    return "Ese proyecto de Holded ya está enlazado con otro cierre."
  }
  return mensajeError(error)
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

/* --------------------------------------------------------------- enlaces */

/**
 * Enlaza una edición -o el proyecto entero, con `edicionId` null- sin traer
 * nada de Holded todavía. Si el cierre no existe, se crea con las fechas de
 * sus horas, igual que al apuntar el resultado a mano.
 */
async function enlazarSinTraer(
  espacio: { id: string; timezone: string },
  datos: Enlace,
): Promise<{ cierreId: string } | { error: string }> {
  const supabase = await createClient()

  const buscar = supabase
    .from("project_results")
    .select("id")
    .eq("project_id", datos.proyectoId)
  const { data: existente, error: errBuscar } = await (datos.edicionId
    ? buscar.eq("edition_id", datos.edicionId)
    : buscar.is("edition_id", null)
  ).maybeSingle()
  if (errBuscar) return { error: mensajeError(errBuscar) }

  if (existente) {
    const { data, error } = await supabase
      .from("project_results")
      .update({ holded_project_id: datos.holdedId })
      .eq("id", existente.id)
      .select("id")
    if (error) return { error: mensajeEnlace(error) }
    if (!data?.length) return { error: "No se ha podido enlazar: no tienes permiso sobre este cierre." }
    return { cierreId: existente.id }
  }

  // Las fechas no se escriben: salen de la primera y la última hora
  const extremo = (ascendente: boolean) => {
    const q = supabase
      .from("time_entries")
      .select("local_date")
      .eq("project_id", datos.proyectoId)
      .not("local_date", "is", null)
    return (datos.edicionId ? q.eq("edition_id", datos.edicionId) : q.is("edition_id", null))
      .order("local_date", { ascending: ascendente })
      .limit(1)
      .maybeSingle()
  }
  const [primera, ultima, edicion] = await Promise.all([
    extremo(true),
    extremo(false),
    datos.edicionId
      ? supabase.from("project_editions").select("name").eq("id", datos.edicionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const hoy = todayKey(espacio.timezone)
  const { data, error } = await supabase
    .from("project_results")
    .insert({
      workspace_id: espacio.id,
      project_id: datos.proyectoId,
      edition_id: datos.edicionId,
      label: edicion.data?.name ?? "Todo el proyecto",
      starts_on: primera.data?.local_date ?? hoy,
      ends_on: ultima.data?.local_date ?? hoy,
      holded_project_id: datos.holdedId,
    })
    .select("id")
  if (error) return { error: mensajeEnlace(error) }
  if (!data?.length) return { error: "No se ha podido enlazar: no tienes permiso sobre este cierre." }
  return { cierreId: data[0].id }
}

export async function enlazarCierre(
  datos: Enlace,
): Promise<{ ok: true; cierreId: string } | { error: string }> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para enlazar con Holded." }

  const enlace = await enlazarSinTraer(espacio, datos)
  if ("error" in enlace) return enlace

  const traido = await actualizarEspacio(espacio.id, { soloCierre: enlace.cierreId })
  refrescar()
  if (!traido.ok) return { error: `Enlazado, pero sin cifras todavía: ${traido.error}` }
  return { ok: true, cierreId: enlace.cierreId }
}

/**
 * Varios de golpe (las propuestas de Gestión → Holded). Se enlazan todos y
 * luego se trae una sola vez: con uno por uno se gastaría el cupo.
 */
export async function enlazarVarios(
  lista: Enlace[],
): Promise<{ enlazados: number; errores: string[] } | { error: string }> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para enlazar con Holded." }

  let enlazados = 0
  const errores: string[] = []
  for (const datos of lista) {
    const r = await enlazarSinTraer(espacio, datos)
    if ("error" in r) errores.push(r.error)
    else enlazados++
  }

  if (enlazados > 0) {
    const traido = await actualizarEspacio(espacio.id)
    if (!traido.ok) errores.push(`Enlazados, pero sin cifras todavía: ${traido.error}`)
  }
  refrescar()
  return { enlazados, errores }
}

/** El Deshacer de desenlazar: vuelve a enlazar el mismo cierre y lo actualiza. */
export async function reenlazarCierre(cierreId: string, holdedId: string): Promise<Hecho> {
  const { espacio, rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para enlazar con Holded." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_results")
    .update({ holded_project_id: holdedId })
    .eq("id", cierreId)
    .select("id")
  if (error) return { error: mensajeEnlace(error) }
  if (!data?.length) return { error: "No se ha podido volver a enlazar." }
  const traido = await actualizarEspacio(espacio.id, { soloCierre: cierreId })
  refrescar()
  return traido.ok ? { ok: true } : { error: `Enlazado, pero sin cifras todavía: ${traido.error}` }
}

/** Deja el cierre a mano, con la última cifra. Los ajustes se conservan. */
export async function desenlazarCierre(cierreId: string): Promise<Hecho> {
  const { rol } = await getSesion()
  if (!puedeGestionar(rol)) return { error: "No tienes permiso para desenlazar." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_results")
    .update({ holded_project_id: null })
    .eq("id", cierreId)
    .select("id")
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: "No se ha podido desenlazar: no tienes permiso sobre este cierre." }
  refrescar()
  return { ok: true }
}
