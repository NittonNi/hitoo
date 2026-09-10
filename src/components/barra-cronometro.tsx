"use client"

import { useEffect, useRef, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Euro, ListPlus, Loader2, Play, Square, Timer, Trash2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useCronometro } from "@/components/proveedor-cronometro"
import { useSesion } from "@/components/proveedor-sesion"
import { useAvisos } from "@/components/avisos"
import { CampoHora } from "@/components/campo-hora"
import {
  SelectorProyecto,
  type Seleccion,
} from "@/components/selector-proyecto"
import { SelectorEtiquetas } from "@/components/selector-etiquetas"
import { SelectorPersonas } from "@/components/selector-personas"
import { proponerHoras } from "@/lib/compartir"
import {
  combineDateAndTime,
  formatClock,
  formatDuration,
  parseDurationToSeconds,
  toClockInput,
  toDateKey,
  todayKey,
} from "@/lib/time"
import {
  BORRADOR_VACIO,
  type BorradorEntrada,
  type Catalogo,
  type Miembro,
} from "@/lib/tipos"
import { cn } from "@/lib/utils"

type Modo = "cronometro" | "manual"

export function BarraCronometro({
  catalogo,
  miembros = [],
}: {
  catalogo: Catalogo
  /** El resto del equipo, para poder compartir estas horas. */
  miembros?: Miembro[]
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { perfil, espacio } = useSesion()
  const { enMarcha, segundos, arrancar, parar, descartar, cargando, recargar } =
    useCronometro()

  const [modo, setModo] = useState<Modo>("cronometro")
  /* Si arranca un cronometro -por ejemplo al pulsar Continuar en una hora de
     abajo- la barra vuelve sola al modo cronometro: si no, el tiempo correria
     escondido detras del formulario de apuntar a mano. */
  const modoActivo: Modo = enMarcha ? "cronometro" : modo
  const [borrador, setBorrador] = useState<BorradorEntrada>(BORRADOR_VACIO)
  const [guardando, setGuardando] = useState(false)
  // Cuando el espacio no deja parar sin proyecto, hay que decirlo aquí mismo
  const [falta, setFalta] = useState<"proyecto" | "descripcion" | null>(null)
  // A quien mas le cuentan estas horas. No se les apunta: se les propone.
  const [compartidos, setCompartidos] = useState<string[]>([])
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null)
  const supabase = useRef(createClient())

  /* El cronometro en marcha solo se ve aqui: si arranca con la barra fuera de
     la vista -Continuar en una hora de mas abajo-, la pagina sube hasta ella.
     Si no, parece que el boton no ha hecho nada. */
  const barraRef = useRef<HTMLDivElement>(null)
  const idEnMarcha = enMarcha?.id
  const idAnterior = useRef(idEnMarcha)
  useEffect(() => {
    if (idEnMarcha && idEnMarcha !== idAnterior.current) {
      barraRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
    idAnterior.current = idEnMarcha
  }, [idEnMarcha])

  // Mientras corre el cronómetro, la barra muestra y edita esa entrada
  const activo = enMarcha
    ? {
        project_id: enMarcha.project_id,
        edition_id: enMarcha.edition_id,
        task_id: enMarcha.task_id,
        description: enMarcha.description,
        billable: enMarcha.billable,
        tagIds: enMarcha.tagIds,
      }
    : borrador

  // Lo que se esta tecleando ahora mismo, atado a la entrada que se edita: si
  // cambia la entrada (arranca otra, para, llega del movil) el texto local
  // caduca solo y vuelve a mandar lo que dice el servidor.
  const claveActiva = enMarcha?.id ?? "borrador"
  const [tecleado, setTecleado] = useState<{ clave: string; texto: string } | null>(
    null,
  )
  const descripcionLocal =
    tecleado?.clave === claveActiva ? tecleado.texto : activo.description
  const setDescripcionLocal = (texto: string) =>
    setTecleado({ clave: claveActiva, texto })

  /** Guarda un cambio sobre la entrada en marcha. */
  async function actualizarEnMarcha(cambios: Partial<BorradorEntrada>) {
    if (!enMarcha) return
    try {
      const { tagIds, ...campos } = cambios
      if (Object.keys(campos).length > 0) {
        const { error } = await supabase.current
          .from("time_entries")
          .update(campos)
          .eq("id", enMarcha.id)
        if (error) throw error
      }
      if (tagIds) {
        await supabase.current
          .from("time_entry_tags")
          .delete()
          .eq("entry_id", enMarcha.id)
        if (tagIds.length > 0) {
          const { error } = await supabase.current
            .from("time_entry_tags")
            .insert(tagIds.map((tag_id) => ({ entry_id: enMarcha.id, tag_id })))
          if (error) throw error
        }
      }
      await recargar()
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
    }
  }

  function cambiar(cambios: Partial<BorradorEntrada>) {
    if (enMarcha) void actualizarEnMarcha(cambios)
    else setBorrador((b) => ({ ...b, ...cambios }))
  }

  /** Al elegir proyecto, hereda su marca de facturable si no se ha tocado. */
  function elegirProyecto(sel: Seleccion) {
    const proyecto = catalogo.proyectos.find((p) => p.id === sel.project_id)
    if (sel.project_id) setFalta((f) => (f === "proyecto" ? null : f))
    cambiar({
      ...sel,
      ...(proyecto && !enMarcha ? { billable: proyecto.billable_default } : {}),
    })
  }

  /** Al cerrar una entrada se propone a quien se haya elegido arriba. */
  async function compartirSiHaceFalta(entrada: {
    id: string
    project_id: string | null
    edition_id: string | null
    task_id: string | null
    description: string
    billable: boolean
    start_at: string
    end_at: string | null
  }) {
    if (compartidos.length === 0 || !entrada.end_at) return

    const { error } = await proponerHoras(supabase.current, {
      espacioId: espacio.id,
      entradaId: entrada.id,
      deQuien: perfil.id,
      aQuienes: compartidos,
      project_id: entrada.project_id,
      edition_id: entrada.edition_id,
      task_id: entrada.task_id,
      description: entrada.description,
      start_at: entrada.start_at,
      end_at: entrada.end_at,
      billable: entrada.billable,
    })

    if (error) {
      setAvisoCompartir(
        "Tus horas se han guardado, pero no se ha podido avisar al resto: " +
          mensajeError(error),
      )
      return
    }

    setAvisoCompartir(
      compartidos.length === 1
        ? "Propuesta enviada. Hasta que la acepte no se le apunta nada."
        : "Propuestas enviadas. Hasta que las acepten no se les apunta nada.",
    )
    setCompartidos([])
  }

  /**
   * Mover la hora a la que empezo el rato que esta corriendo. Es lo que salva
   * el "llevo hora y media con esto y se me olvido darle al play": se arranca
   * ahora y se corrige la hora, sin tener que apuntar nada a mano.
   */
  async function ajustarInicio(nuevoInicio: string) {
    if (!enMarcha) return
    const antes = enMarcha.start_at

    const { error: err } = await supabase.current
      .from("time_entries")
      .update({ start_at: nuevoInicio })
      .eq("id", enMarcha.id)
    if (err) {
      avisar(mensajeError(err), undefined, "mal")
      return
    }

    await recargar()
    router.refresh()
    avisar(`El cronómetro empieza a las ${formatClock(nuevoInicio)}.`, async () => {
      const { error: errVolver } = await supabase.current
        .from("time_entries")
        .update({ start_at: antes })
        .eq("id", enMarcha.id)
      if (errVolver) throw new Error(mensajeError(errVolver))
      await recargar()
      router.refresh()
      return "Como estaba."
    })
  }

  async function alPulsarPrincipal() {
    if (enMarcha) {
      /* Nada de horas huerfanas: si el espacio lo exige, no se para sin
         proyecto ni sin decir en que se ha ido el rato. */
      if (espacio.require_project && !enMarcha.project_id) {
        setFalta("proyecto")
        return
      }
      if (espacio.require_description && !enMarcha.description.trim()) {
        setFalta("descripcion")
        return
      }
      setAvisoCompartir(null)
      const cerrada = await parar()
      if (cerrada) {
        await compartirSiHaceFalta(cerrada)
        avisar(
          `Hora apuntada: ${formatDuration(
            Math.round(
              (new Date(cerrada.end_at!).getTime() -
                new Date(cerrada.start_at).getTime()) /
                1000,
            ),
          )}.`,
        )
      }
      return
    }

    setAvisoCompartir(null)
    await arrancar({ ...borrador, description: descripcionLocal })
    setBorrador(BORRADOR_VACIO)
    setDescripcionLocal("")
  }

  return (
    /* Cuando el cronometro corre, la tarjeta de arriba ES el cronometro: se
       tiñe, late a la izquierda y la cuenta manda. No hace falta buscarlo en
       ningun otro sitio de la pantalla. */
    <div
      ref={barraRef}
      className={cn(
        /* el margen salva la cabecera fija del movil al subir hasta aqui */
        "card scroll-mt-20 overflow-visible p-3 transition-colors lg:scroll-mt-8",
        enMarcha && "border-live-line bg-live-soft",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
        {enMarcha && (
          <span
            aria-hidden
            className="latido h-6 w-[3px] shrink-0 rounded-full bg-live-fill"
          />
        )}
        <input
          value={descripcionLocal}
          onChange={(e) => {
            setDescripcionLocal(e.target.value)
            if (e.target.value.trim()) {
              setFalta((f) => (f === "descripcion" ? null : f))
            }
          }}
          onBlur={() => {
            if (enMarcha && descripcionLocal !== enMarcha.description) {
              void actualizarEnMarcha({ description: descripcionLocal })
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              e.currentTarget.blur()
              if (modoActivo === "cronometro") void alPulsarPrincipal()
            }
          }}
          placeholder="¿En qué estás trabajando?"
          className="min-w-0 flex-1 bg-transparent px-1 text-[0.95rem] outline-none placeholder:text-muted"
        />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ancho para que quepa proyecto + edicion sin cortarlas */}
          <div className="w-full sm:w-72">
            <SelectorProyecto
              catalogo={catalogo}
              valor={{
                project_id: activo.project_id,
                task_id: activo.task_id,
                edition_id: activo.edition_id,
              }}
              onChange={elegirProyecto}
              invita
            />
          </div>

          <SelectorEtiquetas
            etiquetas={catalogo.etiquetas}
            seleccionadas={activo.tagIds}
            onChange={(tagIds) => cambiar({ tagIds })}
          />

          <button
            type="button"
            onClick={() => cambiar({ billable: !activo.billable })}
            title={activo.billable ? "Facturable" : "No facturable"}
            aria-pressed={activo.billable}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border transition",
              activo.billable
                ? "border-billable-line bg-billable-soft text-billable"
                : "border-line-strong bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Euro className="h-4 w-4" />
          </button>

          <div className="hidden h-6 w-px bg-line sm:block" />

          {modoActivo === "cronometro" ? (
            <>
              {enMarcha ? (
                <EditorInicio
                  inicio={enMarcha.start_at}
                  segundos={segundos}
                  onCambiar={ajustarInicio}
                />
              ) : (
                <span className="cifra w-24 text-right text-lg font-semibold tabular-nums text-muted">
                  {formatDuration(0)}
                </span>
              )}
              <button
                type="button"
                onClick={() => void alPulsarPrincipal()}
                disabled={cargando}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-50",
                  enMarcha
                    ? "bg-danger hover:opacity-90"
                    : "bg-running hover:opacity-90",
                )}
                aria-label={enMarcha ? "Parar" : "Arrancar"}
              >
                {cargando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : enMarcha ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                )}
              </button>
              {enMarcha && (
                <button
                  type="button"
                  onClick={() => void descartar()}
                  title="Descartar sin guardar"
                  className="btn btn-ghost h-9 w-9 p-0 text-muted hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <EntradaManual
              espacioId={espacio.id}
              userId={perfil.id}
              exigeProyecto={espacio.require_project}
              borrador={{ ...borrador, description: descripcionLocal }}
              guardando={guardando}
              setGuardando={setGuardando}
              alGuardar={async (creada) => {
                await compartirSiHaceFalta({
                  ...creada,
                  project_id: borrador.project_id,
                  edition_id: borrador.edition_id,
                  task_id: borrador.task_id,
                  description: descripcionLocal,
                  billable: borrador.billable,
                })
                setBorrador(BORRADOR_VACIO)
                setDescripcionLocal("")
                router.refresh()
              }}
            />
          )}

          {!enMarcha && (
            <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
              <button
                type="button"
                onClick={() => setModo("cronometro")}
                title="Modo cronómetro"
                aria-pressed={modo === "cronometro"}
                className={cn(
                  "rounded-md p-1.5 transition",
                  modo === "cronometro"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <Timer className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setModo("manual")}
                title="Añadir a mano"
                aria-pressed={modo === "manual"}
                className={cn(
                  "rounded-md p-1.5 transition",
                  modo === "manual"
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                <ListPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horas compartidas. Estando solo en el espacio no hay a quien
          proponerselas, pero si conviene saber que existe. */}
      {miembros.length === 0 ? (
        <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
          Una reunión se apunta una vez y se le propone al resto.{" "}
          <Link href="/gestion/equipo" className="text-accent">
            Trae a tu equipo
          </Link>{" "}
          y aparecerá aquí a quién más le cuentan estas horas.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="rotulo shrink-0">También cuenta para</span>
          <div className="w-56">
            <SelectorPersonas
              miembros={miembros}
              seleccionadas={compartidos}
              onChange={(ids) => {
                setCompartidos(ids)
                setAvisoCompartir(null)
              }}
            />
          </div>
          {compartidos.length > 0 && (
            <span className="text-xs text-muted">
              Al parar les llegará como propuesta: hasta que la acepten no se
              les apunta nada.
            </span>
          )}
        </div>
      )}

      {avisoCompartir && (
        <p className="mt-2 rounded-[var(--radio-sm)] border border-line bg-surface-2 px-3 py-2 text-sm text-ink-soft">
          {avisoCompartir}
        </p>
      )}

      {falta && (
        <p className="mt-2 rounded-[var(--radio-sm)] border border-live-line bg-live-soft px-3 py-2 text-sm text-live">
          {falta === "proyecto"
            ? "Elige un proyecto para poder parar. Así no quedan horas sueltas."
            : "Escribe en qué se ha ido el rato para poder parar."}
        </p>
      )}
    </div>
  )
}

/** Inicio, fin y duracion enlazados: tocar uno recalcula el otro. */
function EntradaManual({
  espacioId,
  userId,
  exigeProyecto,
  borrador,
  guardando,
  setGuardando,
  alGuardar,
}: {
  espacioId: string
  userId: string
  /** El espacio no quiere horas sin proyecto. */
  exigeProyecto: boolean
  borrador: BorradorEntrada
  guardando: boolean
  setGuardando: (v: boolean) => void
  alGuardar: (entrada: {
    id: string
    start_at: string
    end_at: string
  }) => void | Promise<void>
}) {
  const router = useRouter()
  const { avisar } = useAvisos()

  // Se apunta a mano cuando ya ha pasado: casi siempre hoy, a veces ayer
  const [fecha, setFecha] = useState(todayKey())
  const [inicio, setInicio] = useState("09:00")
  const [fin, setFin] = useState("10:00")
  const [duracion, setDuracion] = useState("1:00")

  function recalcularDuracion(desde: string, hasta: string) {
    const [h1, m1] = desde.split(":").map(Number)
    const [h2, m2] = hasta.split(":").map(Number)
    let mins = h2 * 60 + m2 - (h1 * 60 + m1)
    if (mins < 0) mins += 24 * 60 // ha cruzado la medianoche
    setDuracion(`${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`)
  }

  function aplicarDuracion(texto: string) {
    setDuracion(texto)
    const segs = parseDurationToSeconds(texto)
    if (segs === null) return
    const [h, m] = inicio.split(":").map(Number)
    const total = h * 60 + m + Math.round(segs / 60)
    const hh = Math.floor(total / 60) % 24
    setFin(`${String(hh).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`)
  }

  async function guardar() {
    const segs = parseDurationToSeconds(duracion)
    if (!segs || segs <= 0) {
      avisar("Pon una duración válida: 2, 1:30 o 90m.", undefined, "mal")
      return
    }
    if (exigeProyecto && !borrador.project_id) {
      avisar(
        "Elige un proyecto: este espacio no guarda horas sueltas.",
        undefined,
        "mal",
      )
      return
    }

    setGuardando(true)
    const supabase = createClient()
    const start_at = combineDateAndTime(fecha, inicio)
    // Fin con componentes locales (fecha + segundos del dia desde medianoche),
    // no sumando milisegundos de duracion al epoch: eso desplaza el fin una
    // hora si por medio hay un cambio de horario (DST).
    const [yy, mm, dd] = fecha.split("-").map(Number)
    const [hh, mi] = inicio.split(":").map(Number)
    const segundosDelDia = hh * 3600 + mi * 60 + segs
    const end_at = new Date(yy, mm - 1, dd, 0, 0, segundosDelDia, 0).toISOString()

    try {
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          workspace_id: espacioId,
          user_id: userId,
          project_id: borrador.project_id,
          edition_id: borrador.edition_id,
          task_id: borrador.task_id,
          description: borrador.description,
          billable: borrador.billable,
          start_at,
          end_at,
        })
        .select("id")
        .single()
      if (error) throw error

      if (borrador.tagIds.length > 0) {
        await supabase
          .from("time_entry_tags")
          .insert(borrador.tagIds.map((tag_id) => ({ entry_id: data.id, tag_id })))
      }
      await alGuardar({ id: data.id, start_at, end_at })
      avisar("Hora añadida.", async () => {
        // Si se propuso a alguien, esas invitaciones tambien se deshacen: que
        // nadie pueda aceptar una hora que ya se ha retirado.
        const { error: errInvitaciones } = await supabase
          .from("entry_invitations")
          .delete()
          .eq("origin_entry_id", data.id)
        if (errInvitaciones) throw new Error(mensajeError(errInvitaciones))
        const { error: errQuitar } = await supabase
          .from("time_entries")
          .delete()
          .eq("id", data.id)
        if (errQuitar) throw new Error(mensajeError(errQuitar))
        router.refresh()
        return "Quitada."
      })
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <input
        type="date"
        value={fecha}
        max={todayKey()}
        onChange={(e) => setFecha(e.target.value || todayKey())}
        className="field h-9 w-[8.5rem] tabular"
        aria-label="Día"
        title="Qué día fue"
      />
      <CampoHora
        valor={inicio}
        onChange={(v) => {
          setInicio(v)
          recalcularDuracion(v, fin)
        }}
        className="h-9 w-[6.5rem]"
        etiqueta="Hora de inicio"
      />
      <span className="text-muted">–</span>
      <CampoHora
        valor={fin}
        onChange={(v) => {
          setFin(v)
          recalcularDuracion(inicio, v)
        }}
        className="h-9 w-[6.5rem]"
        etiqueta="Hora de fin"
      />
      <input
        value={duracion}
        onChange={(e) => aplicarDuracion(e.target.value)}
        className="field h-9 w-20 tabular text-center"
        aria-label="Duración"
        placeholder="1:30"
      />
      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="btn btn-primary h-9"
      >
        {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
        Añadir
      </button>
    </>
  )
}

/* ------------------------------------------------------ hora de inicio */

/**
 * La cuenta del cronómetro se puede pulsar: debajo aparece a qué hora empezó
 * y se cambia ahí mismo. La cuenta sigue corriendo desde la hora nueva.
 *
 * Si se escribe una hora que aún no ha llegado se entiende que fue ayer: a las
 * 00:30 poner "23:00" solo puede significar la noche anterior, y así el rato
 * que cruza la medianoche también se arregla desde aquí.
 */
function EditorInicio({
  inicio,
  segundos,
  onCambiar,
}: {
  inicio: string
  segundos: number
  onCambiar: (nuevoInicio: string) => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [hora, setHora] = useState(toClockInput(inicio))

  async function aplicar(nueva = hora) {
    const hora = nueva
    if (!hora || hora === toClockInput(inicio)) {
      setAbierto(false)
      return
    }

    let nuevo = new Date(combineDateAndTime(toDateKey(new Date(inicio)), hora))
    if (nuevo.getTime() > Date.now()) {
      nuevo = new Date(nuevo.getTime() - 86_400_000)
    }

    setAbierto(false)
    await onCambiar(nuevo.toISOString())
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setHora(toClockInput(inicio))
        setAbierto(v)
      }}
    >
      {/* La tarjeta ya esta teñida de naranja, asi que el hover tiene que
          apoyarse en la linea, no en el fondo: se marca el recuadro. */}
      <Popover.Trigger
        title="Cambiar a qué hora empezó"
        className="cifra w-28 rounded-[var(--radio-sm)] border border-transparent px-1 text-right text-xl font-semibold tabular-nums text-running transition hover:border-live-line hover:bg-surface/70 data-[state=open]:border-live-line data-[state=open]:bg-surface/70"
      >
        {formatDuration(segundos)}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="card z-50 w-52 p-3"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <label className="label" htmlFor="inicio-cronometro">
            Empezó a las
          </label>
          <div className="mt-1 flex items-center gap-2">
            <CampoHora
              id="inicio-cronometro"
              autoFocus
              valor={hora}
              onChange={setHora}
              alPulsarEnter={(v) => void aplicar(v)}
              className="h-9 flex-1"
            />
            <button
              type="button"
              onClick={() => void aplicar()}
              className="btn btn-primary h-9 shrink-0 text-xs"
            >
              Cambiar
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
