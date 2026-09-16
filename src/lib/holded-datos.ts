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
  const [conexion, proyectos, enlazados, ajustes, enlaces] = await Promise.all([
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
      .from("holded_enlaces")
      .select("holded_project_id, project_results!inner(label, edition_id, projects(name))")
      .eq("workspace_id", espacioId)
      .not("result_id", "is", null),
    cierreIds.length
      ? supabase
          .from("result_adjustments")
          .select("id, result_id, field, amount, note, holded_document, created_by, created_at")
          .in("result_id", cierreIds)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    cierreIds.length
      ? supabase
          .from("holded_enlaces")
          .select("holded_project_id, result_id, income, expenses, synced_at")
          .in("result_id", cierreIds)
      : Promise.resolve({ data: [] }),
  ])

  const mapaEnlazados: Record<string, string> = {}
  for (const e of enlazados.data ?? []) {
    const r = e.project_results
    const proyecto = r?.projects?.name ?? "otro proyecto"
    mapaEnlazados[e.holded_project_id] = r?.edition_id ? `${proyecto} · ${r.label}` : proyecto
  }

  return {
    conectado: Boolean(conexion.data),
    proyectos: proyectos.data ?? [],
    enlazados: mapaEnlazados,
    enlaces: (enlaces.data ?? []).map((e) => ({
      holdedId: e.holded_project_id,
      resultId: e.result_id!,
      income: e.income === null ? null : Number(e.income),
      expenses: e.expenses === null ? null : Number(e.expenses),
      syncedAt: e.synced_at,
    })),
    ajustes: ((ajustes.data ?? []) as Ajuste[]).map((a) => ({ ...a, amount: Number(a.amount) })),
    nombres: Object.fromEntries(miembros.map((m) => [m.id, m.full_name])),
  }
}
