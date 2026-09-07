import { redirect } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { veTodo } from "@/lib/roles"
import { RUTA_APP } from "@/lib/rutas"
import { SubNav } from "@/components/sub-nav"

export default async function LayoutGestion({
  children,
}: {
  children: React.ReactNode
}) {
  const { rol } = await getSesion()
  if (!veTodo(rol)) redirect(RUTA_APP)

  const enlaces = [
    { href: "/gestion", etiqueta: "Catálogo", exacto: true },
    { href: "/gestion/categorias", etiqueta: "Categorización" },
    { href: "/gestion/equipo", etiqueta: "Equipo" },
    { href: "/gestion/tarifas", etiqueta: "Tarifas", soloAdmin: true },
    { href: "/gestion/importar", etiqueta: "Importar" },
    { href: "/gestion/ajustes", etiqueta: "Ajustes", soloAdmin: true },
    { href: "/gestion/suscripcion", etiqueta: "Cuota", soloAdmin: true },
  ].filter((e) => !e.soloAdmin || rol === "admin")

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Gestión</h1>
        <p className="mt-0.5 text-sm text-muted">
          Proyectos, categorización, equipo, tarifas, los ajustes del espacio
          y la cuota.
        </p>
      </div>
      <SubNav enlaces={enlaces} />
      {children}
    </div>
  )
}
