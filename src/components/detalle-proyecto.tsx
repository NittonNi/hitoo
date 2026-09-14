"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Archive,
  ArrowLeft,
  Check,
  Euro,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { SelectorColor } from "@/components/selector-color"
import { caminoDe, ramas, SIN_CATEGORIA } from "@/lib/categorias"
import { esAdmin } from "@/lib/roles"
import { useSesion } from "@/components/proveedor-sesion"
import { agrupar, totales } from "@/lib/informes"
import {
  formatClock,
  formatDateShort,
  formatDurationShort,
  formatMoney,
} from "@/lib/time"
import { DialogoEntrada } from "@/components/dialogo-entrada"
import type {
  Catalogo,
  Categoria,
  Edicion,
  EntradaVista,
  Miembro,
  Proyecto,
  Tarea,
} from "@/lib/tipos"
import {
  resumenDeResultados,
  type Resultado,
} from "@/components/resultados-proyecto"
import type { DatosHolded } from "@/lib/holded"
import { ObjetivoDelProyecto } from "@/components/objetivo-hora"
import { ResumenProyecto } from "@/components/resumen-proyecto"
import { TarjetasEdicion } from "@/components/tarjetas-edicion"
import { cn } from "@/lib/utils"

/**
 * Las pestañas del proyecto. Todo lo de un proyecto en una sola columna hacía
 * que pesara lo mismo cerrar una edición que cambiarle el color; separado, cada
 * cosa se busca donde toca.
 */
const PESTANAS: {
  clave: "resumen" | "ediciones" | "tareas" | "horas" | "ajustes"
  etiqueta: string
  soloGestor?: boolean
}[] = [
  { clave: "resumen", etiqueta: "Resumen" },
  { clave: "ediciones", etiqueta: "Ediciones" },
  { clave: "tareas", etiqueta: "Tareas" },
  { clave: "horas", etiqueta: "Horas" },
  { clave: "ajustes", etiqueta: "Ajustes", soloGestor: true },
]

type Pestana = (typeof PESTANAS)[number]["clave"]

/** Los cuatro tipos de trabajo del equipo, cada uno se cierra a su ritmo. */
const TIPOS = [
  { clave: "evento", etiqueta: "Evento" },
  { clave: "b2b", etiqueta: "B2B recurrente" },
  { clave: "oportunidad", etiqueta: "Oportunidad" },
  { clave: "b2c", etiqueta: "B2C recurrente" },
] as const

