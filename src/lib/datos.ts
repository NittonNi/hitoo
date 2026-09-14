import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { FILAS_POR_PAGINA, porTandas, quincenas, traerTodo } from "@/lib/paginar"
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

  const consulta = (desde = opciones.desde, hasta = opciones.hasta) => {
    let c = supabase
      .from("v_entries")
      .select("*")
      .eq("workspace_id", opciones.espacioId)
      .gte("local_date", desde)
      .lte("local_date", hasta)
      .order("start_at", { ascending: false })
      .order("id", { ascending: false })

    if (opciones.userId) c = c.eq("user_id", opciones.userId)
    if (opciones.projectId) c = c.eq("project_id", opciones.projectId)
    if (opciones.soloTerminadas) c = c.not("end_at", "is", null)
    return c
  }

  if (opciones.limite && opciones.limite <= FILAS_POR_PAGINA) {
    const { data, error } = await consulta().limit(opciones.limite)
    if (error) throw error
    return (data ?? []) as EntradaVista[]
  }

  // Más de 1000 filas no llegan de una vez (ver paginar.ts). La ficha de
  // proyecto ya va acotada por proyecto: le basta con paginar. Un periodo
  // largo de todo el espacio -un informe de un año- va por quincenas.
  const filas = opciones.projectId
    ? await traerTodo((d, h) => consulta().range(d, h))
    : (
        await porTandas(
          quincenas(opciones.desde, opciones.hasta).map(
            ([desde, hasta]) =>
              () => traerTodo((d, h) => consulta(desde, hasta).range(d, h)),
          ),
        )
      ).flat()

  return (opciones.limite ? filas.slice(0, opciones.limite) : filas) as EntradaVista[]
}

/**
 * El día de la última hora terminada de una persona antes de `antesDe`, o null.
 * Con horas viejas y un hueco largo -una plaza de Clockify de hace un año-,
 * «semanas anteriores» salta hasta ahí en vez de ir de cuatro en cuatro por
 * semanas vacías.
 */
export async function ultimaFechaAntes(
  espacioId: string,
  userId: string,
  antesDe: string,
): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("time_entries")
    .select("local_date")
    .eq("workspace_id", espacioId)
    .eq("user_id", userId)
    .not("end_at", "is", null)
    .lt("local_date", antesDe)
    .order("local_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.local_date ?? null
}

/**
 * Las horas de un periodo largo para estadísticas, en una sola llamada
 * (`entradas_estadisticas`). Por `v_entries` la RLS se mira fila a fila: dos
 * años de NITTON eran 17 s; así, un cuarto de segundo. No trae la descripción
 * ni lo de compartir, que estadísticas no usa: llegan vacíos.
 */
export async function cargarEntradasEstadisticas(
  espacioId: string,
  desde: string,
  hasta: string,
): Promise<EntradaVista[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("entradas_estadisticas", {
    p_workspace: espacioId,
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) throw error

  return ((data ?? []) as Omit<
    EntradaVista,
    "description" | "updated_by" | "updated_by_name" | "compartida_con" | "venida_de" | "venida_de_id"
  >[]).map((fila) => ({
    ...fila,
    description: "",
    updated_by: null,
    updated_by_name: null,
    compartida_con: [],
    venida_de: null,
    venida_de_id: null,
  }))
}

/**
 * Si el espacio tiene alguna tarifa. Sin ninguna, todo importe sale a 0 € y es
 * mejor decir «sin tarifas» que pintar ceros que parecen un dato.
 */
export async function hayTarifas(espacioId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("rates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", espacioId)
  return (count ?? 0) > 0
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
