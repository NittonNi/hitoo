import { redirect } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { esAdmin, veTodo } from "@/lib/roles"
import { cargarCatalogo } from "@/lib/datos"
import { createClient } from "@/lib/supabase/server"
import { montarModelo } from "@/lib/editor-holded"
import { ConexionHolded } from "@/components/conexion-holded"
import { EditorHolded } from "@/components/editor-holded"

export const metadata = { title: "Holded" }

export default async function PaginaHolded() {
  const { espacio, rol } = await getSesion()
  if (!veTodo(rol)) redirect("/gestion")

  const supabase = await createClient()
  const [catalogo, conexion, proyectos, cierres, enlaces, horas] = await Promise.all([
    cargarCatalogo(espacio.id, true),
    supabase
      .from("holded_connections")
      .select("key_last4, connected_at, last_synced_at, last_error, usage_count, usage_limit")
      .eq("workspace_id", espacio.id)
      .maybeSingle(),
    supabase
      .from("holded_projects")
      .select("holded_id, name, start_date")
      .eq("workspace_id", espacio.id)
      .order("name"),
    supabase
      .from("project_results")
      .select("id, project_id, edition_id, income, expenses")
      .eq("workspace_id", espacio.id),
    supabase
      .from("holded_enlaces")
      .select("holded_project_id, result_id, income, expenses")
      .eq("workspace_id", espacio.id),
    supabase.rpc("horas_por_sitio", { p_workspace: espacio.id }),
  ])

  const modelo = montarModelo({
    proyectos: catalogo.proyectos,
    ediciones: catalogo.ediciones,
    holded: proyectos.data ?? [],
    cierres: cierres.data ?? [],
    enlaces: enlaces.data ?? [],
    horas: (horas.data ?? []) as { p: string; e: string | null; s: number; f: number }[],
  })

  return (
    <div className="space-y-5">
      <ConexionHolded esAdmin={esAdmin(rol)} conexion={conexion.data} />
      {conexion.data && <EditorHolded modelo={modelo} />}
    </div>
  )
}
