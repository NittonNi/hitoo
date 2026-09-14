import { getSesion } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/server"
import { cargarMiembros } from "@/lib/datos"
import { GestionEquipo } from "@/components/gestion-equipo"
import { GestionPlazas } from "@/components/gestion-plazas"
import { puedeGestionar } from "@/lib/roles"
import type { Invitacion } from "@/lib/tipos"

export const metadata = { title: "Equipo" }

export default async function PaginaEquipo() {
  const { perfil, espacio, rol } = await getSesion()
  const supabase = await createClient()

  const [miembros, invitaciones, plazas, horas] = await Promise.all([
    cargarMiembros(espacio.id),
    supabase
      .from("invitations")
      .select("*")
      .eq("workspace_id", espacio.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_seats")
      // Dos claves van a profiles (quien la cogio y la persona sin cuenta con
      // sus horas): sin nombrar la clave, PostgREST no sabe cual unir
      .select("id, name, email, claimed_by, provisional_id, profiles!workspace_seats_claimed_by_fkey(full_name)")
      .eq("workspace_id", espacio.id)
      .order("name"),
    supabase.rpc("horas_por_persona", { p_workspace: espacio.id }),
  ])

  const horasDe = new Map((horas.data ?? []).map((h) => [h.user_id, h]))
  const listaPlazas = (plazas.data ?? []).map((p) => {
    const suyas = p.provisional_id ? horasDe.get(p.provisional_id) : undefined
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      claimed_by: p.claimed_by,
      quien: p.profiles?.full_name ?? null,
      con_horas: p.provisional_id !== null,
      segundos: suyas?.segundos ?? 0,
      ultima: suyas?.ultima ?? null,
    }
  })

  // Las plazas con horas cuelgan de una persona sin cuenta, que es miembro
  // para que sus horas salgan en informes; en Equipo ya sale como plaza
  const conCuenta = miembros.filter((m) => !m.sin_cuenta)

  // Cuanta gente va a haber en el espacio: quien ya esta dentro, mas los
  // nombres apuntados que todavia no ha cogido nadie. Un hueco ya cogido
  // cuenta como su persona, no dos veces.
  const personas =
    conCuenta.filter((m) => m.active).length +
    listaPlazas.filter((p) => !p.claimed_by).length

  return (
    <div className="space-y-5">
      {puedeGestionar(rol) && (
        <GestionPlazas espacio={espacio} plazas={listaPlazas} personas={personas} />
      )}

      <GestionEquipo
        yoId={perfil.id}
        rol={rol}
        espacio={espacio}
        miembros={conCuenta}
        invitaciones={(invitaciones.data ?? []) as Invitacion[]}
      />
    </div>
  )
}
