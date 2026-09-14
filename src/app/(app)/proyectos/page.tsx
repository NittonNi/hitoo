import { getSesion } from "@/lib/sesion"
import { puedeGestionar, veTodo } from "@/lib/roles"
import { cargarCatalogo } from "@/lib/datos"
import { createClient } from "@/lib/supabase/server"
import {
  PanelProyectos,
  type ResumenProyecto,
} from "@/components/panel-proyectos"

export const metadata = { title: "Proyectos" }

export default async function PaginaProyectos() {
  const { espacio, rol } = await getSesion()
  const gestor = veTodo(rol)

  const supabase = await createClient()
  const [catalogo, resumen] = await Promise.all([
    // Con archivados: se pueden mirar desde el filtro de estado
    cargarCatalogo(espacio.id, true),
    supabase.rpc("resumen_proyectos", { p_workspace: espacio.id }),
  ])

  return (
    <PanelProyectos
      espacioId={espacio.id}
      proyectos={catalogo.proyectos}
      tareas={catalogo.tareas}
      categorias={catalogo.categorias}
      resumen={(resumen.data ?? []) as ResumenProyecto[]}
      gestor={gestor}
      puedeCrear={puedeGestionar(rol)}
    />
  )
}
