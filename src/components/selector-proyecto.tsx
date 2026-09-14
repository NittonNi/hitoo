"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as Popover from "@radix-ui/react-popover"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Layers,
  Loader2,
  Plus,
  Search,
  Star,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useSesion } from "@/components/proveedor-sesion"
import { SelectorColor } from "@/components/selector-color"
import {
  COLORES_PROYECTO,
  type Catalogo,
  type Proyecto,
  type Tarea,
} from "@/lib/tipos"
import { cn } from "@/lib/utils"

export type Seleccion = {
  project_id: string | null
  task_id: string | null
  /** La edicion, si el proyecto tiene: TBCE 1, TBCE 2... */
  edition_id: string | null
}

const sinAcentos = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

export function SelectorProyecto({
  catalogo,
  valor,
  onChange,
  compacto = false,
  autoFoco = false,
  autoAbrir = false,
  invita = false,
  onAbiertoChange,
}: {
  catalogo: Catalogo
  valor: Seleccion
  onChange: (seleccion: Seleccion) => void
  compacto?: boolean
  autoFoco?: boolean
  /** Empieza desplegado: se usa al editar una fila en el sitio. */
  autoAbrir?: boolean
  /**
   * Arriba del todo, al apuntar algo nuevo, esto no es un dato que falte: es lo
   * siguiente que hay que hacer. Se pide en vez de constatar que esta vacio.
   */
  invita?: boolean
  /**
   * Para cuando esto vive dentro de otro dialogo: el clic que cierra este
   * desplegable no tiene que cerrar tambien el de fuera. Quien lo use puede
   * mirar esto y decirle a su propio dialogo que se aguante un clic.
   */
  onAbiertoChange?: (abierto: boolean) => void
}) {
  const router = useRouter()
  const { espacio, perfil, rol } = useSesion()
  const puedeCrear = rol === "admin" || rol === "manager"

  const [abierto, setAbierto] = useState(autoAbrir)
  const [vista, setVista] = useState<"lista" | "nuevo">("lista")
  const [filtro, setFiltro] = useState("")
  const [desplegados, setDesplegados] = useState<string[]>([])
  const [anadiendoEn, setAnadiendoEn] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Los proyectos de cada uno, arriba del todo. Se piden al abrir: es una
     consulta minima y asi no viajan en cada pagina que use el selector. */
  const [favoritos, setFavoritos] = useState<string[]>([])

  const campoBusqueda = useRef<HTMLInputElement>(null)

  /**
   * Lo recien creado desde aquí. El catalogo viene del servidor y tarda un
   * instante en volver; hasta entonces se pinta de esta lista.
   */
  const [reciente, setReciente] = useState<{
    proyectos: Proyecto[]
    tareas: Tarea[]
  }>({ proyectos: [], tareas: [] })

  const proyectos = useMemo(() => {
    const vistos = new Set(catalogo.proyectos.map((p) => p.id))
    return [...catalogo.proyectos, ...reciente.proyectos.filter((p) => !vistos.has(p.id))]
      .filter((p) => !p.archived)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [catalogo.proyectos, reciente.proyectos])

  const tareas = useMemo(() => {
    const vistas = new Set(catalogo.tareas.map((t) => t.id))
    return [...catalogo.tareas, ...reciente.tareas.filter((t) => !vistas.has(t.id))].filter(
      (t) => !t.archived,
    )
  }, [catalogo.tareas, reciente.tareas])

  const consulta = filtro.trim()
  const q = sinAcentos(consulta)

  /** Proyectos que encajan, con las tareas que encajan dentro. */
  const visibles = useMemo(() => {
    return proyectos
      .map((proyecto) => {
        const suyas = tareas.filter((t) => t.project_id === proyecto.id)
        if (!q) return { proyecto, tareas: suyas, coincide: true }

        const textoProyecto = sinAcentos(proyecto.name)
        const proyectoEncaja = textoProyecto.includes(q)
        const tareasQueEncajan = suyas.filter((t) => sinAcentos(t.name).includes(q))
        return {
          proyecto,
          tareas: proyectoEncaja ? suyas : tareasQueEncajan,
          coincide: proyectoEncaja || tareasQueEncajan.length > 0,
        }
      })
      .filter((fila) => fila.coincide)
  }, [proyectos, tareas, q])

  /**
   * Los proyectos, por areas: primero los favoritos de quien mira -lo que
   * tiene entre manos- y despues cada area con los suyos. El area es el primer
   * escalon de la categorizacion; lo que no tiene, al final.
   */
  const grupos = useMemo(() => {
    const areaDe = (proyecto: Proyecto) => {
      const suya = catalogo.categorias.find((c) => c.id === proyecto.category_id)
      if (!suya) return null
      return suya.parent_id
        ? (catalogo.categorias.find((c) => c.id === suya.parent_id) ?? suya)
        : suya
    }

    const mios = visibles.filter((v) => favoritos.includes(v.proyecto.id))
    const resto = visibles.filter((v) => !favoritos.includes(v.proyecto.id))

    const porArea = new Map<string, { titulo: string; orden: number; filas: typeof visibles }>()
    for (const fila of resto) {
      const area = areaDe(fila.proyecto)
      const clave = area?.id ?? "sin-area"
      const grupo = porArea.get(clave) ?? {
        titulo: area?.name ?? "Sin área",
        orden: area?.position ?? 0,
        filas: [],
      }
      grupo.filas.push(fila)
      porArea.set(clave, grupo)
    }

    // En el orden de Categorización
    const ordenados = [...porArea.entries()]
      .sort((a, b) => {
        if (a[0] === "sin-area") return 1
        if (b[0] === "sin-area") return -1
        return a[1].orden - b[1].orden || a[1].titulo.localeCompare(b[1].titulo, "es")
      })
      .map(([clave, grupo]) => ({ clave, titulo: grupo.titulo, filas: grupo.filas }))

    return mios.length > 0
      ? [{ clave: "favoritos", titulo: "Tuyos", filas: mios }, ...ordenados]
      : ordenados
  }, [visibles, favoritos, catalogo.categorias])

  const proyectoElegido = proyectos.find((p) => p.id === valor.project_id) ?? null
  const tareaElegida = tareas.find((t) => t.id === valor.task_id) ?? null
  const edicionElegida =
    catalogo.ediciones.find((e) => e.id === valor.edition_id) ?? null

  async function cargarFavoritos() {
    const { data } = await createClient()
      .from("project_favorites")
      .select("project_id")
      .eq("workspace_id", espacio.id)
    setFavoritos((data ?? []).map((f) => f.project_id))
  }

  async function alternarFavorito(proyectoId: string) {
    const esta = favoritos.includes(proyectoId)
    setFavoritos((antes) =>
      esta ? antes.filter((id) => id !== proyectoId) : [...antes, proyectoId],
    )
    const supabase = createClient()
    if (esta) {
      await supabase
        .from("project_favorites")
        .delete()
        .eq("project_id", proyectoId)
        .eq("user_id", perfil.id)
    } else {
      await supabase.from("project_favorites").insert({
        user_id: perfil.id,
        project_id: proyectoId,
        workspace_id: espacio.id,
      })
    }
  }

  function cerrar() {
    setAbierto(false)
    setVista("lista")
    setFiltro("")
    setAnadiendoEn(null)
    setError(null)
    onAbiertoChange?.(false)
  }

  /**
   * Se elige de una vez: proyecto, y dentro la edicion o la tarea. Cambiar de
   * proyecto tira la edicion y la tarea, que eran de otro.
   */
  /**
   * Elegir no cierra: una hora suele llevar proyecto, edicion y tarea, y
   * cerrar despues de cada clic obligaba a abrir el desplegable tres veces.
   * Se cierra cuando uno dice que ha terminado, con Listo, Escape o pinchando
   * fuera.
   */
  function elegir(
    project_id: string | null,
    task_id: string | null,
    edition_id: string | null = null,
  ) {
    onChange({ project_id, task_id, edition_id })
    // Al elegir proyecto se abre solo: la edicion y las tareas estan ahi dentro
    if (project_id) {
      setDesplegados((previos) =>
        previos.includes(project_id) ? previos : [...previos, project_id],
      )
    }
  }

  function alternar(id: string) {
    setDesplegados((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    )
  }

  async function crearTarea(proyectoId: string, nombre: string) {
    const limpio = nombre.trim()
    if (!limpio) return

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("tasks")
      .insert({ workspace_id: espacio.id, project_id: proyectoId, name: limpio })
      .select("*")
      .single()

    if (err || !data) {
      setError(mensajeError(err))
      return
    }
    setReciente((r) => ({ ...r, tareas: [...r.tareas, data] }))
    setAnadiendoEn(null)
    router.refresh()
    elegir(proyectoId, data.id)
  }

  return (
    /* En un portal: dentro de una fila con overflow oculto se recortaria */
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        if (v) {
          setAbierto(true)
          onAbiertoChange?.(true)
          void cargarFavoritos()
        } else {
          cerrar()
        }
      }}
    >
      <Popover.Trigger
        autoFocus={autoFoco}
        className={cn(
          "flex w-full items-center gap-2 rounded-[var(--radio-sm)] border border-line-strong bg-surface px-2.5 text-left text-sm transition hover:bg-surface-2",
          compacto ? "h-8" : "h-9",
        )}
        aria-haspopup="listbox"
      >
        {proyectoElegido ? (
          <>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: proyectoElegido.color }}
            />
            <span className="min-w-0 flex-1 truncate">
              <span
                className="font-medium"
                style={{ color: proyectoElegido.color }}
              >
                {proyectoElegido.name}
              </span>
              {/* La edicion, aqui mismo: si no, poner una en curso parecia no
                  hacer nada y habia que abrir el desplegable para verlo */}
              {edicionElegida && (
                <span className="text-muted"> · {edicionElegida.name}</span>
              )}
              {tareaElegida && (
                <span className="text-muted"> · {tareaElegida.name}</span>
              )}
            </span>
          </>
        ) : (
          <>
            <FolderOpen
              className={cn(
                "h-4 w-4 shrink-0",
                invita ? "text-accent" : "text-muted",
              )}
            />
            <span
              className={cn(
                "flex-1 truncate",
                invita ? "font-medium text-accent" : "text-muted",
              )}
            >
              {invita ? "Añadir proyecto" : "Sin proyecto"}
            </span>
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            campoBusqueda.current?.focus()
          }}
          className="card z-50 w-[23rem] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {vista === "nuevo" ? (
            <FormularioProyecto
              espacioId={espacio.id}
              nombreSugerido={consulta}
              cuantos={proyectos.length}
              onVolver={() => setVista("lista")}
              onCreado={(proyecto) => {
                setReciente((r) => ({ ...r, proyectos: [...r.proyectos, proyecto] }))
                router.refresh()
                elegir(proyecto.id, null)
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input
                  ref={campoBusqueda}
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault()
                      cerrar()
                    }
                  }}
                  placeholder="Buscar proyecto o tarea"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>

              <div className="scroll-thin max-h-[19rem] overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => elegir(null, null)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-surface-2"
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="flex-1">Sin proyecto</span>
                  {!valor.project_id && <Check className="h-4 w-4 text-accent" />}
                </button>

                {grupos.map((grupo) => (
                  <div key={grupo.clave}>
                    <p className="rotulo px-3 pb-0.5 pt-2">{grupo.titulo}</p>
                    {grupo.filas.map(({ proyecto, tareas: suyas }) => {
                  const desplegado = desplegados.includes(proyecto.id) || q.length > 0
                  const elegido = valor.project_id === proyecto.id
                  const ediciones = catalogo.ediciones.filter(
                    (e) => e.project_id === proyecto.id && !e.archived,
                  )

                  return (
                    <div key={proyecto.id}>
                      <div
                        className={cn(
                          "flex items-center gap-1 pr-1.5 transition hover:bg-surface-2",
                          elegido && !valor.task_id && "bg-surface-2",
                        )}
                      >
                        <button
                          type="button"
                          /* Con edicion en curso puesta, elegir el proyecto
                             ya la trae: un paso menos cada vez que se apunta */
                          onClick={() =>
                            elegir(proyecto.id, null, proyecto.default_edition_id)
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3 text-left text-sm"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: proyecto.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {/* Del color del proyecto, como en las tarjetas de
                                horas: se reconoce sin leerlo */}
                            <span
                              className="font-medium"
                              style={{ color: proyecto.color }}
                            >
                              {proyecto.name}
                            </span>
                          </span>
                          {elegido && !valor.task_id && (
                            <Check className="h-4 w-4 shrink-0 text-accent" />
                          )}
                        </button>

                        {/* Lo que se usa a diario, arriba del todo */}
                        <button
                          type="button"
                          onClick={() => void alternarFavorito(proyecto.id)}
                          aria-pressed={favoritos.includes(proyecto.id)}
                          aria-label={
                            favoritos.includes(proyecto.id)
                              ? `Quitar ${proyecto.name} de los tuyos`
                              : `Poner ${proyecto.name} arriba del todo`
                          }
                          title={
                            favoritos.includes(proyecto.id)
                              ? "Quitarlo de los tuyos"
                              : "Ponerlo arriba del todo"
                          }
                          className={cn(
                            "shrink-0 rounded-[6px] p-1.5 transition",
                            favoritos.includes(proyecto.id)
                              ? "text-live"
                              : "text-muted hover:bg-surface-3 hover:text-ink",
                          )}
                        >
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              favoritos.includes(proyecto.id) && "fill-current",
                            )}
                          />
                        </button>

                        {/* Desplegar no es elegir: por eso va aparte */}
                        <button
                          type="button"
                          onClick={() => alternar(proyecto.id)}
                          aria-label={
                            desplegado
                              ? `Ocultar tareas de ${proyecto.name}`
                              : `Ver tareas de ${proyecto.name}`
                          }
                          aria-expanded={desplegado}
                          /* Se ve que es un boton: sin marco no se sabia que
                             ahi dentro habia ediciones y tareas. */
                          className="shrink-0 rounded-[6px] border border-line bg-surface p-1.5 text-muted transition hover:border-line-strong hover:bg-surface-2 hover:text-ink"
                        >
                          {desplegado ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {desplegado && (
                        <div className="ml-[1.4rem] border-l border-line pl-1">
                          {ediciones.length > 0 && (
                            <>
                              <p className="rotulo px-3 pb-0.5 pt-1.5">Ediciones</p>
                              {ediciones.map((edicion) => (
                                <button
                                  key={edicion.id}
                                  type="button"
                                  /* Vuelta a pulsar, se quita: es una
                                     casilla, no un camino de ida */
                                  onClick={() =>
                                    elegir(
                                      proyecto.id,
                                      valor.project_id === proyecto.id
                                        ? valor.task_id
                                        : null,
                                      valor.edition_id === edicion.id
                                        ? null
                                        : edicion.id,
                                    )
                                  }
                                  className={cn(
                                    "flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left text-sm transition hover:bg-surface-2",
                                    valor.edition_id === edicion.id && "bg-surface-2",
                                  )}
                                >
                                  <Layers
                                    className="h-3.5 w-3.5 shrink-0 text-muted"
                                    aria-hidden
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {edicion.name}
                                  </span>
                                  {valor.edition_id === edicion.id && (
                                    <Check className="h-4 w-4 shrink-0 text-accent" />
                                  )}
                                </button>
                              ))}
                              {suyas.length > 0 && (
                                <p className="rotulo px-3 pb-0.5 pt-2">Tareas</p>
                              )}
                            </>
                          )}

                          {suyas.map((tarea) => (
                            <button
                              key={tarea.id}
                              type="button"
                              onClick={() =>
                                elegir(
                                  proyecto.id,
                                  valor.task_id === tarea.id ? null : tarea.id,
                                  valor.project_id === proyecto.id
                                    ? valor.edition_id
                                    : null,
                                )
                              }
                              className={cn(
                                "flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left text-sm transition hover:bg-surface-2",
                                valor.task_id === tarea.id && "bg-surface-2",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {tarea.name}
                              </span>
                              {valor.task_id === tarea.id && (
                                <Check className="h-4 w-4 shrink-0 text-accent" />
                              )}
                            </button>
                          ))}

                          {puedeCrear &&
                            (anadiendoEn === proyecto.id ? (
                              <CampoNuevaTarea
                                onGuardar={(nombre) => void crearTarea(proyecto.id, nombre)}
                                onCancelar={() => setAnadiendoEn(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAnadiendoEn(proyecto.id)}
                                className="flex w-full items-center gap-1.5 py-1.5 pl-3 pr-2 text-left text-sm text-accent transition hover:bg-surface-2"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Añadir tarea
                              </button>
                            ))}

                          {suyas.length === 0 && !puedeCrear && (
                            <p className="py-1.5 pl-3 text-xs text-muted">
                              Sin tareas.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                  </div>
                ))}

                {visibles.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted">
                    {consulta
                      ? `Nada coincide con «${consulta}».`
                      : "Todavía no hay proyectos."}
                  </p>
                )}
              </div>

              {error && (
                <p className="border-t border-line bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              {puedeCrear && (
                <button
                  type="button"
                  onClick={() => setVista("nuevo")}
                  className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm font-medium text-accent transition hover:bg-surface-2"
                >
                  <Plus className="h-4 w-4" />
                  Crear nuevo proyecto
                </button>
              )}

              {/* Como ya no se cierra al elegir, hace falta decir que has
                  terminado. Tambien vale Escape o pinchar fuera. */}
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {proyectoElegido ? (
                    <>
                      {proyectoElegido.name}
                      {edicionElegida && ` · ${edicionElegida.name}`}
                      {tareaElegida && ` · ${tareaElegida.name}`}
                    </>
                  ) : (
                    "Sin proyecto"
                  )}
                </span>
                <button
                  type="button"
                  onClick={cerrar}
                  className="btn btn-primary h-7 shrink-0 px-2.5 text-xs"
                >
                  Listo
                </button>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ------------------------------------------------------------ tarea nueva */

function CampoNuevaTarea({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (nombre: string) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState("")
  const [guardando, setGuardando] = useState(false)

  return (
    <div className="flex items-center gap-1 py-1 pl-3 pr-2">
      <input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (!nombre.trim()) return
            setGuardando(true)
            onGuardar(nombre)
          }
          if (e.key === "Escape") {
            e.preventDefault()
            onCancelar()
          }
        }}
        onBlur={() => !guardando && !nombre.trim() && onCancelar()}
        placeholder="Nombre de la tarea"
        className="field py-1 text-sm"
      />
      <button
        type="button"
        onClick={() => {
          if (!nombre.trim()) return
          setGuardando(true)
          onGuardar(nombre)
        }}
        disabled={guardando || !nombre.trim()}
        className="btn btn-primary shrink-0 px-2 py-1"
        aria-label="Guardar tarea"
      >
        {guardando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

/* --------------------------------------------------------- proyecto nuevo */

function FormularioProyecto({
  espacioId,
  nombreSugerido,
  cuantos,
  onVolver,
  onCreado,
}: {
  espacioId: string
  nombreSugerido: string
  cuantos: number
  onVolver: () => void
  onCreado: (proyecto: Proyecto) => void
}) {
  const [nombre, setNombre] = useState(nombreSugerido)
  const [color, setColor] = useState<string>(
    COLORES_PROYECTO[cuantos % COLORES_PROYECTO.length],
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    const limpio = nombre.trim()
    if (!limpio) {
      setError("Ponle un nombre.")
      return
    }
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("projects")
      .insert({
        workspace_id: espacioId,
        name: limpio,
        color,
      })
      .select("*")
      .single()

    setGuardando(false)
    if (err || !data) {
      setError(mensajeError(err))
      return
    }
    onCreado(data)
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-2 py-2">
        <button
          type="button"
          onClick={onVolver}
          className="btn btn-ghost p-1"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">Nuevo proyecto</p>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <label className="label" htmlFor="sp-nombre">
            Nombre
          </label>
          <input
            id="sp-nombre"
            autoFocus
            className="field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void crear()
              }
            }}
            placeholder="Rediseño de la web"
          />
        </div>

        <div>
          <span className="label">Color</span>
          <SelectorColor valor={color} onChange={setColor} />
        </div>

        {error && (
          <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onVolver} className="btn">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void crear()}
            disabled={guardando || !nombre.trim()}
            className="btn btn-primary"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear y usar
          </button>
        </div>
      </div>
    </div>
  )
}
