import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import type { Catalogo, EntradaVista, Miembro, Reparto, RepartoShare } from "@/lib/tipos"

/**
 * Todo lo de aquí va filtrado por espacio de trabajo. La RLS ya lo impide por
 * su cuenta, pero el filtro explicito evita traer de más y deja claro, leyendo
 * el código, que ninguna consulta se sale de su espacio.
 */

/**
 * cache(): la ficha de proyecto pide el mismo catalogo dos veces en la misma
 * carga -una vez en generateMetadata, otra en la pagina-; con esto se
 * convierte en una sola consulta real por request.
 */
export const cargarCatalogo = cache(async function cargarCatalogo(
  espacioId: string,
  incluirArchivados = false,
): Promise<Catalogo> {
  const supabase = await createClient()

  const [proyectos, tareas, etiquetas, categorias, ediciones] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", espacioId)
        .order("name"),
      supabase.from("tasks").select("*").eq("workspace_id", espacioId).order("name"),
      supabase.from("tags").select("*").eq("workspace_id", espacioId).order("name"),
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", espacioId)
        .order("position")
        .order("name"),
      supabase
        .from("project_editions")
        .select("*")
        .eq("workspace_id", espacioId)
        .order("position")
        .order("name"),
    ])

  const vivo = <T extends { archived: boolean }>(filas: T[] | null) =>
    (filas ?? []).filter((f) => incluirArchivados || !f.archived)

  return {
    proyectos: vivo(proyectos.data),
    tareas: vivo(tareas.data),
    etiquetas: vivo(etiquetas.data),
    categorias: vivo(categorias.data),
    ediciones: vivo(ediciones.data),
  }
})

/** Entradas entre dos fechas (inclusive), de la más reciente a la más antigua. */
export async function cargarEntradas(opciones: {
  espacioId: string
  desde: string
  hasta: string
  userId?: string
  projectId?: string
  limite?: number
  /**
   * La entrada en marcha (`end_at` null) ya la pide el layout -`(app)/layout.tsx`-
   * para la barra del cronómetro; en /panel, /calendario y /semana esta misma
   * fila se volvía a traer aquí sin usarla (lista-entradas.tsx, calendario.ts
   * y tabla-semana.tsx ya la descartan en cuanto llega). Con esto no viaja ni
   * siquiera por la red. Por defecto se sigue incluyendo, que es lo que
   * necesitan informes/estadísticas/proyecto para no dejar fuera algo que sí
   * usan.
   */
  soloTerminadas?: boolean
}): Promise<EntradaVista[]> {
  const supabase = await createClient()

  let consulta = supabase
    .from("v_entries")
    .select("*")
    .eq("workspace_id", opciones.espacioId)
    .gte("local_date", opciones.desde)
    .lte("local_date", opciones.hasta)
    .order("start_at", { ascending: false })

  if (opciones.userId) consulta = consulta.eq("user_id", opciones.userId)
  if (opciones.projectId) consulta = consulta.eq("project_id", opciones.projectId)
  if (opciones.soloTerminadas) consulta = consulta.not("end_at", "is", null)
  if (opciones.limite) consulta = consulta.limit(opciones.limite)

  const { data, error } = await consulta
  if (error) throw error

  return (data ?? []) as EntradaVista[]
}

/** Horas que otra persona ha apuntado contando conmigo, sin contestar todavía. */
export async function cargarPropuestas(espacioId: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc("mis_invitaciones", { p_workspace: espacioId })
  return data ?? []
}

/** El equipo de un espacio, con el rol que tiene cada uno allí. */
export async function cargarMiembros(espacioId: string): Promise<Miembro[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("workspace_members")
    .select("role, active, profiles(id, full_name, email, sin_cuenta)")
    .eq("workspace_id", espacioId)

  return (data ?? [])
    .flatMap((fila) =>
      fila.profiles
        ? [
            {
              id: fila.profiles.id,
              full_name: fila.profiles.full_name,
              email: fila.profiles.email,
              role: fila.role,
              active: fila.active,
              sin_cuenta: fila.profiles.sin_cuenta,
            },
          ]
        : [],
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

/** Como se reparte la facturacion de cada proyecto/edicion entre las personas. */
export async function cargarReparto(
  espacioId: string,
): Promise<{ repartos: Reparto[]; shares: RepartoShare[] }> {
  const supabase = await createClient()

  const [repartos, shares] = await Promise.all([
    supabase.from("revenue_splits").select("*").eq("workspace_id", espacioId),
    supabase
      .from("revenue_split_shares")
      .select("*, revenue_splits!inner(workspace_id)")
      .eq("revenue_splits.workspace_id", espacioId),
  ])

  return {
    repartos: (repartos.data ?? []) as Reparto[],
    shares: (shares.data ?? []).map(({ split_id, user_id, percent }) => ({
      split_id,
      user_id,
      percent,
    })),
  }
}
