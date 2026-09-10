"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Popover from "@radix-ui/react-popover"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  Copy,
  Euro,
  MoreHorizontal,
  Play,
  Tag,
  Trash2,
  Users,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useCronometro } from "@/components/proveedor-cronometro"
import { useAvisos } from "@/components/avisos"
import { CompartirCon } from "@/components/compartir-con"
import { DialogoEntrada } from "@/components/dialogo-entrada"
import { CampoHora } from "@/components/campo-hora"
import { SelectorProyecto } from "@/components/selector-proyecto"
import { SelectorEtiquetas } from "@/components/selector-etiquetas"
import {
  combineDateAndTime,
  formatClock,
  formatDurationShort,
  parseDurationToSeconds,
  toClockInput,
} from "@/lib/time"
import type { TablesUpdate } from "@/lib/database.types"
import type { Catalogo, EntradaVista, Miembro } from "@/lib/tipos"
import { useEsMovil } from "@/lib/pantalla"
import { cn } from "@/lib/utils"

/**
 * Mismo criterio que el calendario: acabar justo a las 00:00 es cerrar el dia,
 * no pasar al siguiente; el +1 solo sale si de verdad sigue de madrugada.
 */
function acabaOtroDia(entrada: { start_at: string; end_at: string | null }) {
  if (!entrada.end_at) return false
  const medianoche = new Date(entrada.start_at)
  medianoche.setHours(24, 0, 0, 0)
  return new Date(entrada.end_at) > medianoche
}

/** Que celda esta abierta para editar. Solo una a la vez. */
type Campo = "descripcion" | "proyecto" | "etiquetas" | "horario" | "duracion" | null

/**
 * Una hora apuntada. Todo se edita pulsando encima del dato: no hay que ir a
 * buscar un boton de editar para cambiar una palabra.
 */
