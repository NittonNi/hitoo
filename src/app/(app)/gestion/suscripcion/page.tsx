import { redirect } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { esAdmin } from "@/lib/roles"
import { getSuscripcion } from "@/lib/suscripcion"
import { GestionSuscripcion } from "@/components/gestion-suscripcion"

export const metadata = { title: "Suscripción" }

export default async function PaginaSuscripcion() {
  const { espacio, rol } = await getSesion()
  // Lo que se paga lo lleva quien administra, como el resto de Gestión
  if (!esAdmin(rol)) redirect("/gestion")

  return <GestionSuscripcion suscripcion={await getSuscripcion(espacio.id)} />
}
