import type { EntradaEnMarcha, Pertenencia } from "@/lib/tipos"

/**
 * Pasado este rato, un cronómetro en marcha seguramente se ha olvidado: sale
 * una línea que lo pregunta, sea del espacio que sea. Antes, el de otro
 * espacio no se ve.
 */
export const SEGUNDOS_OLVIDO = 10 * 3600

/** Un cronómetro tuyo que corre en otro espacio: lo justo para avisar y pararlo. */
export type EnMarchaEnOtroEspacio = {
  id: string
  start_at: string
  espacioId: string
  espacioNombre: string
}

/**
 * De tus entradas en marcha, las de los otros espacios, con su nombre y en el
 * orden del selector. El nombre sale de tus pertenencias: si ya no estás en
 * ese espacio, lo suyo no se enseña.
 */
export function enMarchaEnOtrosEspacios(
  filas: readonly { id: string; workspace_id: string; start_at: string }[] | null,
  espacios: Pertenencia[],
  espacioActualId: string,
): EnMarchaEnOtroEspacio[] {
  return espacios.flatMap(({ espacio }) => {
    if (espacio.id === espacioActualId) return []
    const fila = filas?.find((f) => f.workspace_id === espacio.id)
    return fila
      ? [
          {
            id: fila.id,
            start_at: fila.start_at,
            espacioId: espacio.id,
            espacioNombre: espacio.name,
          },
        ]
      : []
  })
}

/**
 * Tiene que ser un literal: si se construye concatenando, PostgREST pierde
 * la inferencia de tipos y el resultado sale como `GenericStringError`.
 */
export const SELECT_EN_MARCHA =
  "id, workspace_id, project_id, edition_id, task_id, description, start_at, billable, projects(id, name, color), tasks(id, name), time_entry_tags(tag_id)" as const

type FilaEnMarcha = {
  id: string
  workspace_id: string
  project_id: string | null
  edition_id: string | null
  task_id: string | null
  description: string
  start_at: string
  billable: boolean
  projects: {
    id: string
    name: string
    color: string
  } | null
  tasks: { id: string; name: string } | null
  time_entry_tags: { tag_id: string }[]
}

export function aEntradaEnMarcha(fila: unknown): EntradaEnMarcha | null {
  if (!fila) return null
  const f = fila as FilaEnMarcha
  return {
    id: f.id,
    workspace_id: f.workspace_id,
    project_id: f.project_id,
    edition_id: f.edition_id,
    task_id: f.task_id,
    description: f.description,
    start_at: f.start_at,
    billable: f.billable,
    proyecto: f.projects
      ? {
          id: f.projects.id,
          name: f.projects.name,
          color: f.projects.color,
        }
      : null,
    tarea: f.tasks ? { id: f.tasks.id, name: f.tasks.name } : null,
    tagIds: (f.time_entry_tags ?? []).map((t) => t.tag_id),
  }
}
