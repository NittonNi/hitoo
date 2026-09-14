"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { ChevronRight, LayoutGrid, List, Search } from "lucide-react"

import { NuevoProyecto } from "@/components/nuevo-proyecto"
import { FiltroMultiple } from "@/components/filtro-multiple"
import { caminoDe } from "@/lib/categorias"
import { formatDateShort, formatDurationShort, formatMoney } from "@/lib/time"
import type { Categoria, Proyecto, Tarea } from "@/lib/tipos"
import { cn } from "@/lib/utils"

export type ResumenProyecto = {
  project_id: string
  segundos: number
  segundos_facturables: number
  importe: number
  entradas: number
  ultima: string | null
}

/* ---------------------------------------------------------- vista elegida */

/**
 * Lista o tarjetas. Se guarda en el navegador porque es una manera de mirar,
 * no un dato del espacio: cada uno tiene la suya y no tiene por que viajar al
 * servidor ni imponersela al resto del equipo.
 */
type Vista = "lista" | "tarjetas"
const CLAVE_VISTA = "clockleinn:proyectos:vista"
const oyentes = new Set<() => void>()

function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

function leerVista(): Vista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "tarjetas" ? "tarjetas" : "lista"
  } catch {
    return "lista"
  }
}

function guardarVista(vista: Vista) {
  try {
    localStorage.setItem(CLAVE_VISTA, vista)
  } catch {
    // Navegador sin almacenamiento: la vista dura lo que dure la pestaña
  }
  oyentes.forEach((avisar) => avisar())
}

/* --------------------------------------------------------------- pantalla */

const SIN_RAMA = "sin-rama"

/** Por que se ordena la lista. Por nombre es como venian del catalogo. */
type Orden = "nombre" | "horas" | "reciente" | "presupuesto" | "importe"

/** Que parte del presupuesto se ha comido, en %, o null si no tiene. */
function gastadoDe(proyecto: Proyecto, datos: ResumenProyecto | undefined) {
  const presupuesto = proyecto.budget_hours ?? null
  if (!presupuesto || presupuesto <= 0) return null
  // Sin topar: si se pasa del presupuesto tiene que poder decir "120%", no
  // quedarse en "100%" como si fuera lo mismo que ir justo.
  return ((datos?.segundos ?? 0) / 3600 / presupuesto) * 100
}

