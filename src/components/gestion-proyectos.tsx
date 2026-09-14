"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Euro,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import {
  COLORES_PROYECTO,
  type Categoria,
  type Proyecto,
  type Tarea,
} from "@/lib/tipos"
import { cn } from "@/lib/utils"

type Borrador = {
  name: string
  color: string
  billable_default: boolean
  budget_hours: string
}

const VACIO: Borrador = {
  name: "",
  color: COLORES_PROYECTO[0],
  billable_default: true,
  budget_hours: "",
}

export function GestionProyectos({
  espacioId,
  proyectos,
  categorias,
  tareas,
}: {
  espacioId: string
  proyectos: Proyecto[]
  categorias: Categoria[]
  tareas: Tarea[]
}) {
  const router = useRouter()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Proyecto | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Radix solo devuelve el foco solo si el boton que abre es un Dialog.Trigger;
     aqui el dialogo se abre desde el lapiz de cada fila, asi que se guarda a
     mano cual fue para poder devolverselo al cerrar. */
  const previoRef = useRef<HTMLElement | null>(null)

  const visibles = proyectos.filter((p) => verArchivados || !p.archived)
  const archivados = proyectos.filter((p) => p.archived).length

  // Agrupados por area -el escalon de arriba-, y los sueltos al final
  const grupos = useMemo(() => {
    const porId = new Map(categorias.map((c) => [c.id, c]))
    const area = (proyecto: Proyecto) => {
      const suya = proyecto.category_id ? porId.get(proyecto.category_id) : null
      if (!suya) return null
      return suya.parent_id ? (porId.get(suya.parent_id) ?? suya) : suya
    }

    const mapa = new Map<string, { titulo: string; orden: number; filas: Proyecto[] }>()
    for (const proyecto of visibles) {
      const suya = area(proyecto)
      const clave = suya?.id ?? "__sin__"
      const titulo = suya?.name ?? "Sin área"
      if (!mapa.has(clave)) mapa.set(clave, { titulo, orden: suya?.position ?? 0, filas: [] })
      mapa.get(clave)!.filas.push(proyecto)
    }
    // En el orden de Categorización, como en el resto de la app
    return [...mapa.entries()]
      .sort((a, b) =>
        a[0] === "__sin__"
          ? 1
          : b[0] === "__sin__"
            ? -1
            : a[1].orden - b[1].orden || a[1].titulo.localeCompare(b[1].titulo),
      )
      .map(([, grupo]) => grupo)
  }, [visibles, categorias])

  async function archivar(proyecto: Proyecto) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("projects")
      .update({ archived: !proyecto.archived })
      .eq("id", proyecto.id)
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Proyectos{" "}
          <span className="text-muted">
            ({proyectos.filter((p) => !p.archived).length})
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {archivados > 0 && (
            <button
              type="button"
              onClick={() => setVerArchivados((v) => !v)}
              className="text-xs font-medium text-muted hover:text-ink"
            >
              {verArchivados ? "Ocultar" : "Ver"} archivados ({archivados})
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreando((v) => !v)}
            className="btn btn-primary py-1.5"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      {creando && (
        <FormularioProyecto
          espacioId={espacioId}
          onHecho={() => setCreando(false)}
          onCancelar={() => setCreando(false)}
        />
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      {visibles.length === 0 && !creando && (
        <p className="py-3 text-sm text-muted">
          Todavía no hay proyectos. Crea el primero para poder cronometrar.
        </p>
      )}

      <div className="mt-2 space-y-4">
        {grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {grupo.titulo}
            </p>
            <ul className="divide-y divide-line">
              {grupo.filas.map((proyecto) => {
                const suyas = tareas.filter((t) => t.project_id === proyecto.id)
                const desplegado = abierto === proyecto.id
                return (
                  <li key={proyecto.id} className={cn(proyecto.archived && "opacity-55")}>
                    <div className="flex items-center gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setAbierto(desplegado ? null : proyecto.id)}
                        className="btn btn-ghost p-1 text-muted"
                        aria-label={`Tareas de ${proyecto.name}`}
                        aria-expanded={desplegado}
                      >
                        {desplegado ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: proyecto.color }}
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {proyecto.name}
                      </span>
                      {proyecto.billable_default && (
                        <Euro className="h-3.5 w-3.5 text-billable" aria-label="Facturable por defecto" />
                      )}
                      {proyecto.budget_hours != null && (
                        <span className="chip tabular">{proyecto.budget_hours} h</span>
                      )}
                      {suyas.length > 0 && (
                        <span className="text-xs text-muted">
                          {suyas.length} {suyas.length === 1 ? "tarea" : "tareas"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          previoRef.current = e.currentTarget
                          setEditando(proyecto)
                        }}
                        className="btn btn-ghost p-1.5 text-muted"
                        aria-label={`Editar ${proyecto.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void archivar(proyecto)}
                        disabled={ocupado}
                        className="btn btn-ghost p-1.5 text-muted"
                        aria-label={
                          proyecto.archived
                            ? `Reactivar ${proyecto.name}`
                            : `Archivar ${proyecto.name}`
                        }
                      >
                        {proyecto.archived ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {desplegado && (
                      <TareasProyecto
                        espacioId={espacioId}
                        proyecto={proyecto}
                        tareas={suyas}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <Dialog.Root
        open={editando !== null}
        onOpenChange={(abierto) => !abierto && setEditando(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              previoRef.current?.focus()
            }}
            className="card fixed inset-x-0 bottom-0 z-50 w-full rounded-b-none p-4 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold">Editar proyecto</Dialog.Title>
              <Dialog.Close className="btn btn-ghost p-1" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            {editando && (
              <FormularioProyecto
                espacioId={espacioId}
                proyecto={editando}
                onHecho={() => setEditando(null)}
                onCancelar={() => setEditando(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}

function FormularioProyecto({
  espacioId,
  proyecto,
  onHecho,
  onCancelar,
}: {
  espacioId: string
  proyecto?: Proyecto
  onHecho: () => void
  onCancelar: () => void
}) {
  const router = useRouter()
  const [valores, setValores] = useState<Borrador>(
    proyecto
      ? {
          name: proyecto.name,
          color: proyecto.color,
          billable_default: proyecto.billable_default,
          budget_hours:
            proyecto.budget_hours != null ? String(proyecto.budget_hours) : "",
        }
      : VACIO,
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    const nombre = valores.name.trim()
    if (!nombre) {
      setError("El proyecto necesita un nombre.")
      return
    }
    const horas = valores.budget_hours.trim().replace(",", ".")
    if (horas && Number.isNaN(Number(horas))) {
      setError("El presupuesto tiene que ser un número de horas.")
      return
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const fila = {
      name: nombre,
      color: valores.color,
      billable_default: valores.billable_default,
      budget_hours: horas ? Number(horas) : null,
    }

    const { error: err } = proyecto
      ? await supabase.from("projects").update(fila).eq("id", proyecto.id)
      : await supabase.from("projects").insert({ ...fila, workspace_id: espacioId })

    setGuardando(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setValores(VACIO)
    router.refresh()
    onHecho()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
      className={cn(
        "space-y-3",
        !proyecto && "mb-3 rounded-lg border border-line bg-surface-2 p-3",
      )}
    >
      <div>
        <label className="label" htmlFor="proyecto-nombre">
          Nombre
        </label>
        <input
          id="proyecto-nombre"
          autoFocus
          className="field"
          value={valores.name}
          onChange={(e) => setValores({ ...valores, name: e.target.value })}
          placeholder="Nombre del proyecto"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-1.5">
            {COLORES_PROYECTO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValores({ ...valores, color: c })}
                aria-label={`Color ${c}`}
                aria-pressed={valores.color === c}
                className={cn(
                  "h-5 w-5 rounded-full border transition",
                  valores.color === c
                    ? "border-ink ring-2 ring-accent/40"
                    : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="w-28">
          <label className="label" htmlFor="proyecto-presupuesto">
            Presupuesto
          </label>
          <input
            id="proyecto-presupuesto"
            className="field tabular"
            value={valores.budget_hours}
            onChange={(e) =>
              setValores({ ...valores, budget_hours: e.target.value })
            }
            placeholder="horas"
            inputMode="decimal"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            setValores({ ...valores, billable_default: !valores.billable_default })
          }
          aria-pressed={valores.billable_default}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
            valores.billable_default
              ? "border-billable-line bg-billable-soft text-billable"
              : "border-line-strong bg-surface text-muted hover:bg-surface-2",
          )}
        >
          <Euro className="h-4 w-4" />
          {valores.billable_default ? "Facturable" : "No facturable"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft p-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn btn-primary">
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          {proyecto ? "Guardar" : "Crear proyecto"}
        </button>
      </div>
    </form>
  )
}

function TareasProyecto({
  espacioId,
  proyecto,
  tareas,
}: {
  espacioId: string
  proyecto: Proyecto
  tareas: Tarea[]
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    const limpio = nombre.trim()
    if (!limpio) return
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("tasks")
      .insert({ workspace_id: espacioId, name: limpio, project_id: proyecto.id })
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setNombre("")
    router.refresh()
  }

  async function archivar(tarea: Tarea) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("tasks")
      .update({ archived: !tarea.archived })
      .eq("id", tarea.id)
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
  }

  return (
    <div className="mb-2 ml-8 rounded-lg border border-line bg-surface-2 p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void crear()
        }}
        className="flex gap-2"
      >
        <input
          className="field py-1"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva tarea"
          aria-label={`Nueva tarea en ${proyecto.name}`}
        />
        <button
          type="submit"
          disabled={ocupado || !nombre.trim()}
          className="btn shrink-0 py-1"
        >
          {ocupado ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Añadir
        </button>
      </form>

      {error && (
        <p className="mt-2 rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      {tareas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tareas.map((tarea) => (
            <li
              key={tarea.id}
              className={cn(
                "flex items-center gap-2 text-sm",
                tarea.archived && "opacity-55",
              )}
            >
              <span className="flex-1 truncate">{tarea.name}</span>
              {tarea.archived && <span className="chip">Archivada</span>}
              <button
                type="button"
                onClick={() => void archivar(tarea)}
                disabled={ocupado}
                className="text-muted transition hover:text-ink"
                aria-label={
                  tarea.archived
                    ? `Reactivar ${tarea.name}`
                    : `Archivar ${tarea.name}`
                }
              >
                {tarea.archived ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
