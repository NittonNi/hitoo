import { notFound } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { puedeGestionar, veTodo } from "@/lib/roles"
import { cargarCatalogo, cargarEntradas, cargarMiembros } from "@/lib/datos"
import { createClient } from "@/lib/supabase/server"
import { DetalleProyecto } from "@/components/detalle-proyecto"
import type { Resultado } from "@/components/resultados-proyecto"
import { todayKey } from "@/lib/time"

/** Todo lo que se ha apuntado nunca en este proyecto. */
const DESDE_SIEMPRE = "2000-01-01"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { espacio } = await getSesion()
  const catalogo = await cargarCatalogo(espacio.id, true)
  const proyecto = catalogo.proyectos.find((p) => p.id === id)
  return { title: proyecto?.name ?? "Proyecto" }
}

export default async function PaginaProyecto({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { espacio, rol } = await getSesion()
  const gestor = veTodo(rol)

  const supabase = await createClient()
  const [catalogo, entradas, resultados, miembros] =
    await Promise.all([
    cargarCatalogo(espacio.id, true),
    cargarEntradas({
      espacioId: espacio.id,
      desde: DESDE_SIEMPRE,
      hasta: todayKey(espacio.timezone),
      projectId: id,
      limite: 2000,
    }),
    supabase
      .from("project_results")
      .select("id, edition_id, label, starts_on, ends_on, income, expenses, notes")
      .eq("project_id", id)
      .order("starts_on", { ascending: false }),
    cargarMiembros(espacio.id),
  ])

  const proyecto = catalogo.proyectos.find((p) => p.id === id)
  if (!proyecto) notFound()

  const ediciones = catalogo.ediciones.filter((e) => e.project_id === id)

  return (
    <DetalleProyecto
      proyecto={proyecto}
      categorias={catalogo.categorias}
      tareas={catalogo.tareas.filter((t) => t.project_id === id)}
      ediciones={ediciones}
      entradas={entradas}
      resultados={(resultados.data ?? []) as Resultado[]}
      catalogo={catalogo}
      miembros={miembros.filter((m) => m.active)}
      objetivoDelEquipo={espacio.target_hourly_rate}
      espacioId={espacio.id}
      puedeGestionar={puedeGestionar(rol)}
      puedeVerImportes={gestor}
    />
  )
}