export function PanelProyectos({
  espacioId,
  proyectos,
  tareas,
  categorias,
  resumen,
  gestor,
  puedeCrear,
}: {
  espacioId: string
  proyectos: Proyecto[]
  tareas: Tarea[]
  categorias: Categoria[]
  resumen: ResumenProyecto[]
  /** Ve las horas y los importes de todo el equipo. */
  gestor: boolean
  /** Crea proyectos: el coach ve como un gestor, pero no crea. */
  puedeCrear: boolean
}) {
  const vista = useSyncExternalStore(suscribir, leerVista, () => "lista" as Vista)
  const [busqueda, setBusqueda] = useState("")
  const [categoriasElegidas, setCategoriasElegidas] = useState<string[]>([])
  const [subcategoriasElegidas, setSubcategoriasElegidas] = useState<string[]>([])
  const [estado, setEstado] = useState<"activos" | "archivados" | "todos">(
    "activos",
  )
  const [presupuesto, setPresupuesto] = useState<
    "cualquiera" | "margen" | "pasados" | "sin"
  >("cualquiera")
  const [orden, setOrden] = useState<Orden>("nombre")

  const porProyecto = useMemo(
    () => new Map(resumen.map((fila) => [fila.project_id, fila])),
    [resumen],
  )

  /* La categorizacion tiene dos niveles y el filtro tambien: primero de que
     va -Backoffice, Proyectos- y luego, si hace falta, el detalle. */
  const padres = useMemo(
    () =>
      categorias
        .filter((c) => !c.archived && !c.parent_id)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [categorias],
  )

  /* Las categorias salen siempre, no solo despues de elegir area: obligar a
     un clic previo para poder filtrar es un peaje. Si hay areas marcadas, se
     quedan las suyas. */
  const hijas = useMemo(
    () =>
      categorias
        .filter(
          (c) =>
            !c.archived &&
            c.parent_id &&
            (categoriasElegidas.length === 0 ||
              categoriasElegidas.includes(c.parent_id)),
        )
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [categorias, categoriasElegidas],
  )

  /** Una categoria y todo lo que cuelga de ella. */
  const conSusHijas = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const c of categorias) {
      const suyas = mapa.get(c.id) ?? new Set([c.id])
      suyas.add(c.id)
      mapa.set(c.id, suyas)
      if (c.parent_id) {
        const delPadre = mapa.get(c.parent_id) ?? new Set([c.parent_id])
        delPadre.add(c.id)
        mapa.set(c.parent_id, delPadre)
      }
    }
    return mapa
  }, [categorias])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return proyectos.filter((p) => {
      if (estado === "activos" && p.archived) return false
      if (estado === "archivados" && !p.archived) return false

      if (categoriasElegidas.length > 0) {
        /* Con varias categorias marcadas vale con estar en cualquiera de
           ellas -o en algo que cuelgue de ellas-. */
        const dentro = categoriasElegidas.some((id) =>
          id === SIN_RAMA
            ? !p.category_id
            : Boolean(p.category_id && conSusHijas.get(id)?.has(p.category_id)),
        )
        if (!dentro) return false
      }

      // Las subcategorias afinan: si hay alguna marcada, tiene que ser una de esas
      if (subcategoriasElegidas.length > 0) {
        if (!p.category_id || !subcategoriasElegidas.includes(p.category_id)) {
          return false
        }
      }

      /* El presupuesto se mira para saber a cual le queda margen y a cual se
         le ha ido de las manos. */
      if (presupuesto !== "cualquiera") {
        const gastado = gastadoDe(p, porProyecto.get(p.id))
        if (presupuesto === "sin" && gastado !== null) return false
        if (presupuesto === "margen" && (gastado === null || gastado >= 100)) {
          return false
        }
        if (presupuesto === "pasados" && (gastado === null || gastado < 100)) {
          return false
        }
      }

      if (!texto) return true
      /* Nombre y categorizacion: es como los busca la gente. */
      const donde = [p.name, caminoDe(categorias, p.category_id) ?? ""]
        .join(" ")
        .toLowerCase()
      return donde.includes(texto)
    })
  }, [
    proyectos,
    categorias,
    conSusHijas,
    busqueda,
    categoriasElegidas,
    subcategoriasElegidas,
    estado,
    presupuesto,
    porProyecto,
  ])

  /* Ordenar es otra forma de preguntar: cuales pesan mas, cuales se han
     quedado parados, a cual se le acaba el presupuesto. Por nombre es como
     vienen del catalogo, asi que ahi no hace falta tocar nada. */
  const ordenados = useMemo(() => {
    if (orden === "nombre") return filtrados
    const lista = [...filtrados]
    const dato = (p: Proyecto) => porProyecto.get(p.id)
    if (orden === "horas") {
      lista.sort((a, b) => (dato(b)?.segundos ?? 0) - (dato(a)?.segundos ?? 0))
    } else if (orden === "importe") {
      lista.sort(
        (a, b) => Number(dato(b)?.importe ?? 0) - Number(dato(a)?.importe ?? 0),
      )
    } else if (orden === "reciente") {
      // Los que nunca han tenido horas caen al final, no al principio
      lista.sort((a, b) =>
        (dato(b)?.ultima ?? "").localeCompare(dato(a)?.ultima ?? ""),
      )
    } else if (orden === "presupuesto") {
      // Los que no tienen presupuesto no compiten: van los ultimos
      lista.sort(
        (a, b) =>
          (gastadoDe(b, dato(b)) ?? -1) - (gastadoDe(a, dato(a)) ?? -1),
      )
    }
    return lista
  }, [filtrados, orden, porProyecto])

  /* Lo que suma lo que se esta mirando. Con filtros puestos el numero es otro,
     y se avisa en azul como en el calendario. */
  const total = useMemo(() => {
    let segundos = 0
    let importe = 0
    for (const p of filtrados) {
      const datos = porProyecto.get(p.id)
      segundos += datos?.segundos ?? 0
      importe += Number(datos?.importe ?? 0)
    }
    return { segundos, importe }
  }, [filtrados, porProyecto])

  const hayFiltros = Boolean(
    busqueda ||
      categoriasElegidas.length > 0 ||
      subcategoriasElegidas.length > 0 ||
      presupuesto !== "cualquiera" ||
      estado !== "activos",
  )

  /* El mando del presupuesto solo aparece si alguno lo tiene puesto: un filtro
     que no puede cambiar nada es ruido. */
  const hayPresupuestos = useMemo(
    () => proyectos.some((p) => (p.budget_hours ?? 0) > 0),
    [proyectos],
  )

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Proyectos</h1>
          {proyectos.length > 0 && (
            <span className={cn("chip", hayFiltros && "border-accent text-accent")}>
              {filtrados.length}
              {filtrados.length === 1 ? " proyecto" : " proyectos"} ·{" "}
              {formatDurationShort(total.segundos)}
              {gestor && total.importe > 0 && ` · ${formatMoney(total.importe)}`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {gestor ? "Las horas del equipo en cada uno." : "Tus horas en cada uno."}
        </p>
      </div>

      {/* --------------------------------------------------------- barra */}
      {/* A la izquierda con que se acota, en medio con que se busca y a la
          derecha como se mira y el boton de crear. */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
          className="field w-auto rounded-[3px] py-1.5"
          aria-label="Estado"
        >
          <option value="activos">Activos</option>
          <option value="archivados">Archivados</option>
          <option value="todos">Todos</option>
        </select>

        {padres.length > 0 && (
          <FiltroMultiple
            etiqueta="Área"
            todos="Todas las áreas"
            opciones={[
              { id: SIN_RAMA, nombre: "Sin área" },
              ...padres.map((c) => ({ id: c.id, nombre: c.name })),
            ]}
            elegidas={categoriasElegidas}
            onChange={(ids) => {
              setCategoriasElegidas(ids)
              // Las subcategorias de una categoria que ya no esta marcada sobran
              setSubcategoriasElegidas((antes) =>
                antes.filter((sub) => {
                  const suya = categorias.find((c) => c.id === sub)
                  return suya?.parent_id ? ids.includes(suya.parent_id) : false
                }),
              )
            }}
          />
        )}

        {/* Sale siempre que el espacio tenga categorias, sin esperar a que se
            elija un area antes. */}
        {hijas.length > 0 && (
          <FiltroMultiple
            etiqueta="Categoría"
            todos="Todas las categorías"
            opciones={hijas.map((c) => ({ id: c.id, nombre: c.name }))}
            elegidas={subcategoriasElegidas}
            onChange={setSubcategoriasElegidas}
          />
        )}

        {hayPresupuestos && (
          <select
            value={presupuesto}
            onChange={(e) =>
              setPresupuesto(e.target.value as typeof presupuesto)
            }
            className="field w-auto rounded-[3px] py-1.5"
            aria-label="Presupuesto"
          >
            <option value="cualquiera">Cualquier presupuesto</option>
            <option value="margen">Le queda margen</option>
            <option value="pasados">Se ha pasado</option>
            <option value="sin">Sin presupuesto</option>
          </select>
        )}

        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="field rounded-[3px] py-1.5 pl-8"
            placeholder="Buscar por nombre o por categoría"
            type="search"
            aria-label="Buscar un proyecto"
          />
        </div>

        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="field w-auto rounded-[3px] py-1.5"
          aria-label="Ordenar"
        >
          <option value="nombre">Por nombre</option>
          <option value="horas">Más horas</option>
          <option value="reciente">Más reciente</option>
          {hayPresupuestos && (
            <option value="presupuesto">Presupuesto apurado</option>
          )}
          {gestor && <option value="importe">Más facturado</option>}
        </select>

        <BotonVista vista={vista} />

        {/* Siempre al final de su fila: con los filtros puestos la barra se
            parte en dos y el boton de crear no puede quedar suelto a la
            izquierda, debajo del primer desplegable. */}
        {puedeCrear && (
          <div className="ml-auto">
            <NuevoProyecto espacioId={espacioId} categorias={categorias} />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- listado */}
      {filtrados.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-sm font-medium">
            {hayFiltros ? "Nada encaja con eso" : "Aún no hay proyectos"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {hayFiltros
              ? "Prueba a quitar algún filtro. Se busca por nombre y por la categoría."
              : puedeCrear
                ? "Crea el primero y ya puedes empezar a apuntar horas contra él."
                : "Pide a un administrador que cree los del equipo."}
          </p>
        </div>
      ) : vista === "lista" ? (
        <div className="card divide-y divide-line overflow-hidden">
          {ordenados.map((proyecto) => (
            <FilaProyecto
              key={proyecto.id}
              proyecto={proyecto}
              datos={porProyecto.get(proyecto.id)}
              tareas={tareas}
              categorias={categorias}
              conImportes={gestor}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenados.map((proyecto) => (
            <TarjetaProyecto
              key={proyecto.id}
              proyecto={proyecto}
              datos={porProyecto.get(proyecto.id)}
              tareas={tareas}
              categorias={categorias}
              conImportes={gestor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ como mirar */

function BotonVista({ vista }: { vista: Vista }) {
  return (
    <div
      role="group"
      aria-label="Cómo se ven los proyectos"
      className="flex shrink-0 rounded-[6px] border border-line bg-surface-2 p-0.5"
    >
      {(
        [
          { clave: "lista", icono: List, texto: "En lista" },
          { clave: "tarjetas", icono: LayoutGrid, texto: "En tarjetas" },
        ] as const
      ).map(({ clave, icono: Icono, texto }) => (
        <button
          key={clave}
          type="button"
          onClick={() => guardarVista(clave)}
          title={texto}
          aria-label={texto}
          aria-pressed={vista === clave}
          className={cn(
            "rounded-[2px] p-1.5 transition",
            vista === clave
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          <Icono className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- un proyecto */

/** Lo que se cuenta de un proyecto, se pinte como se pinte. */
function useDatos({
  proyecto,
  datos,
  tareas,
}: {
  proyecto: Proyecto
  datos: ResumenProyecto | undefined
  tareas: Tarea[]
}) {
  const suyas = tareas.filter(
    (t) => t.project_id === proyecto.id && !t.archived,
  ).length
  const horas = datos?.segundos ?? 0
  const presupuesto = proyecto.budget_hours ?? null
  const consumido = gastadoDe(proyecto, datos)
  return { suyas, horas, presupuesto, consumido }
}

function FilaProyecto({
  proyecto,
  datos,
  tareas,
  categorias,
  conImportes,
}: {
  proyecto: Proyecto
  datos: ResumenProyecto | undefined
  tareas: Tarea[]
  categorias: Categoria[]
  conImportes: boolean
}) {
  const { suyas, horas, presupuesto, consumido } = useDatos({
    proyecto,
    datos,
    tareas,
  })
  const rama = caminoDe(categorias, proyecto.category_id)

  return (
    <Link
      href={`/proyectos/${proyecto.id}`}
      className={cn(
        "pulsable flex items-center gap-3 px-4 py-3 hover:bg-surface-2",
        proyecto.archived && "opacity-55",
      )}
    >
      <span
        aria-hidden
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ background: proyecto.color }}
      />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{proyecto.name}</span>
          {rama && <span className="chip shrink-0">{rama}</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {suyas > 0 && `${suyas} ${suyas === 1 ? "tarea" : "tareas"}`}
          {suyas > 0 && datos?.ultima && " · "}
          {datos?.ultima && `última el ${formatDateShort(datos.ultima)}`}
        </p>
      </div>

      {consumido !== null && (
        <div className="hidden w-28 shrink-0 sm:block">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, consumido)}%`,
                background: consumido > 100 ? "var(--danger)" : proyecto.color,
              }}
            />
          </div>
          <p
            className={cn(
              "cifra mt-1 text-[11px]",
              consumido > 100 ? "font-medium text-danger" : "text-muted",
            )}
          >
            {Math.round(consumido)}% de {presupuesto} h
          </p>
        </div>
      )}

      <div className="shrink-0 text-right">
        <p className="cifra text-sm font-semibold">{formatDurationShort(horas)}</p>
        {conImportes && (datos?.importe ?? 0) > 0 && (
          <p className="cifra text-[11px] text-billable">
            {formatMoney(Number(datos?.importe ?? 0))}
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  )
}

function TarjetaProyecto({
  proyecto,
  datos,
  tareas,
  categorias,
  conImportes,
}: {
  proyecto: Proyecto
  datos: ResumenProyecto | undefined
  tareas: Tarea[]
  categorias: Categoria[]
  conImportes: boolean
}) {
  const { suyas, horas, presupuesto, consumido } = useDatos({
    proyecto,
    datos,
    tareas,
  })
  const rama = caminoDe(categorias, proyecto.category_id)

  return (
    <Link
      href={`/proyectos/${proyecto.id}`}
      className={cn(
        "pulsable card flex flex-col gap-3 border-t-[3px] p-4 hover:bg-surface-2",
        proyecto.archived && "opacity-55",
      )}
      style={{ borderTopColor: proyecto.color }}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{proyecto.name}</p>
        <p className="truncate text-xs text-muted">
          {suyas > 0
            ? `${suyas} ${suyas === 1 ? "tarea" : "tareas"}`
            : "Sin tareas"}
        </p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="cifra text-xl font-semibold leading-none">
            {formatDurationShort(horas)}
          </p>
          {conImportes && (datos?.importe ?? 0) > 0 && (
            <p className="cifra mt-1 text-[11px] text-billable">
              {formatMoney(Number(datos?.importe ?? 0))}
            </p>
          )}
        </div>
        {rama && <span className="chip shrink-0 truncate">{rama}</span>}
      </div>

      {consumido !== null ? (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, consumido)}%`,
                background: consumido > 100 ? "var(--danger)" : proyecto.color,
              }}
            />
          </div>
          <p
            className={cn(
              "cifra mt-1 text-[11px]",
              consumido > 100 ? "font-medium text-danger" : "text-muted",
            )}
          >
            {Math.round(consumido)}% de {presupuesto} h
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          {datos?.ultima ? `Última el ${formatDateShort(datos.ultima)}` : "Sin horas todavía"}
        </p>
      )}
    </Link>
  )
}
