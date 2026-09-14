import { redirect } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { esAdmin, veTodo } from "@/lib/roles"
import { cargarCatalogo } from "@/lib/datos"
import { createClient } from "@/lib/supabase/server"
import { sugerirEnlaces, type CierrePosible } from "@/lib/holded"
import { GestionHolded } from "@/components/gestion-holded"

export const metadata = { title: "Holded" }

export default async function PaginaHolded() {
  const { espacio, rol } = await getSesion()
  if (!veTodo(rol)) redirect("/gestion")

  const supabase = await createClient()
  const [catalogo, conexion, proyectos, cierres] = await Promise.all([
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
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("project_results")
      .select("id, project_id, edition_id, holded_project_id, income, expenses")
      .eq("workspace_id", espacio.id),
  ])

  /* Dónde puede ir el dinero: cada edición, o el proyecto entero si no tiene
     ediciones. Los proyectos archivados no se proponen. */
  const enlaceDe = new Map(
    (cierres.data ?? []).map((c) => [`${c.project_id}|${c.edition_id ?? ""}`, c]),
  )
  const posibles: (CierrePosible & { etiqueta: string; income: number | null; expenses: number | null })[] = []
  for (const p of catalogo.proyectos) {
    const suyas = catalogo.ediciones.filter((e) => e.project_id === p.id)
    const sitios = suyas.length
      ? suyas.map((e) => ({ edicionId: e.id as string | null, etiqueta: `${p.name} · ${e.name}`, nombre: `${p.name} ${e.name}`, archivado: p.archived || e.archived }))
      : [{ edicionId: null, etiqueta: p.name, nombre: p.name, archivado: p.archived }]
    for (const s of sitios) {
      const cierre = enlaceDe.get(`${p.id}|${s.edicionId ?? ""}`)
      if (s.archivado && !cierre?.holded_project_id) continue
      posibles.push({
        proyectoId: p.id,
        edicionId: s.edicionId,
        nombre: s.nombre,
        etiqueta: s.etiqueta,
        holdedId: cierre?.holded_project_id ?? null,
        income: cierre?.holded_project_id ? Number(cierre.income) : null,
        expenses: cierre?.holded_project_id ? Number(cierre.expenses) : null,
      })
    }
  }

  const listado = proyectos.data ?? []
  const sugerencias = sugerirEnlaces(listado, posibles)

  return (
    <GestionHolded
      esAdmin={esAdmin(rol)}
      conexion={conexion.data}
      proyectos={listado}
      cierres={posibles}
      sugerencias={Object.fromEntries(
        [...sugerencias].map(([holdedId, c]) => [holdedId, { proyectoId: c.proyectoId, edicionId: c.edicionId }]),
      )}
    />
  )
}