export function FilaEntrada({
  entrada,
  catalogo,
  miembros,
  mostrarPersona,
}: {
  entrada: EntradaVista
  catalogo: Catalogo
  /** El equipo, para poder compartir estas horas con quien haga falta. */
  miembros: Miembro[]
  mostrarPersona: boolean
}) {
  const router = useRouter()
  const { arrancar } = useCronometro()
  const { avisar } = useAvisos()
  const [campo, setCampo] = useState<Campo>(null)
  /* En el movil una hora se edita en su tarjeta entera: los campos sueltos de
     la fila son de setenta pixeles y no se pulsan con el pulgar. */
  const esMovil = useEsMovil()
  const [abierta, setAbierta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bloqueada = entrada.locked

  /* Quien mas cuenta estas horas. Un punto naranja avisa de que alguien no ha
     contestado todavia. */
  const compartida = entrada.compartida_con ?? []

  async function guardar(
    cambios: TablesUpdate<"time_entries">,
    aviso = "Hora actualizada.",
  ) {
    setOcupado(true)
    setError(null)
    /* `select` para saber si de verdad ha cambiado algo: sin el, una hora
       cerrada o una sesion caducada no dan error, no guardan nada y el dato
       vuelve solo al valor viejo sin explicar por que. */
    const { data, error: err } = await createClient()
      .from("time_entries")
      .update(cambios)
      .eq("id", entrada.id)
      .select("id")
    setOcupado(false)
    setCampo(null)
    if (err) {
      setError(mensajeError(err))
      return
    }
    if (!data || data.length === 0) {
      const aviso = "No se ha guardado. Puede estar cerrada o haberse acabado tu sesión: recarga la página."
      setError(aviso)
      avisar(aviso, undefined, "mal")
      return
    }
    router.refresh()

    /* Lo que habia antes en esos mismos campos: cualquier retoque se puede
       deshacer sin tener que acordarse de que ponia. */
    const antes = Object.fromEntries(
      Object.keys(cambios).map((campo) => [
        campo,
        (entrada as unknown as Record<string, unknown>)[campo],
      ]),
    ) as TablesUpdate<"time_entries">

    avisar(aviso, async () => {
      const { error: errVolver } = await createClient()
        .from("time_entries")
        .update(antes)
        .eq("id", entrada.id)
      if (errVolver) throw new Error(mensajeError(errVolver))
      router.refresh()
      return "Como estaba."
    })
  }

  async function guardarEtiquetas(ids: string[]) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    await supabase.from("time_entry_tags").delete().eq("entry_id", entrada.id)
    if (ids.length > 0) {
      const { error: err } = await supabase
        .from("time_entry_tags")
        .insert(ids.map((tag_id) => ({ entry_id: entrada.id, tag_id })))
      if (err) {
        setOcupado(false)
        setError(mensajeError(err))
        return
      }
    }
    setOcupado(false)
    router.refresh()
  }

  /**
   * Borrar sin susto: antes de irse se guarda la fila entera y sus etiquetas,
   * y el aviso de abajo deja devolverla tal cual, con el mismo id.
   */
  async function borrar() {
    setOcupado(true)
    setError(null)
    const supabase = createClient()

    const [{ data: fila }, { data: etiquetas }] = await Promise.all([
      supabase.from("time_entries").select("*").eq("id", entrada.id).single(),
      supabase.from("time_entry_tags").select("entry_id, tag_id").eq("entry_id", entrada.id),
    ])

    const { error: err } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entrada.id)
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }

    router.refresh()
    avisar(
      "Hora borrada.",
      fila
        ? async () => {
            const cliente = createClient()
            const { duration_seconds: _fuera, ...devolver } = fila
            const { error: errVolver } = await cliente
              .from("time_entries")
              .insert(devolver)
            if (errVolver) throw new Error(mensajeError(errVolver))
            if (etiquetas && etiquetas.length > 0) {
              await cliente.from("time_entry_tags").insert(etiquetas)
            }
            router.refresh()
            return "Recuperada."
          }
        : undefined,
    )
  }

  async function duplicar() {
    setOcupado(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("time_entries")
      .insert({
        workspace_id: entrada.workspace_id,
        user_id: entrada.user_id,
        project_id: entrada.project_id,
        task_id: entrada.task_id,
        description: entrada.description,
        billable: entrada.billable,
        start_at: entrada.start_at,
        end_at: entrada.end_at,
      })
      .select("id")
      .single()

    if (!err && data && entrada.tags.length > 0) {
      const ids = catalogo.etiquetas
        .filter((e) => entrada.tags.includes(e.name))
        .map((e) => e.id)
      if (ids.length > 0) {
        await supabase
          .from("time_entry_tags")
          .insert(ids.map((tag_id) => ({ entry_id: data.id, tag_id })))
      }
    }

    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
    avisar(
      "Duplicada.",
      data
        ? async () => {
            const { error: errQuitar } = await createClient()
              .from("time_entries")
              .delete()
              .eq("id", data.id)
            if (errQuitar) throw new Error(mensajeError(errQuitar))
            router.refresh()
            return "Copia quitada."
          }
        : undefined,
    )
  }

  /** Ids de las etiquetas puestas: la vista las trae por nombre. */
  const etiquetasPuestas = catalogo.etiquetas
    .filter((e) => entrada.tags.includes(e.name))
    .map((e) => e.id)

  const pulsable =
    "rounded-[6px] px-1.5 py-1 text-left transition hover:bg-surface-3/70"

  return (
    <li
      className={cn(
        "group border-b border-line px-2.5 last:border-b-0 transition",
        ocupado && "opacity-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 md:flex-nowrap md:gap-3 md:py-2.5">
        {/* -------------------------------------------------- descripcion */}
        <div className="min-w-0 flex-1 md:w-[30%] md:flex-none">
          {campo === "descripcion" ? (
            <input
              autoFocus
              defaultValue={entrada.description}
              onBlur={(e) => {
                const valor = e.target.value
                if (valor === entrada.description) setCampo(null)
                else void guardar({ description: valor })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") setCampo(null)
              }}
              className="field py-1 text-[0.9375rem]"
              placeholder="¿En qué has trabajado?"
            />
          ) : (
            <button
              type="button"
              disabled={bloqueada}
              onClick={() => (esMovil ? setAbierta(true) : setCampo("descripcion"))}
              className={cn(pulsable, "block w-full truncate text-[0.9375rem]")}
            >
              {entrada.description || (
                <span className="text-muted">
                  {bloqueada ? "Sin descripción" : "Añadir descripción"}
                </span>
              )}
            </button>
          )}

        </div>

        {/* ----------------------------------------------------- proyecto */}
        <div className="hidden w-52 shrink-0 md:block">
          {campo === "proyecto" ? (
            <SelectorProyecto
              catalogo={catalogo}
              compacto
              autoAbrir
              valor={{
                project_id: entrada.project_id,
                task_id: entrada.task_id,
                edition_id: entrada.edition_id,
              }}
              onChange={(sel) =>
                void guardar({
                  project_id: sel.project_id,
                  task_id: sel.task_id,
                  edition_id: sel.edition_id,
                })
              }
            />
          ) : (
            <button
              type="button"
              disabled={bloqueada}
              onClick={() => setCampo("proyecto")}
              className={cn(pulsable, "flex w-full items-center gap-1.5")}
            >
              {entrada.project_name ? (
                <>
                  {/* El punto es del proyecto; el aro verde dice que se cobra */}
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      entrada.billable && "marca-facturable",
                    )}
                    style={{ background: entrada.project_color ?? "var(--line-strong)" }}
                  />
                  {/* El nombre va del color del proyecto: se reconoce de un
                      vistazo sin leerlo, como el punto de al lado */}
                  <span
                    className="min-w-0 truncate text-[0.8125rem] font-medium"
                    style={{ color: entrada.project_color ?? undefined }}
                  >
                    {entrada.project_name}
                    {entrada.edition_name && (
                      <span className="text-muted"> · {entrada.edition_name}</span>
                    )}
                    {entrada.task_name && (
                      <span className="text-muted"> · {entrada.task_name}</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-[0.8125rem] text-muted">
                  {bloqueada ? "Sin proyecto" : "Añadir proyecto"}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ---------------------------------------------------- etiquetas */}
        <div className="hidden flex-1 md:block" aria-hidden />

        <div className="hidden w-36 shrink-0 lg:block">
          {campo === "etiquetas" ? (
            <SelectorEtiquetas
              etiquetas={catalogo.etiquetas}
              seleccionadas={etiquetasPuestas}
              compacto
              autoAbrir
              onChange={(ids) => void guardarEtiquetas(ids)}
            />
          ) : (
            <button
              type="button"
              disabled={bloqueada}
              onClick={() => setCampo("etiquetas")}
              className={cn(pulsable, "flex w-full items-center gap-1")}
            >
              {mostrarPersona && (
                <span className="chip min-w-0 truncate">{entrada.user_name}</span>
              )}
              {/* Vacio: el simbolo de etiqueta, que ocupa lo justo y se
                  entiende sin leer. La palabra en cada fila era ruido. */}
              {entrada.tags.length === 0 && !mostrarPersona && (
                <Tag className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Etiquetas" />
              )}
              {entrada.tags.slice(0, 1).map((t) => (
                <span key={t} className="chip min-w-0 truncate">
                  {t}
                </span>
              ))}
              {entrada.tags.length > 1 && (
                <span className="chip shrink-0">+{entrada.tags.length - 1}</span>
              )}
            </button>
          )}
        </div>

        {/* ------------------------------------------------- compartida con */}
        {/* Su propio sitio: dentro de las etiquetas parecia una etiqueta mas
            y no lo es -son personas, y algunas sin contestar todavia. El
            hueco se reserva siempre para que las columnas cuadren. */}
        <div className="hidden w-7 shrink-0 justify-center sm:flex">
          <CompartirCon entrada={entrada} miembros={miembros} />
        </div>

        {/* --------------------------------------------------- facturable */}
        <button
          type="button"
          disabled={bloqueada}
          onClick={() => void guardar({ billable: !entrada.billable })}
          title={entrada.billable ? "Se cobra" : "No se cobra"}
          aria-pressed={entrada.billable}
          className={cn(
            /* En movil se va a la segunda linea, detras del play; en
               escritorio se queda donde estaba */
            "order-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] transition md:order-none md:h-auto md:w-auto md:p-1",
            entrada.billable
              ? "text-billable hover:bg-billable-soft"
              : "text-muted hover:bg-surface-3/70",
          )}
        >
          <Euro className="h-3.5 w-3.5" />
        </button>

        {/* ------------------------------------------ fecha, inicio y fin */}
        {/* Ancho fijo: asi las columnas cuadran con la fila de un grupo */}
        <div className="hidden w-28 shrink-0 sm:block">
          <PopoverHorario
            entrada={entrada}
            abierto={campo === "horario"}
            onAbrir={(v) => setCampo(v ? "horario" : null)}
            onGuardar={guardar}
            bloqueada={bloqueada}
          />
        </div>

        {/* -------------------------------------------------- duracion */}
        <div className="w-[4.75rem] shrink-0 md:w-[5.5rem]">
          {campo === "duracion" ? (
            <input
              autoFocus
              defaultValue={formatDurationShort(entrada.duration_seconds)}
              onBlur={(e) => {
                const segundos = parseDurationToSeconds(e.target.value)
                if (!segundos || segundos <= 0) {
                  setCampo(null)
                  return
                }
                void guardar({
                  end_at: new Date(
                    new Date(entrada.start_at).getTime() + segundos * 1000,
                  ).toISOString(),
                })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") setCampo(null)
              }}
              className="field caja-horas w-full justify-end px-2 py-0.5 text-[0.9375rem] font-semibold"
            />
          ) : (
            <button
              type="button"
              disabled={bloqueada}
              onClick={() => (esMovil ? setAbierta(true) : setCampo("duracion"))}
              className={cn(
                "caja-horas w-full text-[0.9375rem] font-semibold transition",
                !bloqueada && "hover:border-line-strong hover:bg-surface-2",
              )}
            >
              {formatDurationShort(entrada.duration_seconds)}
            </button>
          )}
        </div>

        {/* En movil parte aqui la fila: arriba lo que hiciste y cuanto, y
            abajo el proyecto, el horario y los botones. */}
        <span className="basis-full md:hidden" aria-hidden />

          {/* En un movil no caben las columnas de al lado, asi que lo esencial
              -proyecto y horario- va debajo de la descripcion. Al pulsarlo se
              abre la tarjeta entera, que es donde se edita comodo con el dedo. */}
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="order-1 flex min-w-0 flex-1 items-center gap-1.5 truncate py-0.5 pl-1.5 text-left text-xs text-muted md:hidden"
          >
            {entrada.project_name ? (
              <>
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    entrada.billable && "marca-facturable",
                  )}
                  style={{ background: entrada.project_color ?? "var(--line-strong)" }}
                />
                <span
                  className="min-w-0 truncate font-medium"
                  style={{ color: entrada.project_color ?? undefined }}
                >
                  {entrada.project_name}
                </span>
              </>
            ) : (
              <span className="shrink-0">
                {bloqueada ? "Sin proyecto" : "Añadir proyecto"}
              </span>
            )}
            <span aria-hidden>·</span>
            <span className="tabular shrink-0">
              {formatClock(entrada.start_at)}–{formatClock(entrada.end_at)}
              {acabaOtroDia(entrada) && (
                <sup className="ml-0.5 text-live">+1</sup>
              )}
            </span>
            {entrada.tags.length > 0 && (
              <Tag className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {compartida.length > 0 && (
              <Users className="h-3 w-3 shrink-0" aria-hidden />
            )}
          </button>

        {/* ---------------------------------------------------- acciones */}
        {/* Continuar: arranca ahora mismo con lo mismo de esta entrada */}
        <button
          type="button"
          title="Continuar con esto ahora"
          onClick={() =>
            void arrancar({
              project_id: entrada.project_id,
              edition_id: entrada.edition_id,
              task_id: entrada.task_id,
              description: entrada.description,
              billable: entrada.billable,
              tagIds: etiquetasPuestas,
            })
          }
          /* Naranja, que en esta casa es el color de lo que corre: el play es lo
            unico de la fila que pone el cronometro en marcha */
          className="order-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-live transition hover:bg-live-soft md:order-none md:h-auto md:w-auto md:px-2 md:py-1.5"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Duplicar y borrar juntos y pequeños se confunden: van detrás de los
            tres puntos, que es donde los busca todo el mundo. */}
        <div className="order-4 flex w-10 shrink-0 items-center justify-end md:order-none md:w-8">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              disabled={ocupado}
              title="Más"
              aria-label="Más cosas para esta hora"
              className="btn btn-ghost h-10 w-10 p-0 text-muted hover:text-ink md:h-auto md:w-auto md:p-1.5"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 w-44 overflow-hidden rounded-[var(--radio)] border border-line bg-surface p-1"
                style={{ boxShadow: "var(--shadow-lg)" }}
              >
                <DropdownMenu.Item
                  onSelect={() => void duplicar()}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none data-highlighted:bg-surface-2"
                >
                  <Copy className="h-3.5 w-3.5 text-muted" />
                  Duplicar
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={bloqueada}
                  onSelect={() => void borrar()}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm text-danger outline-none data-disabled:opacity-40 data-highlighted:bg-danger-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>


      {error && (
        <p className="pb-2 pl-1.5 text-xs text-danger">{error}</p>
      )}

      {abierta && (
        <DialogoEntrada
          entrada={entrada}
          catalogo={catalogo}
          miembros={miembros}
          onCerrar={() => setAbierta(false)}
        />
      )}
    </li>
  )
}

/* ------------------------------------------------- fecha, inicio y fin */

function PopoverHorario({
  entrada,
  abierto,
  onAbrir,
  onGuardar,
  bloqueada,
}: {
  entrada: EntradaVista
  abierto: boolean
  onAbrir: (abierto: boolean) => void
  onGuardar: (cambios: TablesUpdate<"time_entries">) => Promise<void>
  bloqueada: boolean
}) {
  const [fecha, setFecha] = useState(entrada.local_date)
  const [inicio, setInicio] = useState(toClockInput(entrada.start_at))
  const [fin, setFin] = useState(
    entrada.end_at ? toClockInput(entrada.end_at) : "",
  )

  function aplicar() {
    if (!inicio || !fin) return
    const start_at = combineDateAndTime(fecha, inicio)
    let end_at = combineDateAndTime(fecha, fin)
    // Si acaba antes de empezar, es que cruzo la medianoche
    if (new Date(end_at) <= new Date(start_at)) {
      end_at = new Date(new Date(end_at).getTime() + 86_400_000).toISOString()
    }
    void onGuardar({ start_at, end_at })
  }


  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        if (v) {
          setFecha(entrada.local_date)
          setInicio(toClockInput(entrada.start_at))
          setFin(entrada.end_at ? toClockInput(entrada.end_at) : "")
        }
        onAbrir(v)
      }}
    >
      <Popover.Trigger
        disabled={bloqueada}
        className="tabular w-full rounded-[6px] px-1.5 py-1 text-right text-[0.8125rem] text-muted transition hover:bg-surface-3/70"
      >
        {formatClock(entrada.start_at)}–{formatClock(entrada.end_at)}
        {/* El rato acabo ya en el dia siguiente; se apunta igual en el dia que empezo */}
        {acabaOtroDia(entrada) && (
          <sup className="ml-0.5 font-semibold text-live" title="Termina al día siguiente">
            +1
          </sup>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="card z-50 w-64 p-3"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="space-y-2.5">
            <div>
              <label className="label" htmlFor={`fecha-${entrada.id}`}>
                Día
              </label>
              <input
                id={`fecha-${entrada.id}`}
                type="date"
                className="field tabular"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor={`inicio-${entrada.id}`}>
                  Inicio
                </label>
                <CampoHora
                  id={`inicio-${entrada.id}`}
                  valor={inicio}
                  onChange={setInicio}
                />
              </div>
              <div>
                <label className="label" htmlFor={`fin-${entrada.id}`}>
                  Fin
                </label>
                <CampoHora
                  id={`fin-${entrada.id}`}
                  valor={fin}
                  onChange={setFin}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={aplicar}
              className="btn btn-primary w-full"
            >
              Guardar
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
