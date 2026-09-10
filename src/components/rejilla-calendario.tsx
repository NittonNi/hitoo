"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Euro,
  Loader2,
  Users,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useSesion } from "@/components/proveedor-sesion"
import { useAvisos } from "@/components/avisos"
import { CampoHora } from "@/components/campo-hora"
import { DialogoEntrada } from "@/components/dialogo-entrada"
import { SelectorPersonas } from "@/components/selector-personas"
import {
  FiltrosDeHoras,
  filtrarHoras,
  hayFiltros,
  SIN_FILTROS,
  type Filtros,
} from "@/components/filtros-horas"
import { SelectorProyecto } from "@/components/selector-proyecto"
import { SelectorEtiquetas } from "@/components/selector-etiquetas"
import {
  ALTO_HORA,
  comoHora,
  comoHoraInput,
  DIA_ENTERO,
  horaParaEmpezar,
  limitar,
  minutosDe,
  minutosDeHora,
  redondear,
  repartir,
  type Bloque,
} from "@/lib/calendario"
import {
  addDays,
  formatClock,
  formatDurationShort,
  fromDateKey,
  startOfWeek,
  toDateKey,
  todayKey,
} from "@/lib/time"
import type { Catalogo, EntradaVista, Miembro } from "@/lib/tipos"
import type { Propuesta } from "@/components/propuestas-pendientes"
import type { EventoGoogle } from "@/lib/google"
import { useEsMovil } from "@/lib/pantalla"
import { cn } from "@/lib/utils"

type Arrastre =
  | { tipo: "crear"; dia: string; ancla: number; hasta: number }
  | { tipo: "mover"; id: string; dia: string; desde: number; hasta: number; pinza: number }
  /* `pinza` es el rabo escondido: lo que va del tirador -que se dibuja a las
     24:00- al final de verdad. Sin el, estirar un rato de madrugada lo acorta. */
  | { tipo: "redim"; id: string; dia: string; desde: number; hasta: number; pinza: number }

type Nuevo = { dia: string; desde: number; hasta: number }

const Minimo = 15

/** Las propuestas se pintan en la rejilla; se reconocen por el id. */
const MARCA = "propuesta:"
/** Los eventos de Google llegan por fuera y se marcan igual, con otro prefijo. */
const MARCA_GOOGLE = "google:"

function esPropuesta(id: string) {
  return id.startsWith(MARCA)
}

function esGoogle(id: string) {
  return id.startsWith(MARCA_GOOGLE)
}

/**
 * Una propuesta vestida de hora para poder colocarla en la rejilla. Lo unico
 * que se usa de aqui es cuando empieza, cuando acaba y de que color es.
 */
function propuestaComoEntrada(p: Propuesta): EntradaVista {
  return {
    id: MARCA + p.id,
    workspace_id: "",
    user_id: "",
    user_name: p.de,
    updated_by: null,
    updated_by_name: null,
    project_id: null,
    project_name: p.project_name,
    project_color: p.project_color,
    category_id: null,
    category_name: null,
    subcategory_name: null,
    edition_id: null,
    edition_name: null,
    task_id: null,
    task_name: null,
    description: p.description,
    start_at: p.start_at,
    end_at: p.end_at,
    local_date: "",
    duration_seconds: null,
    hours: null,
    billable: p.billable,
    locked: true,
    tags: [],
    compartida_con: [],
    venida_de: null,
    amount: null,
  }
}

/**
 * Un evento de Google vestido de hora, igual que una propuesta: sin proyecto
 * -Google no sabe de eso- y sin nadie que lo haya apuntado por ti.
 */
function eventoGoogleComoEntrada(e: EventoGoogle): EntradaVista {
  return {
    id: MARCA_GOOGLE + e.id,
    workspace_id: "",
    user_id: "",
    user_name: "",
    updated_by: null,
    updated_by_name: null,
    project_id: null,
    project_name: null,
    project_color: null,
    category_id: null,
    category_name: null,
    subcategory_name: null,
    edition_id: null,
    edition_name: null,
    task_id: null,
    task_name: null,
    description: e.titulo,
    start_at: e.inicio,
    end_at: e.fin,
    local_date: "",
    duration_seconds: null,
    hours: null,
    billable: false,
    locked: true,
    tags: [],
    compartida_con: [],
    venida_de: null,
    amount: null,
  }
}

