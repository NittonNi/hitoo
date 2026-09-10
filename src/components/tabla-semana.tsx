"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { SelectorProyecto } from "@/components/selector-proyecto"
import {
  FiltrosDeHoras,
  filtrarHoras,
  hayFiltros,
  SIN_FILTROS,
  type Filtros,
} from "@/components/filtros-horas"
import {
  addDays,
  formatDurationShort,
  fromDateKey,
  parseDurationToSeconds,
  startOfWeek,
  toDateKey,
  todayKey,
} from "@/lib/time"
import type { Catalogo, EntradaVista, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

type Fila = {
  clave: string
  project_id: string | null
  task_id: string | null
  edition_id: string | null
  descripcion: string
  proyecto: string
  color: string | null
  facturable: boolean
  porDia: Record<string, EntradaVista[]>
}

const claveFila = (
  project_id: string | null,
  task_id: string | null,
  edition_id: string | null,
  descripcion: string,
) =>
  `${project_id ?? "-"}|${task_id ?? "-"}|${edition_id ?? "-"}|${descripcion
    .trim()
    .toLowerCase()}`

export function TablaSemana({
  entradas,
  catalogo,
  lunes,
  espacioId,
  yoId,
  // Todavia no se puede compartir desde aqui (pendiente: proponer horas
  // compartidas desde la hoja semanal); se recibe ya para no tener que
  // tocar el llamador cuando se construya.
  miembros: _miembros,
}: {
  entradas: EntradaVista[]
  catalogo: Catalogo
  lunes: string
  espacioId: string
  yoId: string
  miembros: Miembro[]
}) {
  const router = useRouter()
  const [nuevas, setNuevas] = useState<
    {
      clave: string
      project_id: string | null
      task_id: string | null
      edition_id: string | null
      descripcion: string
    }[]
  >([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toDateKey(addDays(fromDateKey(lunes), i))),
    [lunes],
  )


  /* Lo que se enseña, y por tanto lo que suma: los totales de abajo son de
     lo que hay en la tabla. */
  const visibles = useMemo(() => filtrarHoras(entradas, filtros), [entradas, filtros])
  const filtrando = hayFiltros(filtros)

  const filas = useMemo(() => {
    const mapa = new Map<string, Fila>()

    for (const entrada of visibles) {
      if (!entrada.end_at) continue // el cronometro en marcha no cuadricula
      const clave = claveFila(
        entrada.project_id,
        entrada.task_id,
        entrada.edition_id,
        entrada.description,
      )
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          project_id: entrada.project_id,
          edition_id: entrada.edition_id,
          task_id: entrada.task_id,
          descripcion: entrada.description,
          proyecto: entrada.project_name ?? "Sin proyecto",
          color: entrada.project_color,
          facturable: entrada.billable,
          porDia: {},
        })
      }
      const fila = mapa.get(clave)!
      ;(fila.porDia[entrada.local_date] ??= []).push(entrada)
    }

    for (const pendiente of nuevas) {
      if (mapa.has(pendiente.clave)) continue
      const proyecto = catalogo.proyectos.find((p) => p.id === pendiente.project_id)
      const tarea = catalogo.tareas.find((t) => t.id === pendiente.task_id)
      mapa.set(pendiente.clave, {
        clave: pendiente.clave,
        project_id: pendiente.project_id,
        edition_id: pendiente.edition_id,
        task_id: pendiente.task_id,
        descripcion: pendiente.descripcion,
        proyecto: proyecto
          ? tarea
            ? `${proyecto.name} · ${tarea.name}`
            : proyecto.name
          : "Sin proyecto",
        color: proyecto?.color ?? null,
        facturable: proyecto?.billable_default ?? false,
        porDia: {},
      })
    }

    return [...mapa.values()]
  }, [visibles, nuevas, catalogo])

  const totalDia = (dia: string) =>
    filas.reduce(
      (suma, fila) =>
        suma +
        (fila.porDia[dia] ?? []).reduce((s, e) => s + (e.duration_seconds ?? 0), 0),
      0,
    )

  const totalFila = (fila: Fila) =>
    dias.reduce(
      (suma, dia) =>
        suma + (fila.porDia[dia] ?? []).reduce((s, e) => s + (e.duration_seconds ?? 0), 0),
      0,
    )

  const totalSemana = dias.reduce((suma, dia) => suma + totalDia(dia), 0)

  /** 09:00, o justo después de lo último que haya ese dia. */
  function inicioSugerido(dia: string): string {
    const delDia = entradas.filter((e) => e.local_date === dia && e.end_at)
    if (delDia.length === 0) {
      const base = fromDateKey(dia)
      base.setHours(9, 0, 0, 0)
      return base.toISOString()
    }
    const ultimo = delDia.reduce((max, e) =>
      new Date(e.end_at!).getTime() > new Date(max.end_at!).getTime() ? e : max,
    )
    return ultimo.end_at!
  }

  async function guardarCelda(fila: Fila, dia: string, texto: string) {
    const existentes = fila.porDia[dia] ?? []
    const actual = existentes.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
    const segundos = parseDurationToSeconds(texto)

    // Sin cambios reales: ni tocar la base
    if (segundos === null && texto.trim() === "" && existentes.length === 0) return
    if (segundos !== null && segundos === actual) return
    if (texto.trim() !== "" && segundos === null) {
      setError("No entiendo esa duración. Prueba con 2, 1:30, 90m o 1,5.")
      return
    }

    setOcupado(`${fila.clave}|${dia}`)
    setError(null)
    const supabase = createClient()

    try {
      if (existentes.length > 1) {
        throw new Error(
          "Ese día tiene varias entradas sueltas: editalas desde la pantalla del cronómetro.",
        )
      }

      if (existentes.length === 1) {
        const entrada = existentes[0]
        if (!segundos) {
          const { error: err } = await supabase
            .from("time_entries")
            .delete()
            .eq("id", entrada.id)
          if (err) throw err
        } else {
          const fin = new Date(
            new Date(entrada.start_at).getTime() + segundos * 1000,
          ).toISOString()
          const { error: err } = await supabase
            .from("time_entries")
            .update({ end_at: fin })
            .eq("id", entrada.id)
          if (err) throw err
        }
      } else if (segundos && segundos > 0) {
        const inicio = inicioSugerido(dia)
        const { error: err } = await supabase.from("time_entries").insert({
          workspace_id: espacioId,
          user_id: yoId,
          project_id: fila.project_id,
          edition_id: fila.edition_id,
          task_id: fila.task_id,
          description: fila.descripcion,
          billable: fila.facturable,
          start_at: inicio,
          end_at: new Date(new Date(inicio).getTime() + segundos * 1000).toISOString(),
          source: "semana",
        })
        if (err) throw err
      }

      setNuevas((previas) => previas.filter((n) => n.clave !== fila.clave))
      router.refresh()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(null)
    }
  }

  function irA(nuevoLunes: string) {
    router.push(`/semana?semana=${nuevoLunes}`)
  }

  const hoy = todayKey()

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
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

        <p className="text-sm font-medium">
          {fromDateKey(lunes).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
          })}{" "}
          -{" "}
          {fromDateKey(dias[6]).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {/* Los mismos mandos que en el calendario: la hoja de la semana es
            la misma semana, mirada de otra manera. */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <FiltrosDeHoras catalogo={catalogo} valor={filtros} onChange={setFiltros} />
          {filtrando && (
            <span className="text-xs text-accent">solo lo filtrado</span>
          )}
        </div>

        {/* A la derecha lo de moverse por el tiempo, igual que en el
            calendario; a la izquierda, donde estas. */}
        <div className="ml-auto flex items-center gap-2">
          {lunes !== toDateKey(startOfWeek(new Date())) && (
            <button
              type="button"
              onClick={() => irA(toDateKey(startOfWeek(new Date())))}
              className="btn h-8 text-sm"
            >
              Esta semana
            </button>
          )}

          {/* Se elige un dia y se abre su semana, sin ir de una en una */}
          <label className="relative flex items-center" title="Ir a una semana">
            <CalendarDays
              className="pointer-events-none absolute left-2 h-4 w-4 text-muted"
              aria-hidden
            />
            <input
              type="date"
              value={lunes}
              onChange={(e) => {
                if (!e.target.value) return
                irA(toDateKey(startOfWeek(fromDateKey(e.target.value))))
              }}
              className="field tabular h-8 w-[9.5rem] pl-7 text-sm"
              aria-label="Ir a la semana de este día"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft p-2.5 text-sm text-danger">{error}</p>
      )}

      <div className="card scroll-thin overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-semibold">
                Proyecto
              </th>
              {dias.map((dia) => (
                <th
                  key={dia}
                  className={cn(
                    "px-2 py-2 text-center font-semibold",
                    dia === hoy && "text-accent",
                  )}
                >
                  {fromDateKey(dia)
                    .toLocaleDateString("es-ES", { weekday: "short" })
                    .replace(".", "")}{" "}
                  {fromDateKey(dia).getDate()}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted">
                  No hay horas esta semana. Añade una fila para empezar a rellenar.
                </td>
              </tr>
            )}

            {filas.map((fila) => (
              <tr key={fila.clave}>
                <td className="sticky left-0 z-10 max-w-[18rem] bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: fila.color ?? "var(--border-strong)" }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fila.proyecto}</p>
                      <p className="truncate text-xs text-muted">
                        {fila.descripcion || "Sin descripción"}
                      </p>
                    </div>
                  </div>
                </td>

                {dias.map((dia) => {
                  const delDia = fila.porDia[dia] ?? []
                  const segundos = delDia.reduce(
                    (s, e) => s + (e.duration_seconds ?? 0),
                    0,
                  )
                  /* Se puede escribir en la semana de cualquiera: el equipo
                     corrige lo suyo y lo de los demas. Lo que sigue sin dejarse
                     tocar aqui es una celda con varias horas -hay que ir a la
                     lista- y las horas ya cerradas. */
                  const bloqueada =
                    delDia.length > 1 || delDia.some((e) => e.locked)
                  const cargando = ocupado === `${fila.clave}|${dia}`

                  return (
                    <td key={dia} className="px-1 py-1 text-center">
                      <Celda
                        valor={segundos ? formatDurationShort(segundos) : ""}
                        bloqueada={bloqueada}
                        cargando={cargando}
                        resaltar={dia === hoy}
                        titulo={
                          delDia.length > 1
                            ? `${delDia.length} entradas ese día`
                            : undefined
                        }
                        onGuardar={(texto) => void guardarCelda(fila, dia, texto)}
                      />
                    </td>
                  )
                })}

                <td className="tabular px-3 py-2 text-right font-semibold">
                  {formatDurationShort(totalFila(fila))}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-line bg-surface-2 font-semibold">
              <td className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-sm">
                Total
              </td>
              {dias.map((dia) => {
                const total = totalDia(dia)
                return (
                  <td
                    key={dia}
                    className={cn(
                      "tabular px-2 py-2 text-center text-sm",
                      total === 0 && "font-normal text-muted",
                    )}
                  >
                    {total === 0 ? "–" : formatDurationShort(total)}
                  </td>
                )
              })}
              <td className="tabular px-3 py-2 text-right text-sm text-accent">
                {formatDurationShort(totalSemana)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Anadir una fila que falta, sea tu semana o la de otro */}
      <NuevaFila
        catalogo={catalogo}
        onAnadir={(project_id, task_id, edition_id, descripcion) =>
          setNuevas((previas) => [
            ...previas,
            {
              clave: claveFila(project_id, task_id, edition_id, descripcion),
              project_id,
              task_id,
              edition_id,
              descripcion,
            },
          ])
        }
      />
    </div>
  )
}

function Celda({
  valor,
  bloqueada,
  cargando,
  resaltar,
  titulo,
  onGuardar,
}: {
  valor: string
  bloqueada: boolean
  cargando: boolean
  resaltar: boolean
  titulo?: string
  onGuardar: (texto: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  const [enfocado, setEnfocado] = useState(false)

  // Mientras no se esta editando, manda lo que diga la base
  const mostrado = enfocado ? texto : valor

  if (cargando) {
    return (
      <div className="flex h-9 w-full items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <input
      value={mostrado}
      readOnly={bloqueada}
      title={titulo}
      onFocus={() => {
        setTexto(valor)
        setEnfocado(true)
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setEnfocado(false)
        if (texto !== valor) onGuardar(texto)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          setTexto(valor)
          setEnfocado(false)
          e.currentTarget.blur()
        }
      }}
      placeholder={bloqueada ? "" : "-"}
      className={cn(
        "tabular h-9 w-full rounded-md border border-transparent bg-transparent text-center text-sm transition",
        !bloqueada && "hover:border-line-strong focus:border-accent focus:outline-none",
        bloqueada && "cursor-default text-muted",
        resaltar && "bg-accent-soft/50",
        valor && "font-medium",
      )}
    />
  )
}

function NuevaFila({
  catalogo,
  onAnadir,
}: {
  catalogo: Catalogo
  onAnadir: (
    project_id: string | null,
    task_id: string | null,
    edition_id: string | null,
    descripcion: string,
  ) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [proyecto, setProyecto] = useState<{
    project_id: string | null
    task_id: string | null
    edition_id: string | null
  }>({ project_id: null, task_id: null, edition_id: null })
  const [descripcion, setDescripcion] = useState("")

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn no-print"
      >
        <Plus className="h-4 w-4" />
        Añadir fila
      </button>
    )
  }

  return (
    <div className="card no-print flex flex-wrap items-end gap-3 p-3">
      <div className="min-w-[16rem]">
        <span className="label">Proyecto y tarea</span>
        <SelectorProyecto
          catalogo={catalogo}
          valor={proyecto}
          onChange={setProyecto}
        />
      </div>
      <div className="min-w-[14rem] flex-1">
        <label className="label" htmlFor="fila-descripcion">
          Descripción
        </label>
        <input
          id="fila-descripcion"
          className="field"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          onAnadir(
            proyecto.project_id,
            proyecto.task_id,
            proyecto.edition_id,
            descripcion,
          )
          setProyecto({ project_id: null, task_id: null, edition_id: null })
          setDescripcion("")
          setAbierto(false)
        }}
        disabled={!proyecto.project_id}
        className="btn btn-primary"
      >
        Añadir
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="btn btn-ghost p-2"
        aria-label="Cancelar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
