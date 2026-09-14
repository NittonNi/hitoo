import { getSesion } from "@/lib/sesion"
import { PistaPagina } from "@/components/pista-pagina"
import { veTodo } from "@/lib/roles"
import {
  cargarCatalogo,
  cargarEntradasEstadisticas,
  cargarMiembros,
  cargarReparto,
  hayTarifas,
} from "@/lib/datos"
import { PanelEstadisticas } from "@/components/panel-estadisticas"
import { todayKey } from "@/lib/time"

export const metadata = { title: "Estadísticas" }

export default async function PaginaEstadisticas() {
  const { perfil, espacio, rol } = await getSesion()
  const gestor = veTodo(rol)

  /* Dos años: uno para mirar y otro para poder compararlo con el anterior sin
     que la comparación salga siempre vacía. Cubre tambien de sobra la semana
     actual, que hace falta para los objetivos. */
  const hoy = todayKey(espacio.timezone)
  const desde = `${Number(hoy.slice(0, 4)) - 2}-${hoy.slice(5, 7)}-01`

  const [catalogo, entradas, miembros, reparto, conTarifas] = await Promise.all([
    cargarCatalogo(espacio.id, true),
    cargarEntradasEstadisticas(espacio.id, desde, hoy),
    cargarMiembros(espacio.id),
    cargarReparto(espacio.id),
    gestor ? hayTarifas(espacio.id) : Promise.resolve(false),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Estadísticas</h1>
        <p className="mt-0.5 text-sm text-muted">
          Cómo vais: el ritmo, en qué se va el tiempo y quién lo pone.
        </p>
      </div>

      <PistaPagina clave="estadisticas" perfilId={perfil.id}>
        Acota el periodo arriba y compáralo con el anterior. Con «Presentar» se
        pone a pantalla completa para enseñarlo en una reunión.
      </PistaPagina>

      <PanelEstadisticas
        entradas={entradas}
        catalogo={catalogo}
        // También quien está desactivado: sus horas del periodo siguen contando
        miembros={miembros}
        hayTarifas={conTarifas}
        perfilId={perfil.id}
        puedeVerImportes={gestor}
        objetivoHora={espacio.target_hourly_rate}
        objetivoDiaMinutos={espacio.goal_daily_minutes}
        objetivoSemanaMinutos={espacio.goal_weekly_minutes}
        repartos={reparto.repartos}
        repartoShares={reparto.shares}
      />
    </div>
  )
}
