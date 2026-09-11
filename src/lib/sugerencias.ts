import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"
import type { BorradorEntrada, Catalogo } from "@/lib/tipos"

/**
 * Sugerencias al escribir en la barra del cronómetro, como en Clockify: las
 * descripciones que ya usaste en este espacio, cada una con lo que llevaba
 * -proyecto, edición, tarea, etiquetas y facturable- para copiarlo de una vez.
 *
 * Nada de una consulta por tecla: al entrar en el campo se traen tus últimas
 * horas de golpe y se filtra aquí, en el navegador.
 */

/** Unos dos meses de uso normal: lo que de verdad se repite cabe de sobra. */
export const HORAS_QUE_SE_MIRAN = 400

/** Las que se leen de un vistazo. Si no está entre ellas, se escribe una letra más. */
export const SUGERENCIAS_VISIBLES = 6

/** Lo que hace falta de cada hora pasada. */
export type HoraPasada = {
  description: string
  project_id: string | null
  edition_id: string | null
  task_id: string | null
  billable: boolean
  time_entry_tags: { tag_id: string }[]
}

export type Sugerencia = {
  /** Descripción, proyecto, edición, tarea y etiquetas: lo que la hace distinta. */
  clave: string
  /** La descripción ya normalizada, para no repetirlo en cada tecla. */
  buscable: string
  /** Lo que se copia a la barra al elegirla. */
  borrador: BorradorEntrada
}

/** Tus horas terminadas de este espacio, de la más reciente a la más antigua. */
export async function cargarHorasPasadas(
  supabase: SupabaseClient<Database>,
  { usuarioId, espacioId }: { usuarioId: string; espacioId: string },
): Promise<HoraPasada[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("description, project_id, edition_id, task_id, billable, time_entry_tags(tag_id)")
    .eq("user_id", usuarioId)
    .eq("workspace_id", espacioId)
    // La que corre ahora es justo la que se está escribiendo
    .not("end_at", "is", null)
    .neq("description", "")
    .order("start_at", { ascending: false })
    .limit(HORAS_QUE_SE_MIRAN)
  if (error) throw error
  return data ?? []
}

/** Minúsculas, sin tildes y sin espacios de más: «Reunión» y «reunion » son lo mismo. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * El facturable no cuenta: dos sugerencias que solo se diferencian en eso se
 * verían iguales en la lista. Se queda el de la última vez.
 */
function claveDe(borrador: BorradorEntrada): string {
  return [
    normalizar(borrador.description),
    borrador.project_id ?? "",
    borrador.edition_id ?? "",
    borrador.task_id ?? "",
    [...borrador.tagIds].sort().join(","),
  ].join("|")
}

/**
 * Una sugerencia por combinación: la misma descripción con otro proyecto u
 * otras etiquetas es otra sugerencia. Las horas llegan de la más reciente a la
 * más antigua, así que de cada combinación manda la última vez que se usó.
 *
 * El catálogo de la barra no trae lo archivado. Una hora cuyo proyecto ya no
 * se puede elegir no se sugiere; de una edición, una tarea o una etiqueta
 * archivadas se copia todo lo demás.
 */
export function sugerenciasDe(horas: HoraPasada[], catalogo: Catalogo): Sugerencia[] {
  const proyectos = new Set(catalogo.proyectos.map((p) => p.id))
  const ediciones = new Set(catalogo.ediciones.map((e) => e.id))
  const tareas = new Set(catalogo.tareas.map((t) => t.id))
  const etiquetas = new Set(catalogo.etiquetas.map((e) => e.id))

  const vistas = new Set<string>()
  const sugerencias: Sugerencia[] = []
  for (const hora of horas) {
    const description = hora.description.trim()
    if (!description) continue
    if (hora.project_id && !proyectos.has(hora.project_id)) continue

    const borrador: BorradorEntrada = {
      description,
      project_id: hora.project_id,
      edition_id:
        hora.edition_id && ediciones.has(hora.edition_id) ? hora.edition_id : null,
      task_id: hora.task_id && tareas.has(hora.task_id) ? hora.task_id : null,
      tagIds: hora.time_entry_tags
        .map((t) => t.tag_id)
        .filter((id) => etiquetas.has(id)),
      billable: hora.billable,
    }
    const clave = claveDe(borrador)
    if (vistas.has(clave)) continue
    vistas.add(clave)
    sugerencias.push({ clave, buscable: normalizar(description), borrador })
  }
  return sugerencias
}

/**
 * Las que encajan con lo escrito, sin distinguir mayúsculas ni tildes. Cada
 * palabra tiene que estar en la descripción, en cualquier orden: «cliente reu»
 * encuentra «Reunión con cliente». Con el campo vacío salen las más recientes.
 *
 * La que ya está puesta tal cual en la barra no se ofrece: elegirla no
 * cambiaría nada.
 */
export function filtrarSugerencias(
  sugerencias: Sugerencia[],
  texto: string,
  actual: BorradorEntrada,
): Sugerencia[] {
  const palabras = normalizar(texto).split(" ").filter(Boolean)
  const yaPuesta = claveDe({ ...actual, description: texto })

  const encajan: Sugerencia[] = []
  for (const sugerencia of sugerencias) {
    if (sugerencia.clave === yaPuesta) continue
    if (!palabras.every((p) => sugerencia.buscable.includes(p))) continue
    encajan.push(sugerencia)
    if (encajan.length === SUGERENCIAS_VISIBLES) break
  }
  return encajan
}
