import { getSesion } from "@/lib/sesion"
import { soloMira, veTodo } from "@/lib/roles"
import { PistaPagina } from "@/components/pista-pagina"
import {
  cargarCatalogo,
  cargarEntradas,
  cargarMiembros,
  cargarPropuestas,
} from "@/lib/datos"
import { eventosDeGoogle } from "@/app/(app)/calendario/acciones"
import { RejillaCalendario } from "@/components/rejilla-calendario"
import { AjustesCalendarioGoogle } from "@/components/ajustes-calendario-google"
import { SelectorPersonaVista } from "@/components/selector-persona-vista"
import {
  addDays,
  fromDateKey,
  startOfDayInZone,
  startOfWeek,
  toDateKey,
} from "@/lib/time"

export const metadata = { title: "Calendario" }

export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; error_google?: string; persona?: string }>
}) {
  const parametros = await searchParams
  const { perfil, espacio, rol } = await getSesion()

  const lunes = /^\d{4}-\d{2}-\d{2}$/.test(parametros.semana ?? "")
    ? toDateKey(startOfWeek(fromDateKey(parametros.semana!)))
    : toDateKey(startOfWeek(new Date(), espacio.timezone))
  const domingo = toDateKey(addDays(fromDateKey(lunes), 6))
  const siguienteLunes = toDateKey(addDays(fromDateKey(domingo), 1))

  const miembros = await cargarMiembros(espacio.id)

  /* El calendario es de cada uno: tus horas, que se tocan. Quien ve las de todo
     el equipo puede mirar el de otra persona, sin tocarlo. El coach no apunta,
     así que el suyo también es solo para mirar. */
  const otra =
    veTodo(rol) && parametros.persona && parametros.persona !== perfil.id
      ? miembros.find((m) => m.id === parametros.persona)
      : undefined
  const personaId = otra?.id ?? perfil.id
  const soloLectura = Boolean(otra) || soloMira(rol)

  const [catalogo, entradas, propuestas, resultadoGoogle] = await Promise.all([
    cargarCatalogo(espacio.id),
    cargarEntradas({
      espacioId: espacio.id,
      desde: lunes,
      hasta: domingo,
      userId: personaId,
      soloTerminadas: true,
    }),
    soloLectura ? Promise.resolve([]) : cargarPropuestas(espacio.id),
    // La misma semana que se esta viendo, ni un dia mas: si se navega a otra
    // semana, vuelve a pedirse. Los dos limites son medianoche real (huso del
    // workspace), no fromDateKey() -que da mediodia en el huso del proceso y
    // dejaba fuera cualquier reunion que terminara antes del mediodia del
    // lunes-. `hasta` es medianoche del dia siguiente al domingo, para no
    // perder las horas de ultima hora del domingo.
    soloLectura
      ? Promise.resolve({ conectado: false as const })
      : eventosDeGoogle(
          startOfDayInZone(lunes, espacio.timezone).toISOString(),
          startOfDayInZone(siguienteLunes, espacio.timezone).toISOString(),
          espacio.id,
          perfil.id,
        ),
  ])

  const googleConectado = resultadoGoogle.conectado
  const eventosGoogle = resultadoGoogle.conectado && "eventos" in resultadoGoogle
    ? resultadoGoogle.eventos
    : []

  /* Las propuestas son mias, asi que solo pintan cuando miro mi semana, y solo
     las de esta semana: en otra no habria donde ponerlas. */
  const propuestasDeLaSemana = propuestas.filter((p) => {
    const dia = toDateKey(new Date(p.start_at))
    return dia >= lunes && dia <= domingo
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Calendario</h1>
          {/* En el movil la pantalla es el sitio mas caro que hay: el titulo
              ya dice donde estas, y la frase se queda para el escritorio. */}
          <p className="mt-0.5 hidden text-sm text-muted md:block">
            {soloLectura
              ? "Solo para mirar."
              : "Las horas de la semana colocadas donde de verdad ocurrieron."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {veTodo(rol) && (
            <SelectorPersonaVista yoId={perfil.id} personaId={personaId} miembros={miembros} />
          )}
          {!soloLectura && (
            <AjustesCalendarioGoogle
              conectado={googleConectado}
              falloGoogle={parametros.error_google ?? null}
            />
          )}
        </div>
      </div>

      {!soloLectura && (
        <PistaPagina clave="calendario" perfilId={perfil.id}>
          Arrastra sobre un hueco para apuntar un rato, y arrastra un bloque para
          moverlo. En el móvil, mantén el dedo pulsado antes de arrastrar.
        </PistaPagina>
      )}

      <RejillaCalendario
        entradas={entradas}
        propuestas={propuestasDeLaSemana}
        eventosGoogle={eventosGoogle}
        catalogo={catalogo}
        lunes={lunes}
        espacioId={espacio.id}
        yoId={perfil.id}
        miembros={miembros.filter((m) => m.active)}
        soloLectura={soloLectura}
        personaVista={otra?.id}
      />
    </div>
  )
}