export function RejillaCalendario({
  entradas,
  propuestas = [],
  eventosGoogle = [],
  catalogo,
  lunes,
  espacioId,
  yoId,
  miembros,
}: {
  entradas: EntradaVista[]
  /** Horas que alguien ha apuntado contando conmigo y no he contestado. */
  propuestas?: Propuesta[]
  /** Reuniones aceptadas en Google Calendar, pendientes de apuntar aqui. */
  eventosGoogle?: EventoGoogle[]
  catalogo: Catalogo
  lunes: string
  espacioId: string
  yoId: string
  miembros: Miembro[]
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const refColumnas = useRef<HTMLDivElement>(null)
  const arrastreRef = useRef<Arrastre | null>(null)

  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const [nuevo, setNuevo] = useState<Nuevo | null>(null)
  const [editando, setEditando] = useState<EntradaVista | null>(null)
  const [contestando, setContestando] = useState<Propuesta | null>(null)
  const [aceptandoGoogle, setAceptandoGoogle] = useState<EventoGoogle | null>(null)
  const esMovil = useEsMovil()
  const [diaMovil, setDiaMovil] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => new Date())
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)

  /* El calendario es de uso personal: siempre son tus horas. Para mirar -o
     corregir- las de otra persona estan los informes, que es donde eso tiene
     sentido. */
  const hoy = todayKey()

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toDateKey(addDays(fromDateKey(lunes), i))),
    [lunes],
  )

  /* Lo que se pinta. Filtrar tambien cambia los totales: si la semana enseña
     un proyecto, el numero de arriba tiene que ser el de ese proyecto y no el
     de todo, que si no no cuadra con lo que se ve. */
  const visibles = useMemo(() => filtrarHoras(entradas, filtros), [entradas, filtros])
  const filtrando = hayFiltros(filtros)

  /* Las propuestas y los eventos de Google se colocan en la rejilla igual que
     las horas -para que no se pisen unas con otras- pero llevan el id
     marcado: ni se arrastran ni suman en el total del dia, porque no son
     tuyas hasta que dices que si. */
  const comoEntradas = useMemo(
    () => [
      ...propuestas.map(propuestaComoEntrada),
      ...eventosGoogle.map(eventoGoogleComoEntrada),
    ],
    [propuestas, eventosGoogle],
  )

  const porDia = useMemo(() => {
    const mapa = new Map<string, Bloque[]>()
    const todo = [...visibles, ...comoEntradas]
    for (const dia of dias) {
      // Sin filtrar por local_date: un rato que cruza la medianoche le toca a
      // dos dias, y cada uno se queda con su trozo.
      mapa.set(dia, repartir(todo, dia))
    }
    return mapa
  }, [visibles, comoEntradas, dias])

  // El dia entero, siempre: apuntar a las 6 o a las 23 tiene que ser posible
  const franja = DIA_ENTERO
  const alto = ((franja.hasta - franja.desde) / 60) * ALTO_HORA

  // La linea del momento actual, al minuto
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  /* Al abrir la semana, el scroll cae donde empieza la jornada */
  const refScroll = useRef<HTMLDivElement>(null)
  const semanaVista = useRef<string | null>(null)
  useEffect(() => {
    if (semanaVista.current === lunes) return
    semanaVista.current = lunes
    const minuto = horaParaEmpezar([...porDia.values()].flat())
    refScroll.current?.scrollTo({ top: (minuto / 60) * ALTO_HORA })
  }, [lunes, porDia])

  /* ------------------------------------------------------------- arrastre */

  /** De donde esta el raton a que dia y que minuto es eso. */
  function posicion(evento: { clientX: number; clientY: number }) {
    const caja = refColumnas.current!.getBoundingClientRect()
    const anchoDia = caja.width / dias.length
    const indice = Math.max(
      0,
      Math.min(dias.length - 1, Math.floor((evento.clientX - caja.left) / anchoDia)),
    )
    /* Sin recortar a las 24:00: arrastrar por debajo del dia es como se
       apunta un rato que termina de madrugada. Se para al mediodia siguiente,
       que ya es pasarse. */
    const crudo = redondear(franja.desde + ((evento.clientY - caja.top) / ALTO_HORA) * 60)
    const minutos = Math.max(0, Math.min(36 * 60, crudo))
    return { dia: dias[indice], minutos }
  }

  /**
   * Los escuchadores se enganchan aquí mismo, no en un efecto: si se suelta el
   * raton antes de que React vuelva a pintar, el efecto llegaria tarde y el
   * arrastre se quedaria colgado.
   */
  function iniciar(inicial: Arrastre) {
    arrastreRef.current = inicial
    setArrastre(inicial)

    const mover = (evento: PointerEvent) => {
      const previo = arrastreRef.current
      if (!previo) return
      const { dia, minutos } = posicion(evento)

      let siguiente: Arrastre
      if (previo.tipo === "crear") {
        siguiente = { ...previo, dia, hasta: minutos }
      } else if (previo.tipo === "redim") {
        const fin = Math.min(36 * 60, minutos + previo.pinza)
        siguiente = { ...previo, hasta: Math.max(previo.desde + Minimo, fin) }
      } else {
        // mover: se conserva la duracion y se respeta por donde se agarro. El
        // final puede caer en el dia siguiente, que es lo normal de noche.
        const duracion = previo.hasta - previo.desde
        const inicio = Math.max(0, Math.min(24 * 60 - Minimo, minutos - previo.pinza))
        siguiente = { ...previo, dia, desde: inicio, hasta: inicio + duracion }
      }

      arrastreRef.current = siguiente
      setArrastre(siguiente)
    }

    const soltar = () => {
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
      const final = arrastreRef.current
      arrastreRef.current = null
      setArrastre(null)
      if (!final) return

      /* Un clic seco sobre una hora ya apuntada no es un arrastre: abre la
         tarjeta y no toca nada. Guardarlo "igual que estaba" es justo lo que
         recortaba a medianoche los ratos de madrugada. */
      const quieto =
        inicial.tipo !== "crear" &&
        final.tipo !== "crear" &&
        final.dia === inicial.dia &&
        final.desde === inicial.desde &&
        final.hasta === inicial.hasta
      if (quieto) return

      void confirmar(final)
    }

    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", soltar)
  }

  /**
   * Con el raton, apretar ya es arrastrar. Con el dedo no: deslizar hacia
   * abajo es bajar por la pantalla, no apuntar tres horas. Asi que en tactil
   * hay que mantener pulsado un momento -como en el calendario del telefono-
   * y si el dedo se mueve antes, se entiende que estabas desplazando.
   */
  function iniciarSegunPuntero(
    evento: React.PointerEvent<HTMLElement>,
    inicial: Arrastre,
  ) {
    if (evento.pointerType !== "touch") {
      iniciar(inicial)
      return
    }

    const desdeX = evento.clientX
    const desdeY = evento.clientY
    let vivo = true

    const limpiar = () => {
      vivo = false
      clearTimeout(espera)
      window.removeEventListener("pointermove", alMover)
      window.removeEventListener("pointerup", limpiar)
      window.removeEventListener("pointercancel", limpiar)
    }

    const alMover = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - desdeX) > 8 || Math.abs(ev.clientY - desdeY) > 8) {
        limpiar()
      }
    }

    const espera = setTimeout(() => {
      if (!vivo) return
      limpiar()
      navigator.vibrate?.(10)
      iniciar(inicial)
    }, 350)

    window.addEventListener("pointermove", alMover)
    window.addEventListener("pointerup", limpiar)
    window.addEventListener("pointercancel", limpiar)
  }

  async function confirmar(final: Arrastre) {
    if (final.tipo === "crear") {
      const desde = Math.min(final.ancla, final.hasta)
      const hasta = Math.max(final.ancla, final.hasta)
      // Un clic seco, sin arrastrar, crea una hora
      const fin = hasta - desde < Minimo ? desde + 60 : hasta
      setNuevo({ dia: final.dia, desde, hasta: fin })
      return
    }

    setError(null)
    const supabase = createClient()
    // Donde estaba antes, para poder devolverlo de un toque
    const antes = entradas.find((e) => e.id === final.id)
    /* Con `select` se ve si de verdad ha cambiado una fila: sin el, una hora
       bloqueada o una sesion caducada devuelven "todo bien" sin guardar nada y
       el bloque se vuelve a su sitio sin decir por que. */
    const { data, error: err } = await supabase
      .from("time_entries")
      .update({
        start_at: instante(final.dia, final.desde),
        end_at: instante(final.dia, final.hasta),
      })
      .eq("id", final.id)
      .select("id")

    if (err) {
      setError(mensajeError(err))
      avisar("No se ha podido guardar: " + mensajeError(err), undefined, "mal")
      return
    }

    if (!data || data.length === 0) {
      const aviso =
        "Esa hora no se ha guardado. Puede estar cerrada o haberse acabado tu sesión: recarga la página."
      setError(aviso)
      avisar(aviso, undefined, "mal")
      return
    }
    router.refresh()

    avisar(
      final.tipo === "mover" ? "Hora movida." : "Hora actualizada.",
      antes
        ? async () => {
            const { error: errVolver } = await createClient()
              .from("time_entries")
              .update({ start_at: antes.start_at, end_at: antes.end_at })
              .eq("id", final.id)
            if (errVolver) throw new Error(mensajeError(errVolver))
            router.refresh()
            return "Como estaba."
          }
        : undefined,
    )
  }

  function irA(nuevoLunes: string) {
    router.push(`/calendario?semana=${nuevoLunes}`)
  }

  const totalSemana = visibles.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)

  /**
   * En el movil se ve **un solo dia**, como en Clockify: siete columnas en una
   * pantalla de telefono no son un calendario, son una cuadricula ilegible. La
   * tira de arriba sigue siendo la semana, para saltar de dia con el dedo.
   *
   * Empieza en hoy si hoy cae en la semana que se esta mirando, y si no en el
   * lunes. En escritorio no cambia nada: la semana entera.
   */
  const elegido = diaMovil && dias.includes(diaMovil) ? diaMovil : null
  const diaVisto = esMovil
    ? (elegido ?? (dias.includes(hoy) ? hoy : dias[0]))
    : elegido
  /* Los siete se pintan siempre. En movil se ve uno -la tira mide siete
     pantallas y se desplaza-, pero estan los siete en su sitio: eso es lo que
     deja que al deslizar asome el dia de al lado en vez de cambiar de golpe.
     Las horas de la semana ya estaban cargadas, asi que no cuesta nada. */
  const diasPintados = dias
  const indiceDia = Math.max(0, dias.indexOf(diaVisto ?? dias[0]))

  /**
   * El desliz de lado. `desliz` es donde empezo el dedo -y si el gesto ya se
   * ha decidido horizontal-, y `dx` lo que se ha movido: la rejilla lo sigue
   * en vivo, y al soltar cae en su sitio con una transicion corta. Un salto
   * seco de un dia a otro se lee como un parpadeo, no como pasar de pagina.
   */
  const desliz = useRef<{ x: number; y: number; deLado: boolean } | null>(null)
  const [dx, setDx] = useState(0)

  /**
   * El cambio de semana, que es el unico salto que queda: el dia siguiente al
   * domingo vive en otra semana y hay que ir a buscarla al servidor. Para que
   * no aparezca de golpe, la tira **sale** medio paso hacia donde ibas y se
   * apaga un poco; cuando llegan los dias nuevos **entra** desde el lado
   * contrario. El movimiento no se corta: solo se estira mientras carga.
   */
  const cruzando = useRef(0)
  const [saliendo, setSaliendo] = useState(0)
  const [entrando, setEntrando] = useState(0)

  useEffect(() => {
    if (cruzando.current === 0) return
    const hacia = cruzando.current
    cruzando.current = 0
    setSaliendo(0)
    // Colocada fuera y sin transicion; en el frame siguiente, a su sitio
    setEntrando(hacia)
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntrando(0)),
    )
    return () => cancelAnimationFrame(id)
  }, [lunes])

  /** Cambia de dia, saltando de semana cuando el dia cae fuera. */
  function moverDia(paso: number) {
    const nuevo = toDateKey(addDays(fromDateKey(diaVisto ?? dias[0]), paso))
    setDiaMovil(nuevo)
    const suLunes = toDateKey(startOfWeek(fromDateKey(nuevo)))
    if (suLunes === lunes) return
    cruzando.current = paso
    setSaliendo(paso)
    irA(suLunes)
  }

  /* ---------------------------------------------------------------- vista */

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        {/* En movil no hay flechas: se pasa de dia deslizando sobre la
            rejilla, o tocando el dia en la tira de arriba. Dos mandos para lo
            mismo, uno de ellos ocupando sitio, no valen la pena. */}
        {!esMovil && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => irA(toDateKey(addDays(fromDateKey(lunes), -7)))}
              className="btn p-2"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => irA(toDateKey(addDays(fromDateKey(lunes), 7)))}
              className="btn p-2"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* En movil, el dia que se esta mirando; en escritorio, la semana */}
        <p className="text-sm font-medium">
          {esMovil && diaVisto
            ? fromDateKey(diaVisto).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : `${fromDateKey(lunes).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
              })} - ${fromDateKey(dias[6]).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`}
        </p>

        {/* Mirando un solo dia, el total de la semana no dice nada de lo que
            tienes delante: en movil cuenta ese dia. */}
        <span className={cn("chip", filtrando && "border-accent text-accent")}>
          {formatDurationShort(
            esMovil && diaVisto
              ? visibles
                  .filter((e) => e.local_date === diaVisto)
                  .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
              : totalSemana,
          )}
          {filtrando && " filtradas"}
        </span>

        {/* Por area, por proyecto y por etiqueta: para mirar una semana con
            los ojos puestos en una sola cosa. En el movil no salen -tres
            desplegables ocupaban mas que el propio calendario, y ahi se mira
            un dia, no se analiza-. Para eso estan Informes. */}
        <div className="no-print hidden flex-wrap items-center gap-2 md:flex">
          <FiltrosDeHoras catalogo={catalogo} valor={filtros} onChange={setFiltros} />
        </div>

        {/* A la derecha lo de moverse por el tiempo; a la izquierda, donde
            estas. Asi la cabecera no es una fila de cosas sueltas. */}
        <div className="ml-auto flex items-center gap-2">
          {(esMovil
            ? diaVisto !== hoy
            : lunes !== toDateKey(startOfWeek(new Date()))) && (
            <button
              type="button"
              onClick={() => {
                irA(toDateKey(startOfWeek(new Date())))
                if (esMovil) setDiaMovil(hoy)
              }}
              className="btn h-8 text-sm"
            >
              {esMovil ? "Hoy" : "Esta semana"}
            </button>
          )}

          {/* Saltar a cualquier dia sin ir de uno en uno. En escritorio abre la
              semana que lo contiene; en movil va a ese dia. */}
          <label
            className="relative flex items-center"
            title={esMovil ? "Ir a un día" : "Ir a una semana"}
          >
            {/* El icono propio solo en escritorio: en el movil el campo de
                fecha del sistema ya trae el suyo y se montaban uno encima del
                otro -mas desde que los campos van a 16px en movil, que el
                texto ensancho y se comio el hueco-. */}
            {!esMovil && (
              <CalendarDays
                className="pointer-events-none absolute left-2 h-4 w-4 text-muted"
                aria-hidden
              />
            )}
            <input
              type="date"
              value={esMovil ? (diaVisto ?? lunes) : lunes}
              onChange={(e) => {
                if (!e.target.value) return
                const elegido = toDateKey(fromDateKey(e.target.value))
                if (esMovil) setDiaMovil(elegido)
                irA(toDateKey(startOfWeek(fromDateKey(elegido))))
              }}
              className={cn(
                "field tabular h-8 text-sm",
                esMovil ? "w-auto px-2" : "w-[9.5rem] pl-7",
              )}
              aria-label={esMovil ? "Ir a este día" : "Ir a la semana de este día"}
            />
          </label>
        </div>

      </div>

      {error && (
        <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="card overflow-hidden">
        {/* cabecera de dias */}
        <div
          className={cn(
            "grid border-b border-line",
            esMovil
              ? "grid-cols-7"
              : "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]",
          )}
        >
          {!esMovil && <div />}
          {dias.map((dia) => {
            const fecha = fromDateKey(dia)
            const esHoy = dia === hoy
            /* Cuenta en el dia en que empezo, aunque el dibujo siga en el
               siguiente: si no, un rato de 21:00 a 02:00 sumaria dos veces. */
            const segundos = visibles
              .filter((e) => e.local_date === dia)
              .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaMovil(dia)}
                aria-current={dia === diaVisto ? "date" : undefined}
                title={esMovil ? "Ver este día" : undefined}
                className={cn(
                  "border-l border-line px-1 py-2 text-center transition sm:px-2",
                  esHoy && "bg-live-soft",
                  dia === diaVisto && "bg-surface-2",
                  esMovil ? "cursor-pointer" : "cursor-default",
                )}
              >
                <p className="rotulo">
                  {fecha.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
                </p>
                {/* El numero del dia, en circulo cuando es hoy: es lo que
                    hace que se encuentre de un vistazo en una tira estrecha */}
                <p
                  className={cn(
                    "cifra text-lg font-semibold",
                    // El circulo es cosa del movil, donde la tira es lo que
                    // guia; en escritorio se queda como estaba
                    esMovil
                      ? "mx-auto grid h-7 w-7 place-items-center leading-none"
                      : "leading-tight",
                    /* En movil el circulo naranja va con el dia que estas
                       mirando, que es lo que cambia al deslizar; hoy, si no
                       es ese, se queda con el numero en naranja. En
                       escritorio no hay dia elegido: el naranja es hoy. */
                    esMovil && dia === diaVisto && "rounded-full bg-live-fill text-white",
                    esMovil && esHoy && dia !== diaVisto && "text-live",
                    !esMovil && esHoy && "text-live",
                  )}
                >
                  {fecha.getDate()}
                </p>
                {/* En la tira del movil no cabe 01:00:00: solo un punto que
                    dice que ese dia tiene horas */}
                <p className="cifra hidden text-[11px] text-muted sm:block">
                  {segundos > 0 ? formatDurationShort(segundos) : "-"}
                </p>
                <span
                  aria-hidden
                  className={cn(
                    "mx-auto mt-1 block h-1 w-1 rounded-full sm:hidden",
                    segundos > 0 ? "bg-line-strong" : "bg-transparent",
                  )}
                />
              </button>
            )
          })}
        </div>

        {/* rejilla */}
        <div ref={refScroll} className="scroll-thin max-h-[70vh] overflow-y-auto">
          <div
            className={cn(
              "grid",
              esMovil
                ? "grid-cols-[3.25rem_1fr]"
                : "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]",
            )}
          >
            {/* columna de horas */}
            <div className="relative" style={{ height: alto }}>
              {Array.from(
                { length: (franja.hasta - franja.desde) / 60 + 1 },
                (_, i) => franja.desde + i * 60,
              ).map((minuto) => (
                <span
                  key={minuto}
                  // Justo debajo de su linea: la hora rotula la franja que abre
                  className="rotulo absolute right-2 leading-none"
                  style={{ top: ((minuto - franja.desde) / 60) * ALTO_HORA + 4 }}
                >
                  {minuto < 24 * 60 ? comoHora(minuto) : ""}
                </span>
              ))}
            </div>

            {/* columnas de dias */}
            {/* En movil, la ventana por la que se ve un dia: la tira de dentro
                mide siete y se mueve con el dedo. */}
            <div className={cn(esMovil && "overflow-hidden", !esMovil && "col-span-7")}
              /* `pan-y`: el navegador se queda con el gesto vertical -que es
                 rodar la pagina- y nos deja el horizontal, que es el nuestro.
                 Con un bloque en la mano no hay ninguno de los dos. */
              style={{ touchAction: arrastre ? "none" : esMovil ? "pan-y" : undefined }}
              onTouchStart={(e) => {
                if (!esMovil || arrastre || e.touches.length !== 1) return
                desliz.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  deLado: false,
                }
              }}
              onTouchMove={(e) => {
                const empezo = desliz.current
                if (!empezo || arrastre) return
                const toca = e.touches[0]
                const avanceX = toca.clientX - empezo.x
                const avanceY = toca.clientY - empezo.y
                /* Hasta que el gesto no se declara -y se declara por donde
                   tira mas-, no se mueve nada: si no, rodar la pagina movia
                   el calendario de lado un pelin en cada roce. */
                if (!empezo.deLado) {
                  if (Math.abs(avanceX) < 12 && Math.abs(avanceY) < 12) return
                  empezo.deLado = Math.abs(avanceX) > Math.abs(avanceY)
                  if (!empezo.deLado) {
                    desliz.current = null
                    return
                  }
                }
                setDx(avanceX)
              }}
              onTouchEnd={(e) => {
                const empezo = desliz.current
                desliz.current = null
                if (!empezo?.deLado || arrastre) return setDx(0)
                const avanceX = e.changedTouches[0].clientX - empezo.x
                setDx(0)
                // Un tercio de la pantalla, o un gesto corto pero decidido
                const suficiente = Math.min(
                  110,
                  (refColumnas.current?.getBoundingClientRect().width ?? 700) / 7 / 3,
                )
                if (Math.abs(avanceX) >= suficiente) moverDia(avanceX < 0 ? 1 : -1)
              }}
            >
            <div
              ref={refColumnas}
              className={cn("grid grid-cols-7", esMovil && "w-[700%]")}
              style={{
                height: alto,
                /* Medio dia hacia donde va: lo justo para que se vea salir sin
                   dejar la pantalla en blanco mientras llega la semana. */
                transform: esMovil
                  ? `translateX(calc(${
                      (-indiceDia * 100) / 7 -
                      (saliendo * 100) / 14 +
                      (entrando * 100) / 14
                    }% + ${dx}px))`
                  : undefined,
                opacity: esMovil && (saliendo !== 0 || entrando !== 0) ? 0.45 : 1,
                /* Mientras el dedo manda no hay transicion -la rejilla va con
                   el-, y al soltar es la transicion la que la deja en su
                   sitio. Al entrar tampoco: primero se coloca fuera y solo
                   despues se anima, que si no se veria volver hacia atras. */
                transition:
                  esMovil && dx === 0 && entrando === 0
                    ? "transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.2s"
                    : "none",
              }}
            >
              {diasPintados.map((dia) => (
                <ColumnaDia
                  key={dia}
                  dia={dia}
                  esHoy={dia === hoy}
                  bloques={porDia.get(dia) ?? []}
                  franja={franja}
                  editable
                  arrastre={arrastre}
                  ahora={ahora}
                  onCrear={(minutos, e) =>
                    iniciarSegunPuntero(e, {
                      tipo: "crear",
                      dia,
                      ancla: minutos,
                      hasta: minutos,
                    })
                  }
                  /* Ojo: se arranca del fin de VERDAD, no del dibujado. Si se
                     cogiera `hasta`, tocar un rato que cruza la medianoche
                     -moverlo, estirarlo o solo hacerle clic- lo dejaria
                     acabando a las 24:00 y se perderian las horas de despues. */
                  onMover={(bloque, minutos, e) =>
                    iniciarSegunPuntero(e, {
                      tipo: "mover",
                      id: bloque.entrada.id,
                      dia,
                      desde: bloque.desde,
                      hasta: bloque.finReal,
                      pinza: minutos - bloque.desde,
                    })
                  }
                  onRedimensionar={(bloque, e) =>
                    iniciarSegunPuntero(e, {
                      tipo: "redim",
                      id: bloque.entrada.id,
                      dia,
                      desde: bloque.desde,
                      hasta: bloque.finReal,
                      pinza: bloque.finReal - bloque.hasta,
                    })
                  }
                  onAbrir={(entrada) => setEditando(entrada)}
                  onContestar={(id) =>
                    setContestando(
                      propuestas.find((p) => MARCA + p.id === id) ?? null,
                    )
                  }
                  onAceptarGoogle={(id) =>
                    setAceptandoGoogle(
                      eventosGoogle.find((e) => MARCA_GOOGLE + e.id === id) ?? null,
                    )
                  }
                />
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>

      <p className="no-print text-xs text-muted">
        <span className="hidden md:inline">
          Arrastra sobre un hueco para apuntar horas. Mueve un bloque para
          cambiarlo de sitio, o estira su borde de abajo para alargarlo.
        </span>
        {/* Con el dedo la regla es otra: deslizar es bajar por la pantalla */}
        <span className="md:hidden">
          Mantén pulsado sobre un hueco para apuntar horas, o sobre un rato
          para moverlo. Deslizar sin más baja por el día.
        </span>
      </p>

      {nuevo && (
        <DialogoNuevaEntrada
          espacioId={espacioId}
          userId={yoId}
          catalogo={catalogo}
          miembros={miembros.filter((m) => m.id !== yoId)}
          nuevo={nuevo}
          onCerrar={() => setNuevo(null)}
        />
      )}

      {editando && (
        <DialogoEntrada
          entrada={editando}
          catalogo={catalogo}
          miembros={miembros}
          onCerrar={() => setEditando(null)}
        />
      )}

      {contestando && (
        <DialogoInvitacion
          propuesta={contestando}
          onCerrar={() => setContestando(null)}
        />
      )}

      {aceptandoGoogle && (
        <DialogoAceptarGoogle
          evento={aceptandoGoogle}
          espacioId={espacioId}
          userId={yoId}
          catalogo={catalogo}
          miembros={miembros.filter((m) => m.id !== yoId)}
          onCerrar={() => setAceptandoGoogle(null)}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------- una invitacion */

/**
 * Contestar desde el propio calendario, que es donde se ve si encaja con el
 * resto del dia. Aceptar crea una hora tuya; decir que no fuiste no le quita
 * nada a quien la apunto: la suya sigue igual.
 */
function DialogoInvitacion({
  propuesta,
  onCerrar,
}: {
  propuesta: Propuesta
  onCerrar: () => void
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Radix solo devuelve el foco solo si el boton que abre es un Dialog.Trigger;
     aqui se abre al tocar el bloque de la rejilla, asi que se guarda a mano
     quien tenia el foco justo antes de montarse. */
  const previoRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null,
  )

  async function responder(aceptar: boolean) {
    setOcupado(true)
    setError(null)
    const { error: err } = await createClient().rpc("responder_invitacion", {
      p_invitacion: propuesta.id,
      p_aceptar: aceptar,
    })
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    onCerrar()
    router.refresh()
    avisar(aceptar ? "Hora aceptada: ya es tuya." : "Rechazada.")
  }

  return (
    <Dialog.Root open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            previoRef.current?.focus()
          }}
          className="card fixed inset-x-0 bottom-0 z-50 w-full max-w-sm rounded-b-none sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-start gap-3 border-b border-line px-4 py-3">
            <span
              aria-hidden
              className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
              style={{ background: propuesta.project_color ?? "var(--line-strong)" }}
            />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold">
                {propuesta.description || "Sin descripción"}
              </Dialog.Title>
              <p className="mt-0.5 text-xs text-muted">
                {propuesta.de} ha apuntado estas horas contigo
              </p>
            </div>
          </div>

          <div className="space-y-1 px-4 py-3 text-sm">
            <p className="tabular">
              {formatClock(propuesta.start_at)}–{formatClock(propuesta.end_at)}
              <span className="text-muted">
                {" · "}
                {formatDurationShort(
                  Math.round(
                    (new Date(propuesta.end_at).getTime() -
                      new Date(propuesta.start_at).getTime()) /
                      1000,
                  ),
                )}
              </span>
            </p>
            {propuesta.project_name && (
              <p className="text-muted">{propuesta.project_name}</p>
            )}
            <p className="pt-1 text-xs text-muted">
              Hasta que no aceptes no se te apunta nada. Si aceptas se crea una
              hora tuya; la de {propuesta.de} se queda como está.
            </p>
            {error && <p className="pt-1 text-xs text-danger">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void responder(false)}
              className="btn"
            >
              <X className="h-3.5 w-3.5" />
              No fui
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void responder(true)}
              className="btn btn-primary"
            >
              {ocupado ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Aceptar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* --------------------------------------------------- un evento de Google */

/**
 * Aceptar una reunion de Google Calendar la convierte en una hora de verdad:
 * a diferencia de una invitacion de equipo, aqui no hay fila que aceptar en
 * la base -es un evento vivo, traido en el momento-, asi que "aceptar" es
 * sencillamente crear la entrada, con los mismos campos que una entrada
 * nueva. Lo unico que viene puesto es el dia y las horas, que son las que
 * ya estan en el calendario; todo lo demas -proyecto, tarea, etiquetas,
 * facturable, con quien mas cuenta- se elige aqui, igual que al mano.
 */
function DialogoAceptarGoogle({
  evento,
  espacioId,
  userId,
  catalogo,
  miembros,
  onCerrar,
}: {
  evento: EventoGoogle
  espacioId: string
  userId: string
  catalogo: Catalogo
  miembros: Miembro[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { espacio } = useSesion()
  const [descripcion, setDescripcion] = useState(evento.titulo)
  const [proyecto, setProyecto] = useState<{
    project_id: string | null
    task_id: string | null
  }>({ project_id: null, task_id: null })
  const [edicionId, setEdicionId] = useState<string | null>(null)
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [compartidos, setCompartidos] = useState<string[]>([])
  const [facturable, setFacturable] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El desplegable de proyecto tapa el resto de la tarjeta: el clic que lo
  // cierra no tiene que cerrar tambien el dialogo entero.
  const [proyectoAbierto, setProyectoAbierto] = useState(false)

  function elegirProyecto(sel: { project_id: string | null; task_id: string | null }) {
    setProyecto(sel)
    const encontrado = catalogo.proyectos.find((p) => p.id === sel.project_id)
    if (encontrado) setFacturable(encontrado.billable_default)
  }

  async function aceptar() {
    if (espacio.require_project && !proyecto.project_id) {
      setError("Elige un proyecto: este espacio no guarda horas sueltas.")
      return
    }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("time_entries")
      .insert({
        workspace_id: espacioId,
        user_id: userId,
        project_id: proyecto.project_id,
        edition_id: edicionId,
        task_id: proyecto.task_id,
        description: descripcion,
        billable: facturable,
        start_at: evento.inicio,
        end_at: evento.fin,
        source: "google_calendar",
        external_id: evento.id,
      })
      .select("id")
      .single()

    if (err || !data) {
      setGuardando(false)
      setError(mensajeError(err))
      return
    }

    if (etiquetas.length > 0) {
      const { error: errTags } = await supabase
        .from("time_entry_tags")
        .insert(etiquetas.map((tag_id) => ({ entry_id: data.id, tag_id })))
      if (errTags) {
        setGuardando(false)
        setError(mensajeError(errTags))
        return
      }
    }

    if (compartidos.length > 0) {
      const { error: errCompartir } = await supabase.from("entry_invitations").insert(
        compartidos.map((to_user) => ({
          workspace_id: espacioId,
          origin_entry_id: data.id,
          from_user: userId,
          to_user,
          project_id: proyecto.project_id,
          edition_id: edicionId,
          task_id: proyecto.task_id,
          description: descripcion,
          start_at: evento.inicio,
          end_at: evento.fin,
          billable: facturable,
        })),
      )
      if (errCompartir) {
        setGuardando(false)
        setError(
          `Tu hora se ha guardado, pero no se ha podido avisar al resto: ${mensajeError(errCompartir)}`,
        )
        return
      }
    }

    setGuardando(false)
    onCerrar()
    router.refresh()
    avisar("Hora añadida desde Google Calendar.", async () => {
      const cliente = createClient()
      // Si se propuso a alguien, esas invitaciones tambien se deshacen: que
      // nadie pueda aceptar una hora que ya se ha retirado.
      const { error: errInvitaciones } = await cliente
        .from("entry_invitations")
        .delete()
        .eq("origin_entry_id", data.id)
      if (errInvitaciones) throw new Error(mensajeError(errInvitaciones))
      const { error: errQuitar } = await cliente
        .from("time_entries")
        .delete()
        .eq("id", data.id)
      if (errQuitar) throw new Error(mensajeError(errQuitar))
      router.refresh()
      return "Quitada."
    })
  }

  return (
    <Dialog.Root open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (proyectoAbierto) e.preventDefault()
          }}
          className="card fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col rounded-b-none sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <Dialog.Title className="truncate text-sm font-semibold">
              {evento.titulo}
            </Dialog.Title>
            <p className="mt-0.5 text-xs tabular text-muted">
              Aceptada en tu Google Calendar · {formatClock(evento.inicio)}–
              {formatClock(evento.fin)}
              {" · "}
              {formatDurationShort(
                Math.round(
                  (new Date(evento.fin).getTime() - new Date(evento.inicio).getTime()) / 1000,
                ),
              )}
            </p>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3 text-sm">
          <div>
            <label className="label" htmlFor="ag-descripcion">
              En que has trabajado
            </label>
            <input
              id="ag-descripcion"
              autoFocus
              className="field"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <span className="label">Proyecto y tarea</span>
            <SelectorProyecto
              catalogo={catalogo}
              valor={{ ...proyecto, edition_id: edicionId }}
              onChange={(sel) => {
                setEdicionId(sel.edition_id)
                elegirProyecto(sel)
              }}
              onAbiertoChange={setProyectoAbierto}
            />
          </div>

          <div>
            <span className="label">Etiquetas</span>
            <SelectorEtiquetas
              etiquetas={catalogo.etiquetas}
              seleccionadas={etiquetas}
              onChange={setEtiquetas}
            />
          </div>

          <div>
            <span className="label">También cuenta para</span>
            <SelectorPersonas
              miembros={miembros}
              seleccionadas={compartidos}
              onChange={setCompartidos}
            />
            {compartidos.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Les llegara como una propuesta: hasta que la acepten no se les
                apunta nada.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFacturable((v) => !v)}
            aria-pressed={facturable}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-[var(--radio-sm)] border px-3 text-sm transition",
              facturable
                ? "border-billable-line bg-billable-soft text-billable"
                : "border-line-strong bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Euro className="h-4 w-4" />
            {facturable ? "Facturable" : "No facturable"}
          </button>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Dialog.Close disabled={guardando} className="btn">
            <X className="h-3.5 w-3.5" />
            Ignorar
          </Dialog.Close>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void aceptar()}
            className="btn btn-primary"
          >
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Aceptar
          </button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ------------------------------------------------------------------ un dia */

function ColumnaDia({
  dia,
  esHoy,
  bloques,
  franja,
  editable,
  arrastre,
  ahora,
  onCrear,
  onMover,
  onRedimensionar,
  onAbrir,
  onContestar,
  onAceptarGoogle,
}: {
  dia: string
  esHoy: boolean
  bloques: Bloque[]
  franja: { desde: number; hasta: number }
  editable: boolean
  arrastre: Arrastre | null
  ahora: Date
  onCrear: (minutos: number, evento: React.PointerEvent<HTMLElement>) => void
  onMover: (
    bloque: Bloque,
    minutos: number,
    evento: React.PointerEvent<HTMLElement>,
  ) => void
  onRedimensionar: (
    bloque: Bloque,
    evento: React.PointerEvent<HTMLElement>,
  ) => void
  onAbrir: (entrada: EntradaVista) => void
  onContestar: (id: string) => void
  onAceptarGoogle: (id: string) => void
}) {
  const arriba = (minutos: number) => ((minutos - franja.desde) / 60) * ALTO_HORA
  const minutosDelEvento = (e: React.PointerEvent<HTMLElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    return limitar(redondear(franja.desde + ((e.clientY - caja.top) / ALTO_HORA) * 60))
  }

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const enFranja = minutosAhora >= franja.desde && minutosAhora <= franja.hasta

  // El bloque que se esta arrastrando se pinta donde va a caer, no donde estaba
  const fantasma =
    arrastre?.tipo === "crear" && arrastre.dia === dia
      ? {
          desde: Math.min(arrastre.ancla, arrastre.hasta),
          hasta: Math.min(24 * 60, Math.max(arrastre.ancla, arrastre.hasta)),
        }
      : null

  return (
    <div
      className={cn(
        "relative border-l border-line",
        esHoy && "bg-live-soft/40",
        editable && "cursor-crosshair",
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${ALTO_HORA}px)`,
      }}
      onPointerDown={(e) => {
        if (!editable || e.button !== 0) return
        if ((e.target as HTMLElement).closest("[data-bloque]")) return
        onCrear(minutosDelEvento(e), e)
      }}
    >
      {esHoy && enFranja && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10 h-px bg-live-fill"
          style={{ top: arriba(minutosAhora) }}
        >
          <span className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-live-fill" />
        </div>
      )}

      {bloques.map((bloque) => {
        const arrastrandose =
          (arrastre?.tipo === "mover" || arrastre?.tipo === "redim") &&
          arrastre.id === bloque.entrada.id
        const desde = arrastrandose ? arrastre.desde : bloque.desde
        // El rato puede acabar de madrugada; el dibujo se para a medianoche y
        // el resto se ve en la columna del dia siguiente
        const hasta = Math.min(
          24 * 60,
          arrastrandose ? arrastre.hasta : bloque.hasta,
        )
        const finCrudo = arrastrandose ? arrastre.hasta : bloque.hasta
        const cruzaMedianoche = finCrudo > 24 * 60
        /* Lo que se lee es la hora de verdad -21:00-2:00-, no el corte de la
           medianoche; el +1 es quien dice que esas dos son del dia siguiente. */
        const finTexto = bloque.sigueManana
          ? comoHora(minutosDe(bloque.entrada.end_at!))
          : cruzaMedianoche
            ? comoHora(finCrudo - 24 * 60)
            : comoHora(hasta)
        const enOtroDia = arrastrandose && arrastre.dia !== dia
        if (enOtroDia) return null

        const color = bloque.entrada.project_color ?? "var(--line-strong)"
        const anchura = 100 / bloque.columnas
        // Propuesta sin contestar o reunion de Google: se pintan como una
        // invitacion, no como una hora tuya
        const invitacion = esPropuesta(bloque.entrada.id)
        const google = esGoogle(bloque.entrada.id)
        const pendiente = invitacion || google

        return (
          <div
            key={bloque.entrada.id + (bloque.vieneDeAyer ? "-sigue" : "")}
            data-bloque
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onAbrir(bloque.entrada)
              }
            }}
            onPointerDown={(e) => {
              // La continuacion del dia anterior no se arrastra: se toca la de
              // arriba, que es la que lleva la hora de inicio
              if (pendiente || !editable || bloque.vieneDeAyer || e.button !== 0) return
              e.stopPropagation()
              const caja = e.currentTarget.getBoundingClientRect()
              // los últimos 8 px de alto son el tirador para alargar
              if (e.clientY > caja.bottom - 8) onRedimensionar(bloque, e)
              else {
                const caso = limitar(
                  redondear(franja.desde + ((e.clientY - (caja.top - arriba(desde))) / ALTO_HORA) * 60),
                )
                onMover(bloque, caso, e)
              }
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (invitacion) {
                onContestar(bloque.entrada.id)
                return
              }
              if (google) {
                onAceptarGoogle(bloque.entrada.id)
                return
              }
              if (!arrastrandose) onAbrir(bloque.entrada)
            }}
            title={
              bloque.vieneDeAyer || bloque.sigueManana
                ? `${comoHora(minutosDe(bloque.entrada.start_at))} del día anterior a ${comoHora(minutosDe(bloque.entrada.end_at!))}  ${bloque.entrada.description || ""}`
                : `${comoHora(desde)} - ${comoHora(hasta)}  ${bloque.entrada.description || ""}`
            }
            className={cn(
              "absolute overflow-hidden rounded-[3px] px-1.5 py-1 text-left transition-shadow",
              /* Una hora tuya va rellena, con su raya de color a la izquierda.
                 Una propuesta sin contestar -o una reunion de Google sin
                 apuntar- van sin rellenar y con todo el borde a rayas: la
                 misma convencion que una invitacion de calendario sin
                 responder, para reconocerlas sin leer nada. */
              pendiente
                ? "cursor-pointer border-2 border-dashed bg-surface/60 hover:bg-surface"
                : "border-l-[3px] bg-surface shadow-sm ring-1 ring-inset",
              !pendiente && (bloque.entrada.billable ? "ring-billable-line" : "ring-line"),
              editable && !pendiente && !bloque.vieneDeAyer && "cursor-grab active:cursor-grabbing",
              arrastrandose && "opacity-80 shadow-lg",
              // El corte de medianoche se ve: el bloque no acaba ahi de verdad
              (bloque.sigueManana || cruzaMedianoche) &&
                "rounded-b-none border-b border-dashed border-b-live-line",
              bloque.vieneDeAyer && "rounded-t-none border-t border-dashed border-t-live-line",
            )}
            style={{
              top: arriba(desde),
              height: Math.max(16, ((hasta - desde) / 60) * ALTO_HORA - 2),
              left: `calc(${bloque.columna * anchura}% + 2px)`,
              width: `calc(${anchura}% - 4px)`,
              // En la invitacion el color va en todo el borde, no solo a un lado
              borderColor: pendiente ? color : undefined,
              borderLeftColor: color,
            }}
          >
            {/* En el movil las columnas son estrechas: el texto se parte en
                varias lineas en vez de quedarse en una letra y puntos */}
            <p
              className={cn(
                "line-clamp-3 break-all text-[11px] font-medium leading-tight md:truncate md:break-normal",
                bloque.entrada.billable && "pr-3.5",
              )}
              // Solo en las horas de verdad: en una pendiente el color ya va
              // en todo el borde, ponerlo tambien en el texto no suma nada
              // -y sin proyecto el gris de respaldo se leeria mal como texto.
              style={!pendiente ? { color } : undefined}
            >
              {bloque.entrada.description ||
                bloque.entrada.project_name ||
                (editable && !pendiente && !bloque.entrada.locked
                  ? "Añadir descripción"
                  : "Sin descripción")}
            </p>
            <p className="cifra truncate text-[10px] leading-tight text-muted">
              {invitacion && <span className="cifra-no">de {bloque.entrada.user_name} · </span>}
              {comoHora(desde)}-{finTexto}
              {/* El tiempo solo va hacia delante: el +1 avisa de que el rato
                  termina al dia siguiente. La continuacion no lleva marca; se
                  reconoce por el corte de puntos de arriba. */}
              {(bloque.sigueManana || cruzaMedianoche) && (
                <sup className="ml-0.5 font-semibold text-live" title="Sigue al día siguiente">
                  +1
                </sup>
              )}
            </p>
            {invitacion ? (
              <Users
                className="absolute right-1 top-1.5 h-3 w-3"
                style={{ color }}
                aria-hidden
              />
            ) : google ? (
              <CalendarDays
                className="absolute right-1 top-1.5 h-3 w-3"
                style={{ color }}
                aria-hidden
              />
            ) : (
              bloque.entrada.billable && (
                <Euro className="absolute right-1 top-1.5 h-3 w-3 text-billable" />
              )
            )}
            {editable && !bloque.sigueManana && !bloque.vieneDeAyer && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
              />
            )}
          </div>
        )
      })}

      {fantasma && (
        <div
          className="pointer-events-none absolute inset-x-0.5 rounded-[3px] border border-dashed border-accent bg-accent-soft px-1.5 py-1"
          style={{
            top: arriba(fantasma.desde),
            height: Math.max(14, ((fantasma.hasta - fantasma.desde) / 60) * ALTO_HORA),
          }}
        >
          <p className="cifra text-[10px] font-medium text-accent">
            {comoHora(fantasma.desde)}-{comoHora(fantasma.hasta)}
          </p>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------- entrada nueva */

function instante(dia: string, minutos: number): string {
  const [y, m, d] = dia.split("-").map(Number)
  return new Date(y, m - 1, d, Math.floor(minutos / 60), minutos % 60, 0, 0).toISOString()
}

function DialogoNuevaEntrada({
  espacioId,
  userId,
  catalogo,
  miembros,
  nuevo,
  onCerrar,
}: {
  espacioId: string
  userId: string
  catalogo: Catalogo
  miembros: Miembro[]
  nuevo: Nuevo
  onCerrar: () => void
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { espacio } = useSesion()
  const [descripcion, setDescripcion] = useState("")
  const [edicionId, setEdicionId] = useState<string | null>(null)
  const [proyecto, setProyecto] = useState<{
    project_id: string | null
    task_id: string | null
  }>({ project_id: null, task_id: null })
  const [facturable, setFacturable] = useState(false)
  const [compartidos, setCompartidos] = useState<string[]>([])
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El desplegable de proyecto tapa el resto de la tarjeta: el clic que lo
  // cierra no tiene que cerrar tambien el dialogo entero.
  const [proyectoAbierto, setProyectoAbierto] = useState(false)

  /* El arrastre solo propone: aquí se puede afinar la fecha y las horas */
  const [fecha, setFecha] = useState(nuevo.dia)
  const [horaInicio, setHoraInicio] = useState(comoHoraInput(nuevo.desde))
  // Si el arrastre paso de la medianoche, el fin es una hora del dia siguiente
  const [horaFin, setHoraFin] = useState(
    comoHoraInput(nuevo.hasta >= 24 * 60 ? nuevo.hasta - 24 * 60 : nuevo.hasta),
  )

  const minutosInicio = minutosDeHora(horaInicio)
  const minutosFin = minutosDeHora(horaFin)
  // Si el fin es menor que el inicio, es que cruza la medianoche
  const duracion =
    minutosInicio === null || minutosFin === null
      ? null
      : (minutosFin > minutosInicio ? minutosFin : minutosFin + 24 * 60) - minutosInicio

  function elegirProyecto(sel: { project_id: string | null; task_id: string | null }) {
    setProyecto(sel)
    const encontrado = catalogo.proyectos.find((p) => p.id === sel.project_id)
    if (encontrado) setFacturable(encontrado.billable_default)
  }

  async function guardar() {
    if (minutosInicio === null || duracion === null || duracion <= 0) {
      setError("Revisa las horas: el fin tiene que ser posterior al inicio.")
      return
    }
    if (espacio.require_project && !proyecto.project_id) {
      setError("Elige un proyecto: este espacio no guarda horas sueltas.")
      return
    }

    setGuardando(true)
    setError(null)

    // Componentes locales para los dos extremos, igual que en confirmar():
    // sumar milisegundos de duracion al epoch del inicio desplaza el fin una
    // hora si por medio hay un cambio de horario (DST).
    const inicio = instante(fecha, minutosInicio)
    const fin = instante(fecha, minutosInicio + duracion)

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("time_entries")
      .insert({
        workspace_id: espacioId,
        user_id: userId,
        project_id: proyecto.project_id,
        edition_id: edicionId,
        task_id: proyecto.task_id,
        description: descripcion,
        billable: facturable,
        start_at: inicio,
        end_at: fin,
        source: "calendario",
      })
      .select("id")
      .single()

    if (err) {
      setGuardando(false)
      setError(mensajeError(err))
      return
    }

    if (etiquetas.length > 0) {
      const { error: errTags } = await supabase
        .from("time_entry_tags")
        .insert(etiquetas.map((tag_id) => ({ entry_id: data.id, tag_id })))
      if (errTags) {
        setGuardando(false)
        setError(mensajeError(errTags))
        return
      }
    }

    // Al resto no se le apuntan las horas: se le proponen
    if (compartidos.length > 0) {
      const { error: errCompartir } = await supabase.from("entry_invitations").insert(
        compartidos.map((to_user) => ({
          workspace_id: espacioId,
          origin_entry_id: data.id,
          from_user: userId,
          to_user,
          project_id: proyecto.project_id,
          edition_id: edicionId,
          task_id: proyecto.task_id,
          description: descripcion,
          start_at: inicio,
          end_at: fin,
          billable: facturable,
        })),
      )
      if (errCompartir) {
        setGuardando(false)
        setError(
          `Tus horas se han guardado, pero no se ha podido avisar al resto: ${mensajeError(errCompartir)}`,
        )
        return
      }
    }

    setGuardando(false)
    router.refresh()
    onCerrar()
    avisar("Hora añadida.", async () => {
      const cliente = createClient()
      // Si se propuso a alguien, esas invitaciones tambien se deshacen: que
      // nadie pueda aceptar una hora que ya se ha retirado.
      const { error: errInvitaciones } = await cliente
        .from("entry_invitations")
        .delete()
        .eq("origin_entry_id", data.id)
      if (errInvitaciones) throw new Error(mensajeError(errInvitaciones))
      const { error: errQuitar } = await cliente
        .from("time_entries")
        .delete()
        .eq("id", data.id)
      if (errQuitar) throw new Error(mensajeError(errQuitar))
      router.refresh()
      return "Quitada."
    })
  }

  return (
    <Dialog.Root open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          onPointerDownOutside={(e) => {
            if (proyectoAbierto) e.preventDefault()
          }}
          className="card fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-0"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">Nueva entrada</Dialog.Title>
            <Dialog.Close className="btn btn-ghost p-1" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-1 grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="label" htmlFor="cal-fecha">
                  Fecha
                </label>
                <input
                  id="cal-fecha"
                  type="date"
                  className="field tabular"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="cal-inicio">
                  Inicio
                </label>
                <CampoHora
                  id="cal-inicio"
                  valor={horaInicio}
                  onChange={setHoraInicio}
                />
              </div>
              <div>
                <label className="label" htmlFor="cal-fin">
                  Fin
                </label>
                <CampoHora
                  id="cal-fin"
                  valor={horaFin}
                  onChange={setHoraFin}
                />
              </div>
            </div>

            <p className="text-xs text-muted">
              {duracion && duracion > 0
                ? `Son ${formatDurationShort(duracion * 60)} horas.`
                : "El fin tiene que ser posterior al inicio."}
            </p>

            <div>
              <label className="label" htmlFor="cal-descripcion">
                En que has trabajado
              </label>
              <input
                id="cal-descripcion"
                autoFocus
                className="field"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div>
              <span className="label">Proyecto y tarea</span>
              <SelectorProyecto
                catalogo={catalogo}
                valor={{ ...proyecto, edition_id: edicionId }}
                onChange={(sel) => {
                  setEdicionId(sel.edition_id)
                  elegirProyecto(sel)
                }}
                onAbiertoChange={setProyectoAbierto}
              />
            </div>

            <div>
              <span className="label">Etiquetas</span>
              <SelectorEtiquetas
                etiquetas={catalogo.etiquetas}
                seleccionadas={etiquetas}
                onChange={setEtiquetas}
              />
            </div>

            <div>
              <span className="label">También cuenta para</span>
              <SelectorPersonas
                miembros={miembros}
                seleccionadas={compartidos}
                onChange={setCompartidos}
              />
              {compartidos.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Les llegara como una propuesta: hasta que la acepten no se les
                  apunta nada.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFacturable((v) => !v)}
              aria-pressed={facturable}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[var(--radio-sm)] border px-3 text-sm transition",
                facturable
                  ? "border-billable-line bg-billable-soft text-billable"
                  : "border-line-strong bg-surface text-muted hover:bg-surface-2",
              )}
            >
              <Euro className="h-4 w-4" />
              {facturable ? "Facturable" : "No facturable"}
            </button>

            {error && (
              <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Dialog.Close className="btn">Cancelar</Dialog.Close>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando}
              className="btn btn-primary"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
