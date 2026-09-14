import { createClient } from "@/lib/supabase/server"
import type { Ajuste, DatosHolded } from "@/lib/holded"
import type { Miembro } from "@/lib/tipos"

/**
 * Lo de Holded que necesita la ficha de un proyecto, leído con la sesión de
 * quien mira (la RLS solo deja a quien ve importes). No llama a Holded: todo
 * sale de la copia guardada.
 */
export async function cargarHoldedDeProyecto(
  espacioId: string,
  cierreIds: string[],
  miembros: Miembro[],
): Promise<DatosHolded> {
  const supabase = await createClient()
  const [conexion, proyectos, enlazados, ajustes] = await Promise.all([
    supabase
      .from("holded_connections")
      .select("workspace_id")
      .eq("workspace_id", espacioId)
      .maybeSingle(),
    supabase
      .from("holded_projects")
      .select("holded_id, name, start_date")
      .eq("workspace_id", espacioId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("project_results")
      .select("holded_project_id, label, edition_id, projects(name)")
      .eq("workspace_id", espacioId)
      .not("holded_project_id", "is", null),
    cierreIds.length
      ? supabase
          .from("result_adjustments")
          .select("id, result_id, field, amount, note, holded_document, created_by, created_at")
          .in("result_id", cierreIds)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ])

  const mapaEnlazados: Record<string, string> = {}
  for (const r of enlazados.data ?? []) {
    if (!r.holded_project_id) continue
    const proyecto = r.projects?.name ?? "otro proyecto"
    mapaEnlazados[r.holded_project_id] = r.edition_id ? `${proyecto} · ${r.label}` : proyecto
  }

  return {
    conectado: Boolean(conexion.data),
    proyectos: proyectos.data ?? [],
    enlazados: mapaEnlazados,
    ajustes: ((ajustes.data ?? []) as Ajuste[]).map((a) => ({ ...a, amount: Number(a.amount) })),
    nombres: Object.fromEntries(miembros.map((m) => [m.id, m.full_name])),
  }
}
