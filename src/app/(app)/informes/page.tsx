import { getSesion } from "@/lib/sesion"
import { PistaPagina } from "@/components/pista-pagina"
import { esAdmin, veTodo } from "@/lib/roles"
import { cargarCatalogo, cargarEntradas, cargarMiembros, hayTarifas } from "@/lib/datos"
import { PanelInformes } from "@/components/panel-informes"
import { todayKey } from "@/lib/time"

export const metadata = { title: "Informes" }

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

export default async function PaginaInformes({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const parametros = await searchParams
  const { perfil, espacio, rol } = await getSesion()
  const gestor = veTodo(rol)

  // Por defecto, el mes en curso, contado en el día del espacio y no en el del servidor
  const hoy = todayKey(espacio.timezone)
  const desde = ES_FECHA.test(parametros.desde ?? "") ? parametros.desde! : hoy.slice(0, 8) + "01"
  const hasta = ES_FECHA.test(parametros.hasta ?? "") ? parametros.hasta! : hoy

  const [catalogo, entradas, miembros, conTarifas] = await Promise.all([
    cargarCatalogo(espacio.id, true),
    // Las horas del espacio son del espacio: se ven todas y se corrigen todas
    cargarEntradas({
      espacioId: espacio.id,
      desde,
      hasta,
    }),
    cargarMiembros(espacio.id),
    gestor ? hayTarifas(espacio.id) : Promise.resolve(false),
  ])

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-semibold tracking-tight">Informes</h1>
        <p className="mt-0.5 text-sm text-muted">
          Filtra, exporta y corrige las horas del periodo. Pulsa una para
          cambiarla, o elige varias para arreglarlas de golpe.
        </p>
      </div>

      <PistaPagina clave="informes" perfilId={perfil.id}>
        Los filtros aceptan varios a la vez. Pulsa una hora para corregirla, o
        marca unas cuantas y arréglalas de golpe.
      </PistaPagina>

      <PanelInformes
        entradas={entradas}
        catalogo={catalogo}
        // También quien está desactivado: sus horas siguen en el periodo, y
        // sin él en la lista, «marcar todos» las dejaba fuera
        miembros={miembros}
        desde={desde}
        hasta={hasta}
        puedeVerImportes={gestor}
        puedeAbrirCerradas={esAdmin(rol)}
        hayTarifas={conTarifas}
      />
    </div>
  )
}