export function DetalleProyecto({
  proyecto,
  categorias,
  tareas,
  ediciones,
  entradas,
  resultados,
  catalogo,
  miembros,
  objetivoDelEquipo,
  espacioId,
  puedeGestionar,
  puedeVerImportes,
  holded,
}: {
  proyecto: Proyecto
  categorias: Categoria[]
  tareas: Tarea[]
  ediciones: Edicion[]
  entradas: EntradaVista[]
  resultados: Resultado[]
  /** Para poder corregir una hora sin salir del proyecto. */
  catalogo: Catalogo
  miembros: Miembro[]
  /** Facturacion por hora a la que aspira el equipo, si no la pisa el proyecto. */
  objetivoDelEquipo: number | null
  espacioId: string
  puedeGestionar: boolean
  puedeVerImportes: boolean
  /** Lo de Holded; null si quien mira no ve importes. */
  holded: DatosHolded | null
}) {
  const parametros = useSearchParams()

  // Las horas se corrigen aqui mismo, como en los informes
  const [editando, setEditando] = useState<EntradaVista | null>(null)
  const cerradas = useMemo(() => entradas.filter((e) => e.end_at), [entradas])
  const suma = useMemo(() => totales(cerradas), [cerradas])

  const visibles = PESTANAS.filter((p) => !p.soloGestor || puedeGestionar)
  const pedida = parametros.get("ver")

  /* La pestana empieza donde diga la URL -asi se puede pasar el enlace de una
     parte concreta- pero a partir de ahi manda el estado: cambiarla no tiene
     que ir y volver del servidor. La URL se actualiza al margen del router,
     que es lo que la deja instantanea. */
  const [activa, setActiva] = useState<Pestana>(
    () => (visibles.find((p) => p.clave === pedida)?.clave as Pestana) ?? "resumen",
  )

  function abrir(clave: Pestana) {
    setActiva(clave)
    const url = new URL(window.location.href)
    if (clave === "resumen") url.searchParams.delete("ver")
    else url.searchParams.set("ver", clave)
    window.history.replaceState(null, "", url)
  }

  const porTarea = useMemo(
    () =>
      agrupar(
        cerradas,
        (e) => e.task_id ?? "sin",
        (e) => e.task_name ?? "Sin tarea",
      ),
    [cerradas],
  )
  /* El proyecto puede tener el suyo: no todo se mide con la misma vara. */
  const objetivoHora = proyecto.target_hourly_rate ?? objetivoDelEquipo

  const dinero = useMemo(
    () => resumenDeResultados(entradas, resultados),
    [entradas, resultados],
  )

  /* Cuando empezo y cuando acabo, sin escribir una sola fecha: la primera hora
     apuntada -o el dia que se creo- y la ultima. */
  const dias = cerradas.map((e) => e.local_date).sort()
  const nacio = dias[0] ?? proyecto.created_at.slice(0, 10)
  const ultima = dias[dias.length - 1] ?? null

  return (
    <div className="space-y-5">
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Link>

      {/* ------------------------------------------------------- cabecera */}
      {/* Lo que no cambia al moverte entre pestanas: de que proyecto va y como
          va. Las tres cifras que se miran de verdad, a la derecha. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="h-10 w-1.5 shrink-0 rounded-full"
            style={{ background: proyecto.color }}
          />
          <div className="min-w-0">
            <h1 className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="truncate text-lg font-semibold tracking-tight"
                style={{ color: proyecto.color }}
              >
                {proyecto.name}
              </span>
              {proyecto.kind && (
                <span className="chip shrink-0">
                  {TIPOS.find((t) => t.clave === proyecto.kind)?.etiqueta}
                </span>
              )}
              {caminoDe(categorias, proyecto.category_id) && (
                <span className="chip shrink-0">
                  {caminoDe(categorias, proyecto.category_id)}
                </span>
              )}
            </h1>
            <p className="truncate text-sm text-muted">
              Desde el {formatDateShort(nacio)}
              {ultima
                ? ` hasta el ${formatDateShort(ultima)}`
                : ", sin horas todavia"}
              {proyecto.archived && " · archivado"}
            </p>
          </div>
        </div>

        <div className="flex items-end gap-5">
          <Cifra etiqueta="Horas" valor={formatDurationShort(suma.segundos)} />
          <Cifra
            etiqueta="Se cobran"
            valor={formatDurationShort(suma.facturables)}
            tono={suma.facturables > 0 ? "billable" : undefined}
          />
          {puedeVerImportes && dinero.porHora !== null && (
            <Cifra
              etiqueta={objetivoHora ? `de ${objetivoHora} €/h` : "por hora"}
              valor={`${dinero.porHora.toLocaleString("es-ES", {
                maximumFractionDigits: 0,
              })} €/h`}
              tono={
                objetivoHora == null
                  ? undefined
                  : dinero.porHora >= objetivoHora
                    ? "billable"
                    : "danger"
              }
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- pestanas */}
      {/* En movil se desliza; nada de esconderlas en un menu. */}
      <div className="no-print -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-line">
          {visibles.map((pestana) => {
            const puesta = pestana.clave === activa
            return (
              <button
                key={pestana.clave}
                type="button"
                role="tab"
                aria-selected={puesta}
                onClick={() => abrir(pestana.clave as Pestana)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition",
                  puesta
                    ? "border-accent font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {pestana.etiqueta}
              </button>
            )
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- resumen */}
      {activa === "resumen" && (
        <ResumenProyecto
          entradas={cerradas}
          resultados={resultados}
          ediciones={ediciones}
          objetivoHora={objetivoHora}
          color={proyecto.color}
          puedeVerImportes={puedeVerImportes}
        />
      )}

      {/* ------------------------------------------------------ ediciones */}
      {activa === "ediciones" && (
        <TarjetasEdicion
          espacioId={espacioId}
          proyectoId={proyecto.id}
          nombreProyecto={proyecto.name}
          holded={holded}
          ediciones={ediciones}
          entradas={cerradas}
          resultados={resultados}
          objetivoHora={objetivoHora}
          predeterminada={proyecto.default_edition_id}
          puedeGestionar={puedeGestionar}
          puedeVerImportes={puedeVerImportes}
        />
      )}

      {/* --------------------------------------------------------- tareas */}
      {activa === "tareas" && (
        <Tareas
          espacioId={espacioId}
          proyectoId={proyecto.id}
          tareas={tareas}
          porTarea={porTarea}
          puedeGestionar={puedeGestionar}
        />
      )}

      {/* ---------------------------------------------------------- horas */}
      {activa === "horas" && (
        <HorasDelProyecto
          entradas={cerradas}
          ediciones={ediciones}
          conImportes={puedeVerImportes}
          onAbrir={setEditando}
        />
      )}

      {/* -------------------------------------------------------- ajustes */}
      {activa === "ajustes" && puedeGestionar && (
        <AjustesProyecto
          proyecto={proyecto}
          categorias={categorias}
          objetivoDelEquipo={objetivoDelEquipo}
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
    </div>
  )
}

/* ------------------------------------------------------------------ piezas */

/**
 * Un numero de la cabecera. Se queda arriba pase lo que pase en las pestanas:
 * son los tres que se miran de un vistazo.
 */
function Cifra({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string
  valor: string
  tono?: "billable" | "danger"
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "cifra whitespace-nowrap text-lg font-semibold leading-none",
          tono === "billable" && "text-billable",
          tono === "danger" && "text-danger",
        )}
      >
        {valor}
      </p>
      <p className="mt-1 whitespace-nowrap text-xs text-muted">{etiqueta}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ tareas */

function Tareas({
  espacioId,
  proyectoId,
  tareas,
  porTarea,
  puedeGestionar,
}: {
  espacioId: string
  proyectoId: string
  tareas: Tarea[]
  porTarea: ReturnType<typeof agrupar>
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const horasDe = (id: string) =>
    porTarea.find((g) => g.clave === id)?.segundos ?? 0

  async function ejecutar(accion: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true)
    setError(null)
    const { error: err } = await accion()
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return false
    }
    router.refresh()
    return true
  }

  async function crear() {
    const limpio = nombre.trim()
    if (!limpio) return
    const supabase = createClient()
    const ok = await ejecutar(() =>
      supabase
        .from("tasks")
        .insert({ workspace_id: espacioId, project_id: proyectoId, name: limpio }),
    )
    if (ok) setNombre("")
  }

  async function renombrar(id: string) {
    const limpio = borrador.trim()
    if (!limpio) return
    const supabase = createClient()
    const ok = await ejecutar(() =>
      supabase.from("tasks").update({ name: limpio }).eq("id", id),
    )
    if (ok) setEditando(null)
  }

  async function archivar(tarea: Tarea) {
    const supabase = createClient()
    await ejecutar(() =>
      supabase.from("tasks").update({ archived: !tarea.archived }).eq("id", tarea.id),
    )
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-sm font-semibold">
        Tareas <span className="text-muted">({tareas.filter((t) => !t.archived).length})</span>
      </h2>
      <p className="mb-3 text-xs text-muted">
        Las formas fijas de desglosar este proyecto. Salen al elegirlo, y desde
        ahí también se crean.
      </p>

      {puedeGestionar && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void crear()
          }}
          className="mb-3 flex gap-2"
        >
          <input
            className="field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nueva tarea"
            aria-label="Nueva tarea"
          />
          <button
            type="submit"
            disabled={ocupado || !nombre.trim()}
            className="btn btn-primary shrink-0"
          >
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Añadir
          </button>
        </form>
      )}

      {error && (
        <p className="mb-2 rounded-[var(--radio-sm)] bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      {tareas.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Este proyecto no tiene tareas todavía.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {tareas.map((tarea) => (
            <li
              key={tarea.id}
              className={cn(
                "flex items-center gap-2 py-2",
                tarea.archived && "opacity-55",
              )}
            >
              {editando === tarea.id ? (
                <>
                  <input
                    autoFocus
                    className="field py-1"
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void renombrar(tarea.id)
                      if (e.key === "Escape") setEditando(null)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void renombrar(tarea.id)}
                    className="btn btn-ghost p-1.5"
                    aria-label="Guardar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="btn btn-ghost p-1.5"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{tarea.name}</span>
                  {tarea.archived && <span className="chip">Archivada</span>}
                  <span className="cifra shrink-0 text-sm text-muted">
                    {formatDurationShort(horasDe(tarea.id))}
                  </span>
                  {puedeGestionar && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(tarea.id)
                          setBorrador(tarea.name)
                        }}
                        className="btn btn-ghost p-1.5 text-muted"
                        aria-label={`Renombrar ${tarea.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void archivar(tarea)}
                        disabled={ocupado}
                        className="btn btn-ghost p-1.5 text-muted"
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
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ horas */

/**
 * Todas las horas del proyecto, editables igual que en los informes: se pulsa
 * una y se corrige. Con el filtro de edicion se mira una sola tanda.
 */
function HorasDelProyecto({
  entradas,
  ediciones,
  conImportes,
  onAbrir,
}: {
  entradas: EntradaVista[]
  ediciones: Edicion[]
  conImportes: boolean
  onAbrir: (entrada: EntradaVista) => void
}) {
  const [edicion, setEdicion] = useState("")
  /* De cien en cien: pintar las 3.561 horas de NITTON de golpe eran 14 s de
     pestaña congelada. */
  const [pintadas, setPintadas] = useState(100)

  const suyas = useMemo(() => {
    if (!edicion) return entradas
    if (edicion === "sin") return entradas.filter((e) => !e.edition_id)
    return entradas.filter((e) => e.edition_id === edicion)
  }, [entradas, edicion])

  const segundos = suyas.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const visibles = suyas.slice(0, pintadas)

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            Horas <span className="text-muted">({suyas.length.toLocaleString("es-ES")})</span>
          </h2>
          <p className="text-sm text-muted">
            Pulsa una para corregirla, igual que en los informes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="cifra text-sm font-semibold">
            {formatDurationShort(segundos)}
          </span>
          {ediciones.length > 0 && (
            <select
              className="field w-auto py-1"
              value={edicion}
              onChange={(e) => {
                setEdicion(e.target.value)
                setPintadas(100)
              }}
              aria-label="Edición"
            >
              <option value="">Todas las ediciones</option>
              {ediciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
              <option value="sin">Sin edición</option>
            </select>
          )}
        </div>
      </div>

      {suyas.length === 0 ? (
        <p className="py-3 text-sm text-muted">
          Todavía no hay horas apuntadas aquí.
        </p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Fecha</th>
                <th className="th hidden md:table-cell">Horario</th>
                <th className="th">Persona</th>
                <th className="th">Descripción</th>
                <th className="th text-right">Duración</th>
                {conImportes && <th className="th text-right">Importe</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibles.map((entrada) => (
                <tr
                  key={entrada.id}
                  onClick={() => onAbrir(entrada)}
                  className="cursor-pointer transition hover:bg-surface-2"
                  title="Pulsa para corregirla"
                >
                  <td className="cifra whitespace-nowrap py-2 pr-3 text-muted">
                    {formatDateShort(entrada.local_date)}
                  </td>
                  <td className="cifra hidden whitespace-nowrap py-2 pr-3 text-muted md:table-cell">
                    {formatClock(entrada.start_at)}–{formatClock(entrada.end_at)}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3">
                    {entrada.user_name}
                  </td>
                  <td className="max-w-[24rem] truncate py-2 pr-3 text-muted">
                    {entrada.description || "-"}
                    {entrada.task_name && (
                      <span className="chip ml-2">{entrada.task_name}</span>
                    )}
                    {entrada.edition_name && !edicion && (
                      <span className="chip ml-2">{entrada.edition_name}</span>
                    )}
                  </td>
                  <td className="cifra py-2 pr-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1">
                      {entrada.billable && (
                        <Euro
                          className="h-3 w-3 text-billable"
                          aria-label="Facturable"
                        />
                      )}
                      {formatDurationShort(entrada.duration_seconds)}
                    </span>
                  </td>
                  {conImportes && (
                    <td className="cifra py-2 text-right text-billable">
                      {entrada.amount
                        ? formatMoney(Number(entrada.amount))
                        : "-"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {suyas.length > pintadas && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
              <button type="button" onClick={() => setPintadas((n) => n + 100)} className="btn">
                Ver 100 más
              </button>
              <button type="button" onClick={() => setPintadas(suyas.length)} className="btn btn-ghost">
                Ver las {suyas.length.toLocaleString("es-ES")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- ajustes */

/**
 * Lo que se toca de vez en cuando: como se llama, de que color es, de que rama
 * cuelga y si sus horas nacen facturables. Ya no es un dialogo: es una pestana
 * mas, porque tampoco es algo que estorbe donde esta.
 */
function AjustesProyecto({
  proyecto,
  categorias,
  objetivoDelEquipo,
}: {
  proyecto: Proyecto
  categorias: Categoria[]
  /** El de casa, contra el que se mide si el proyecto no tiene el suyo. */
  objetivoDelEquipo: number | null
}) {
  const router = useRouter()
  const { rol } = useSesion()
  const [nombre, setNombre] = useState(proyecto.name)
  const [categoriaId, setCategoriaId] = useState(proyecto.category_id ?? "")
  const [color, setColor] = useState(proyecto.color)
  const [facturable, setFacturable] = useState(proyecto.billable_default)
  const [tipo, setTipo] = useState(proyecto.kind ?? "")
  const [presupuesto, setPresupuesto] = useState(
    proyecto.budget_hours != null ? String(proyecto.budget_hours) : "",
  )
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiado =
    nombre !== proyecto.name ||
    categoriaId !== (proyecto.category_id ?? "") ||
    color !== proyecto.color ||
    facturable !== proyecto.billable_default ||
    tipo !== (proyecto.kind ?? "") ||
    presupuesto.trim() !==
      (proyecto.budget_hours != null ? String(proyecto.budget_hours) : "")

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) {
      setError("El proyecto necesita un nombre.")
      return
    }
    /* La coma tambien vale: aqui se escriben horas, no numeros de programador. */
    const horas = presupuesto.trim().replace(",", ".")
    if (horas && (Number.isNaN(Number(horas)) || Number(horas) < 0)) {
      setError("El presupuesto tiene que ser un número de horas.")
      return
    }
    setGuardando(true)
    setError(null)
    const { error: err } = await createClient()
      .from("projects")
      .update({
        name: limpio,
        category_id: categoriaId || null,
        color,
        billable_default: facturable,
        kind: (tipo || null) as Proyecto["kind"],
        budget_hours: horas ? Number(horas) : null,
      })
      .eq("id", proyecto.id)

    setGuardando(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setGuardado(true)
    router.refresh()
  }

  async function archivar() {
    setGuardando(true)
    const { error: err } = await createClient()
      .from("projects")
      .update({ archived: !proyecto.archived })
      .eq("id", proyecto.id)
    setGuardando(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ajustes del proyecto</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void guardar()
          }}
          className="space-y-3"
        >
          <div>
            <label className="label" htmlFor="ap-nombre">
              Nombre
            </label>
            <input
              id="ap-nombre"
              className="field"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                setGuardado(false)
              }}
            />
          </div>

          <div>
            <label className="label" htmlFor="ap-tipo">
              Tipo de trabajo
            </label>
            <select
              id="ap-tipo"
              className="field"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as typeof tipo)
                setGuardado(false)
              }}
            >
              <option value="">Sin decidir</option>
              {TIPOS.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              Cada tipo se cierra a su ritmo: el evento por edición, lo
              recurrente cada mes.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="ap-presupuesto">
              Presupuesto de horas
            </label>
            <input
              id="ap-presupuesto"
              className="field tabular w-32"
              value={presupuesto}
              onChange={(e) => {
                setPresupuesto(e.target.value)
                setGuardado(false)
              }}
              placeholder="sin tope"
              inputMode="decimal"
            />
            <p className="mt-1.5 text-xs text-muted">
              Cuántas horas se le han puesto. En el listado sale cuánto se lleva
              gastado.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="ap-categoria">
              Área y categoría
            </label>
            <select
              id="ap-categoria"
              className="field"
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value)
                setGuardado(false)
              }}
            >
              <option value="">{SIN_CATEGORIA}</option>
              {ramas(
                categorias.filter((c) => !c.archived || c.id === categoriaId),
              ).map(({ categoria, camino }) => (
                <option key={categoria.id} value={categoria.id}>
                  {camino}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Color</span>
            <SelectorColor
              valor={color}
              onChange={(c) => {
                setColor(c)
                setGuardado(false)
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setFacturable((v) => !v)
              setGuardado(false)
            }}
            aria-pressed={facturable}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-[var(--radio-sm)] border px-3 text-sm transition",
              facturable
                ? "border-billable-line bg-billable-soft text-billable"
                : "border-line-strong bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Euro className="h-4 w-4" />
            {facturable
              ? "Las horas nacen facturables"
              : "Las horas nacen sin facturar"}
          </button>

          {error && (
            <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <button
              type="submit"
              disabled={guardando || !cambiado}
              className="btn btn-primary"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
            {guardado && !cambiado && (
              <span className="flex items-center gap-1 text-sm text-running">
                <Check className="h-4 w-4" />
                Guardado
              </span>
            )}
          </div>
        </form>
      </section>

      <div className="space-y-5">
        {/* Aquí se elige contra qué se mide este proyecto: el de casa o uno
            suyo. El del equipo se cambia en Tarifas. */}
        <ObjetivoDelProyecto
          proyectoId={proyecto.id}
          propio={proyecto.target_hourly_rate}
          delEquipo={objetivoDelEquipo}
          puedeCambiar={esAdmin(rol)}
        />

        <section className="card p-4">
          <h2 className="mb-1 text-sm font-semibold">
            {proyecto.archived ? "Proyecto archivado" : "Archivar el proyecto"}
          </h2>
          <p className="mb-3 text-sm text-muted">
            {proyecto.archived
              ? "No sale al apuntar horas. Sus horas siguen contando en los informes."
              : "Deja de salir al apuntar horas, pero no se borra nada: las horas apuntadas siguen contando en los informes."}
          </p>
          <button
            type="button"
            onClick={() => void archivar()}
            disabled={guardando}
            className={proyecto.archived ? "btn" : "btn btn-danger"}
          >
            {proyecto.archived ? (
              <>
                <RotateCcw className="h-4 w-4" />
                Reactivar
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Archivar
              </>
            )}
          </button>
        </section>
      </div>
    </div>
  )
}
