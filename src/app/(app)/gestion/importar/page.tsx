import { getSesion } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/server"
import { cargarCatalogo, cargarMiembros } from "@/lib/datos"
import { ImportadorClockify } from "@/components/importador-clockify"

export const metadata = { title: "Importar" }

export default async function PaginaImportar() {
  const { perfil, espacio, rol } = await getSesion()
  const supabase = await createClient()

  const [catalogo, miembros, plazas] = await Promise.all([
    // Con lo archivado: si no, reimportar crearía otra vez los proyectos que se archivaron
    cargarCatalogo(espacio.id, true),
    cargarMiembros(espacio.id),
    supabase
      .from("workspace_seats")
      .select("name, email, claimed_by, provisional_id")
      .eq("workspace_id", espacio.id),
  ])

  return (
    <ImportadorClockify
      espacioId={espacio.id}
      timeZone={espacio.timezone}
      yoId={perfil.id}
      rol={rol}
      catalogo={catalogo}
      miembros={miembros.filter((m) => m.active)}
      plazas={(plazas.data ?? []).map((p) => ({
        nombre: p.name,
        email: p.email,
        // Quien la cogió, o la persona sin cuenta que guarda sus horas
        personaId: p.claimed_by ?? p.provisional_id,
      }))}
    />
  )
}
