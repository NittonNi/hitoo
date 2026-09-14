import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getSesion } from "@/lib/sesion"
import { puedeGestionar, soloMira, veTodo } from "@/lib/roles"
import {
  cargarCatalogo,
  cargarEntradas,
  cargarMiembros,
  cargarPropuestas,
  ultimaFechaAntes,
} from "@/lib/datos"
import { AvisoSemana } from "@/components/aviso-semana"
import { BarraCronometro } from "@/components/barra-cronometro"
import { ListaEntradas } from "@/components/lista-entradas"
import { ResumenCronometro } from "@/components/resumen-cronometro"
import { PropuestasPendientes } from "@/components/propuestas-pendientes"
import { SelectorPersonaVista } from "@/components/selector-persona-vista"
import { COOKIE_SEMANA_OMITIDA } from "@/lib/cookies"
import { estaOmitida } from "@/lib/semana-omitida"
import { addDays, fromDateKey, startOfWeek, toDateKey, todayKey } from "@/lib/time"

export const metadata = { title: "Cronómetro" }

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

export default async function PaginaCronometro({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string; desde?: string }>
}) {
  const parametros = await searchParams
  const { perfil, espacio, rol } = await getSesion()

  const [catalogo, miembros, propuestas] = await Promise.all([
    cargarCatalogo(espacio.id),
    cargarMiembros(espacio.id),
    cargarPropuestas(espacio.id),
  ])

  /* Quien ve las horas de todo el equipo puede mirar el cronómetro de otra
     persona, solo para mirar. Si el id no es de este espacio, las tuyas. */
  const otra =
    veTodo(rol) && parametros.persona && parametros.persona !== perfil.id
      ? miembros.find((m) => m.id === parametros.persona)
      : undefined
  const personaId = otra?.id ?? perfil.id

  // El coach no apunta horas: sin mirar a nadie, entra directo a ver cómo va el equipo
  if (soloMira(rol) && !otra) redirect("/estadisticas")

  /* Todo en el día del espacio, no en el reloj del servidor, que va en UTC */
  const hoy = todayKey(espacio.timezone)
  const lunes = toDateKey(startOfWeek(new Date(), espacio.timezone))
  const inicioMes = hoy.slice(0, 8) + "01"
  const haceVeinte = toDateKey(addDays(fromDateKey(hoy), -20))
  /* Por semanas enteras: si se corta un miércoles, el total de esa semana
     miente. «Ver semanas anteriores» baja `desde` en la URL. */
  const porDefecto = toDateKey(
    startOfWeek(fromDateKey(inicioMes < haceVeinte ? inicioMes : haceVeinte)),
  )
  const pedido = ES_FECHA.test(parametros.desde ?? "")
    ? toDateKey(startOfWeek(fromDateKey(parametros.desde!)))
    : null
  const desde = pedido && pedido < porDefecto ? pedido : porDefecto

  const [entradas, anterior] = await Promise.all([
    cargarEntradas({
      espacioId: espacio.id,
      desde,
      hasta: hoy,
      userId: personaId,
      soloTerminadas: true,
    }),
    ultimaFechaAntes(espacio.id, personaId, desde),
  ])

  /* Lo siguiente que se carga: cuatro semanas más o, si antes hay un hueco
     largo, hasta las cuatro semanas que acaban en la última hora de antes */
  const cuatroMas = toDateKey(addDays(fromDateKey(desde), -28))
  const siguienteDesde = anterior
    ? [cuatroMas, toDateKey(addDays(startOfWeek(fromDateKey(anterior)), -21))].sort()[0]
    : null

  const cerradas = entradas.filter((e) => e.end_at)
  const segsHoy = cerradas
    .filter((e) => e.local_date === hoy)
    .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const semana = cerradas.filter((e) => e.local_date >= lunes)
  const segsSemana = semana.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const facturables = semana.filter((e) => e.billable)
  const segsFacturables = facturables.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const proyectosFacturables = new Set(
    facturables.flatMap((e) => (e.project_id ? [e.project_id] : [])),
  ).size
  const segsMes = cerradas
    .filter((e) => e.local_date >= inicioMes)
    .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const diasConHoras = new Set(semana.map((e) => e.local_date)).size

  /* Los dias de esta semana que siguen a cero, de lunes a hoy y sin contar el
     fin de semana: es lo que se descubre tarde y mal, al cerrar el mes. */
  const conHoras = new Set(semana.map((e) => e.local_date))
  const lunesFecha = fromDateKey(lunes)
  const vacios: string[] = []
  for (let i = 0; i < 7; i++) {
    const dia = addDays(lunesFecha, i)
    const clave = toDateKey(dia)
    if (clave > hoy) break
    if (dia.getDay() === 0 || dia.getDay() === 6) continue
    if (!conHoras.has(clave)) vacios.push(clave)
  }
  // Si esta semana ya se omitió en este espacio, el servidor ni lo pinta
  const omitida = estaOmitida(
    (await cookies()).get(COOKIE_SEMANA_OMITIDA)?.value,
    lunes,
    espacio.id,
  )

  return (
    <div className="space-y-5">
      {!otra && (
        <>
          <BarraCronometro
            catalogo={catalogo}
            miembros={miembros.filter((m) => m.active && m.id !== perfil.id)}
          />
          <PropuestasPendientes propuestas={propuestas} />
        </>
      )}

      {veTodo(rol) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SelectorPersonaVista yoId={perfil.id} personaId={personaId} miembros={miembros} />
          {otra && <span className="text-xs text-muted">Solo para mirar</span>}
        </div>
      )}

      <ResumenCronometro
        espacioId={espacio.id}
        cifras={{
          hoy: segsHoy,
          semana: segsSemana,
          facturableSemana: segsFacturables,
          proyectosFacturables,
          mes: segsMes,
          diasConHoras,
          objetivoDia: espacio.goal_daily_minutes,
          objetivoSemana: espacio.goal_weekly_minutes,
        }}
      />

      {!otra && vacios.length > 0 && !omitida && (
        <AvisoSemana dias={vacios.map(nombreDia)} lunes={lunes} espacioId={espacio.id} />
      )}

      {!otra && catalogo.proyectos.length === 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Aún no hay proyectos</p>
            <p className="mt-0.5 text-sm text-muted">
              {puedeGestionar(rol)
                ? "Las horas se apuntan contra un proyecto. Crea el primero y ya puedes cronometrar."
                : "Las horas se apuntan contra un proyecto. Pide a un administrador que cree los del equipo."}
            </p>
          </div>
          {puedeGestionar(rol) && (
            <Link href="/gestion" className="btn btn-primary">
              Crear proyecto
            </Link>
          )}
        </div>
      )}

      <ListaEntradas
        entradas={entradas}
        catalogo={catalogo}
        miembros={miembros.filter((m) => m.active)}
        objetivoDia={espacio.goal_daily_minutes}
        objetivoSemana={espacio.goal_weekly_minutes}
        soloLectura={Boolean(otra)}
        deQuien={otra?.full_name}
        anteriores={
          anterior && siguienteDesde ? { ultima: anterior, desde: siguienteDesde } : null
        }
      />
    </div>
  )
}

/** "el martes", para poder enumerarlos en una frase. */
function nombreDia(clave: string) {
  const dia = fromDateKey(clave).toLocaleDateString("es-ES", { weekday: "long" })
  return "el " + dia
}
