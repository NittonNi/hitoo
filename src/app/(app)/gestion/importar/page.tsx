import { getSesion } from "@/lib/sesion"
import { cargarCatalogo, cargarMiembros } from "@/lib/datos"
import { ImportadorClockify } from "@/components/importador-clockify"

export const metadata = { title: "Importar" }

export default async function PaginaImportar() {
  const { perfil, espacio, rol } = await getSesion()

  const [catalogo, miembros] = await Promise.all([
    cargarCatalogo(espacio.id),
    cargarMiembros(espacio.id),
  ])

  return (
    <ImportadorClockify
      espacioId={espacio.id}
      timeZone={espacio.timezone}
      yoId={perfil.id}
      rol={rol}
      catalogo={catalogo}
      miembros={miembros.filter((m) => m.active)}
    />
  )
}
