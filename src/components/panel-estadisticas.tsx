"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Maximize2, Minimize2, TrendingDown, TrendingUp, X } from "lucide-react"

import { agrupar, totales, type Grupo } from "@/lib/informes"
import { CajaTooltip } from "@/components/caja-tooltip"
import { categoriasRaiz, formatObjetivo, ramas, SIN_CATEGORIA } from "@/lib/categorias"
import { calcularAtribucion } from "@/lib/reparto"
import {
  anterior,
  claveYEtiqueta,
  DIAS,
  dentro,
  diasDe,
  franjaViva,
  mapaDeCalor,
  serie,
  unidadPara,
  type Rango,
  type Unidad,
} from "@/lib/estadisticas"
import {
  addDays,
  formatDurationShort,
  formatMoney,
  startOfWeek,
  toDateKey,
  todayKey,
} from "@/lib/time"
import { FiltroMultiple } from "@/components/filtro-multiple"
import {
  filtrarHoras,
  FiltrosDeHoras,
  hayFiltros,
  SIN_FILTROS,
  type Filtros,
} from "@/components/filtros-horas"
import type { Catalogo, EntradaVista, Miembro, Reparto, RepartoShare } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * Los informes responden «qué horas hay». Esto responde «cómo vamos», y está
 * hecho para mirarlo en grupo: se acota el periodo, se compara con el anterior
 * y cada corte -por área, por persona, por proyecto- tiene su forma de verse.
 *
 * Nada de esto se corrige aquí. Para arreglar una hora están los informes.
 */

type Preset = { clave: string; etiqueta: string; rango: () => Rango }

function mesDe(fecha: Date): Rango {
  const primero = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const ultimo = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
  return { desde: toDateKey(primero), hasta: toDateKey(ultimo) }
}

const PRESETS: Preset[] = [
  {
    clave: "mes",
    etiqueta: "Este mes",
    rango: () => ({ ...mesDe(new Date()), hasta: todayKey() }),
  },
  {
    clave: "pasado",
    etiqueta: "Mes pasado",
    rango: () => {
      const hoy = new Date()
      return mesDe(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))
    },
  },
  {
    clave: "90",
    etiqueta: "90 días",
    rango: () => ({
      desde: toDateKey(addDays(new Date(), -89)),
      hasta: todayKey(),
    }),
  },
  {
    clave: "ano",
    etiqueta: "Este año",
    rango: () => ({
      desde: `${new Date().getFullYear()}-01-01`,
      hasta: todayKey(),
    }),
  },
  {
    clave: "12m",
    etiqueta: "12 meses",
    rango: () => {
      const hoy = new Date()
      return {
        desde: toDateKey(new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)),
        hasta: todayKey(),
      }
    },
  },
]

/**
 * Los colores del donut. No se usa el de cada área a proposito: nacen todas
 * del mismo gris y el grafico salia de un solo color.
 */
const PALETA = [
  "var(--accent)",
  "var(--billable-fill)",
  "var(--live-fill)",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#64748b",
]

/** Con que dato se ha cruzado la pagina entera: un clic en cualquier grafica. */
type Foco = { tipo: "area" | "proyecto" | "persona"; clave: string; etiqueta: string }

/**
 * Las cuatro gráficas de recharts, aparte y cargadas solo en el navegador:
 * recharts pesa varios cientos de KB y no tiene sentido traerlo en el primer
 * JS de /estadisticas si esta pagina va a tardar en pintarse de todas formas
 * -mismo patrón que grafico-resumen-proyecto.tsx-.
 */
const HuecoGrafico = () => (
  <div className="h-full w-full animate-pulse rounded-[var(--radio-sm)] bg-surface-2" />
)
const GraficoRitmoEstadisticas = dynamic(
  () =>
    import("@/components/grafico-ritmo-estadisticas").then(
      (mod) => mod.GraficoRitmoEstadisticas,
    ),
  { ssr: false, loading: HuecoGrafico },
)
const GraficoAreaEstadisticas = dynamic(
  () =>
    import("@/components/grafico-area-estadisticas").then(
      (mod) => mod.GraficoAreaEstadisticas,
    ),
  { ssr: false, loading: HuecoGrafico },
)
const GraficoPersonasEstadisticas = dynamic(
  () =>
    import("@/components/grafico-personas-estadisticas").then(
      (mod) => mod.GraficoPersonasEstadisticas,
    ),
  { ssr: false, loading: HuecoGrafico },
)
const GraficoPorHoraEstadisticas = dynamic(
  () =>
    import("@/components/grafico-porhora-estadisticas").then(
      (mod) => mod.GraficoPorHoraEstadisticas,
    ),
  { ssr: false, loading: HuecoGrafico },
)

export function PanelEstadisticas({
  entradas,
  catalogo,
  miembros,
  perfilId,
  puedeVerImportes,
  objetivoHora,
  objetivoDiaMinutos,
  objetivoSemanaMinutos,
  repartos,
  repartoShares,
}: {
  entradas: EntradaVista[]
  catalogo: Catalogo
  miembros: Miembro[]
  perfilId: string
  puedeVerImportes: boolean
  /** Facturación por hora a la que aspira el equipo. */
  objetivoHora: number | null
  /** Objetivos del espacio, para la seccion de Objetivos -siempre de hoy/esta semana. */
  objetivoDiaMinutos: number | null
  objetivoSemanaMinutos: number | null
  repartos: Reparto[]
  repartoShares: RepartoShare[]
}) {
  const hayEquipo = miembros.length > 1

  const [preset, setPreset] = useState("12m")
  const [rangoLibre, setRangoLibre] = useState<Rango | null>(null)
  const [ambito, setAmbito] = useState<"mias" | "equipo">(
    hayEquipo ? "equipo" : "mias",
  )
  const [personas, setPersonas] = useState<string[]>([])
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [comparar, setComparar] = useState(true)
  const [presentando, setPresentando] = useState(false)
  const [unidadForzada, setUnidadForzada] = useState<"auto" | Unidad>("auto")
  const [foco, setFoco] = useState<Foco | null>(null)

  function alternarFoco(nuevo: Foco) {
    setFoco((actual) =>
      actual && actual.tipo === nuevo.tipo && actual.clave === nuevo.clave
        ? null
        : nuevo,
    )
  }

  const rango = useMemo(
    () =>
      rangoLibre ??
      (PRESETS.find((p) => p.clave === preset) ?? PRESETS[4]).rango(),
    [preset, rangoLibre],
  )

  /* -------------------------------------------------------------- filtrar */

  const suyas = useMemo(() => {
    const base = entradas.filter(
      (e) => e.end_at && (ambito === "equipo" || e.user_id === perfilId),
    )
    const porPersona =
      personas.length > 0 ? base.filter((e) => personas.includes(e.user_id)) : base
    return filtrarHoras(porPersona, filtros)
  }, [entradas, ambito, perfilId, personas, filtros])

  /* El foco es un filtro mas, puesto encima de todos los demas: clicar un
     dato de cualquier grafica acota el resto de la pagina a eso. */
  const conFoco = useMemo(() => {
    if (!foco) return suyas
    if (foco.tipo === "area") {
      return suyas.filter((e) => (e.category_id ?? "sin") === foco.clave)
    }
    if (foco.tipo === "proyecto") {
      return suyas.filter((e) => (e.project_id ?? "sin") === foco.clave)
    }
    return suyas.filter((e) => e.user_id === foco.clave)
  }, [suyas, foco])

  const dentroDel = useMemo(
    () => conFoco.filter((e) => dentro(e, rango)),
    [conFoco, rango],
  )
  const antes = useMemo(() => {
    const previo = anterior(rango)
    return conFoco.filter((e) => dentro(e, previo))
  }, [conFoco, rango])

  /* --------------------------------------------------------------- cuentas */

  const suma = useMemo(() => totales(dentroDel), [dentroDel])
  const sumaAntes = useMemo(() => totales(antes), [antes])

  const unidad = useMemo(
    () => (unidadForzada === "auto" ? unidadPara(rango) : unidadForzada),
    [rango, unidadForzada],
  )
  const puntos = useMemo(
    () => serie(dentroDel, rango, unidad, comparar ? antes : undefined),
    [dentroDel, rango, unidad, comparar, antes],
  )

  const porArea = useMemo(
    () =>
      agrupar(
        dentroDel,
        (e) => e.category_id ?? "sin",
        (e) => e.category_name ?? SIN_CATEGORIA,
      ),
    [dentroDel],
  )
  const porPersona = useMemo(
    () => agrupar(dentroDel, (e) => e.user_id, (e) => e.user_name),
    [dentroDel],
  )

  /* El color de cada area es fijo -sale del catalogo entero, no de la
     posicion en la lista filtrada-: si no, al clicar y quedar una sola area
     visible, esa area "roba" siempre el primer color de la paleta en vez de
     mantener el suyo. */
  const coloresArea = useMemo(() => {
    const mapa = new Map<string, string>()
    const raices = categoriasRaiz(catalogo.categorias)
    raices.forEach((c, i) => mapa.set(c.id, PALETA[i % PALETA.length]))
    mapa.set("sin", PALETA[raices.length % PALETA.length])
    return mapa
  }, [catalogo.categorias])
  const porProyecto = useMemo(
    () =>
      agrupar(
        dentroDel,
        (e) => e.project_id ?? "sin",
        (e) => e.project_name ?? "Sin proyecto",
        (e) => e.project_color,
      ),
    [dentroDel],
  )
  const porHoraProyectos = useMemo(
    () =>
      porProyecto
        .filter((g) => g.facturables > 0 && g.importe > 0)
        .map((g) => ({
          clave: g.clave,
          nombre: g.etiqueta,
          color: g.color ?? "var(--accent)",
          porHora: Math.round((g.importe / (g.facturables / 3600)) * 10) / 10,
        }))
        .sort((a, b) => b.porHora - a.porHora)
        .slice(0, 10),
    [porProyecto],
  )

  /* Desglose por proyecto y por persona dentro de cada area, para que el
     tooltip del donut cuente algo de verdad -no solo el total del area-. */
  const desgloseArea = useMemo(() => {
    const mapa = new Map<string, { proyectos: ReturnType<typeof agrupar>; personas: ReturnType<typeof agrupar> }>()
    for (const g of porArea) {
      const deEsaArea = dentroDel.filter((e) => (e.category_id ?? "sin") === g.clave)
      mapa.set(g.clave, {
        proyectos: agrupar(
          deEsaArea,
          (e) => e.project_id ?? "sin",
          (e) => e.project_name ?? "Sin proyecto",
        ),
        personas: agrupar(deEsaArea, (e) => e.user_id, (e) => e.user_name),
      })
    }
    return mapa
  }, [porArea, dentroDel])

  /* Mismo criterio, pero por punto de la serie temporal: que hay detras de
     cada barra de "como va el ritmo". */
  const desglosePunto = useMemo(() => {
    const porClave = new Map<string, EntradaVista[]>()
    for (const e of dentroDel) {
      const { clave } = claveYEtiqueta(e.local_date, unidad)
      const lista = porClave.get(clave)
      if (lista) lista.push(e)
      else porClave.set(clave, [e])
    }
    const mapa = new Map<string, { proyectos: Grupo[]; personas: Grupo[] }>()
    for (const [clave, lista] of porClave) {
      mapa.set(clave, {
        proyectos: agrupar(lista, (e) => e.project_id ?? "sin", (e) => e.project_name ?? "Sin proyecto"),
        personas: agrupar(lista, (e) => e.user_id, (e) => e.user_name),
      })
    }
    return mapa
  }, [dentroDel, unidad])

  /* Y por persona: en que proyectos se le fueron las horas. */
  const desglosePersona = useMemo(() => {
    const mapa = new Map<string, Grupo[]>()
    for (const g of porPersona) {
      const deEsaPersona = dentroDel.filter((e) => e.user_id === g.clave)
      mapa.set(
        g.clave,
        agrupar(deEsaPersona, (e) => e.project_id ?? "sin", (e) => e.project_name ?? "Sin proyecto"),
      )
    }
    return mapa
  }, [porPersona, dentroDel])

  /* Y por proyecto, para el grafico de €/h: quien puso esas horas. */
  const desgloseProyectoDinero = useMemo(() => {
    const mapa = new Map<string, Grupo[]>()
    for (const g of porHoraProyectos) {
      const deEseProyecto = dentroDel.filter((e) => (e.project_id ?? "sin") === g.clave)
      mapa.set(g.clave, agrupar(deEseProyecto, (e) => e.user_id, (e) => e.user_name))
    }
    return mapa
  }, [porHoraProyectos, dentroDel])

  /* Dinero atribuido a cada persona segun el reparto configurado -no solo lo
     de sus propias horas-, para el €/h real de cada uno. */
  const atribucion = useMemo(
    () => calcularAtribucion(dentroDel, repartos, repartoShares, miembros),
    [dentroDel, repartos, repartoShares, miembros],
  )
  const costePorPersona = useMemo(
    () =>
      porPersona
        .map((g) => {
          const dinero = atribucion.get(g.clave) ?? 0
          return {
            ...g,
            dinero,
            porHora: g.facturables >= 3600 ? dinero / (g.facturables / 3600) : null,
          }
        })
        .sort((a, b) => b.dinero - a.dinero),
    [porPersona, atribucion],
  )

  /* Los objetivos son siempre de hoy y de esta semana, al margen del rango
     y el foco que se este mirando arriba. */
  const semanaActual = useMemo(() => {
    const lunes = toDateKey(startOfWeek(new Date()))
    const domingo = toDateKey(addDays(startOfWeek(new Date()), 6))
    return suyas.filter((e) => e.local_date >= lunes && e.local_date <= domingo)
  }, [suyas])
  const hoySegundos = semanaActual
    .filter((e) => e.local_date === todayKey())
    .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const semanaSegundos = semanaActual.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const porRama = useMemo(() => {
    const segundosPorCategoria = new Map<string, number>()
    for (const e of semanaActual) {
      if (!e.category_id) continue
      segundosPorCategoria.set(
        e.category_id,
        (segundosPorCategoria.get(e.category_id) ?? 0) + (e.duration_seconds ?? 0),
      )
    }
    return ramas(catalogo.categorias)
      .filter((r) => r.categoria.goal_weekly_minutes)
      .map((r) => ({
        id: r.categoria.id,
        camino: r.camino,
        objetivo: r.categoria.goal_weekly_minutes!,
        segundos: segundosPorCategoria.get(r.categoria.id) ?? 0,
      }))
  }, [semanaActual, catalogo.categorias])

  const rejilla = useMemo(() => mapaDeCalor(dentroDel), [dentroDel])
  const franja = useMemo(() => franjaViva(rejilla), [rejilla])
  const techo = useMemo(
    () => Math.max(...rejilla.flat(), 0.1),
    [rejilla],
  )

  const dias = diasDe(rango)
  const conHoras = new Set(dentroDel.map((e) => e.local_date)).size
  const mediaDia = conHoras > 0 ? suma.segundos / conHoras : 0
  const gente = new Set(dentroDel.map((e) => e.user_id)).size

  /* Igual que en el proyecto: con menos de una hora cobrable esto no es un
     dato, es una division. */
  const porHora =
    suma.facturables >= 3600 ? suma.importe / (suma.facturables / 3600) : null

  /* ---------------------------------------------------------- presentacion */

  useEffect(() => {
    function alCambiar() {
      setPresentando(Boolean(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", alCambiar)
    return () => document.removeEventListener("fullscreenchange", alCambiar)
  }, [])

  function presentar() {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.()
  }

  return (
    <div
      className={cn(
        "space-y-4",
        presentando && "fixed inset-0 z-50 overflow-y-auto bg-paper p-6",
      )}
    >
      {/* ----------------------------------------------------------- mandos */}
      <div className="no-print space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[3px] border border-line-strong bg-surface p-0.5 text-sm">
            {PRESETS.map((p) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => {
                  setPreset(p.clave)
                  setRangoLibre(null)
                }}
                aria-pressed={!rangoLibre && preset === p.clave}
                className={cn(
                  "whitespace-nowrap rounded-[2px] px-2.5 py-1 transition",
                  !rangoLibre && preset === p.clave
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-ink",
                )}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={rango.desde}
              onChange={(e) =>
                e.target.value &&
                setRangoLibre({ desde: e.target.value, hasta: rango.hasta })
              }
              className="field tabular h-[2.125rem] w-36 rounded-[3px] py-0"
              aria-label="Desde"
            />
            <span className="text-muted">-</span>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) =>
                e.target.value &&
                setRangoLibre({ desde: rango.desde, hasta: e.target.value })
              }
              className="field tabular h-[2.125rem] w-36 rounded-[3px] py-0"
              aria-label="Hasta"
            />
          </div>

          <div className="flex rounded-[3px] border border-line-strong bg-surface p-0.5 text-sm">
            {(
              [
                { valor: "auto", etiqueta: "Auto" },
                { valor: "dia", etiqueta: "Día" },
                { valor: "semana", etiqueta: "Semana" },
                { valor: "mes", etiqueta: "Mes" },
                { valor: "ano", etiqueta: "Año" },
              ] as const
            ).map((u) => (
              <button
                key={u.valor}
                type="button"
                onClick={() => setUnidadForzada(u.valor)}
                aria-pressed={unidadForzada === u.valor}
                className={cn(
                  "whitespace-nowrap rounded-[2px] px-2.5 py-1 transition",
                  unidadForzada === u.valor
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-ink",
                )}
              >
                {u.etiqueta}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={presentar}
            className="btn ml-auto h-[2.125rem] rounded-[3px]"
            title="A pantalla completa, para enseñarlo"
          >
            {presentando ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {presentando ? "Salir" : "Presentar"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hayEquipo && (
            <div className="flex rounded-[3px] border border-line-strong bg-surface p-0.5 text-sm">
              {(["equipo", "mias"] as const).map((cual) => (
                <button
                  key={cual}
                  type="button"
                  onClick={() => setAmbito(cual)}
                  aria-pressed={ambito === cual}
                  className={cn(
                    "whitespace-nowrap rounded-[2px] px-2.5 py-1 transition",
                    ambito === cual
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {cual === "equipo" ? "Todo el equipo" : "Solo mis horas"}
                </button>
              ))}
            </div>
          )}

          {hayEquipo && ambito === "equipo" && (
            <FiltroMultiple
              etiqueta="Personas"
              todos="Todo el equipo"
              opciones={miembros.map((m) => ({ id: m.id, nombre: m.full_name }))}
              elegidas={personas}
              onChange={setPersonas}
            />
          )}

          <FiltrosDeHoras
            catalogo={catalogo}
            valor={filtros}
            onChange={setFiltros}
          />

          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={comparar}
              onChange={(e) => setComparar(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            Comparar con el periodo anterior
          </label>

          {foco && (
            <button
              type="button"
              onClick={() => setFoco(null)}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-3 pr-2 text-sm font-medium text-accent"
            >
              {foco.etiqueta}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ cifras */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra
          etiqueta="Horas"
          valor={formatDurationShort(suma.segundos)}
          antes={sumaAntes.segundos}
          ahora={suma.segundos}
          comparar={comparar}
          pie={`${dias} días · ${conHoras} con horas`}
        />
        <Cifra
          etiqueta="Se cobran"
          valor={formatDurationShort(suma.facturables)}
          antes={sumaAntes.facturables}
          ahora={suma.facturables}
          comparar={comparar}
          tono="billable"
          pie={
            suma.segundos > 0
              ? `${Math.round((suma.facturables / suma.segundos) * 100)}% del total`
              : "sin horas"
          }
        />
        <Cifra
          etiqueta="Media al día"
          valor={formatDurationShort(mediaDia)}
          pie={gente === 1 ? "de quien apunta" : `entre ${gente} personas`}
        />
        {puedeVerImportes ? (
          <Cifra
            etiqueta={porHora !== null ? "Por hora" : "Facturado"}
            valor={
              porHora !== null
                ? `${porHora.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/h`
                : formatMoney(suma.importe)
            }
            tono={
              porHora === null || objetivoHora === null
                ? undefined
                : porHora >= objetivoHora
                  ? "billable"
                  : "danger"
            }
            pie={
              objetivoHora
                ? `objetivo ${objetivoHora} €/h · ${formatMoney(suma.importe)}`
                : formatMoney(suma.importe)
            }
          />
        ) : (
          <Cifra
            etiqueta="Apuntes"
            valor={String(suma.entradas)}
            antes={sumaAntes.entradas}
            ahora={suma.entradas}
            comparar={comparar}
            pie="ratos apuntados"
          />
        )}
      </div>

      {/* ---------------------------------------------------------- objetivos */}
      {(objetivoDiaMinutos || objetivoSemanaMinutos || porRama.length > 0) && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold">Objetivos</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Hoy y esta semana, al margen del periodo que se este mirando arriba.
          </p>
          <div className="space-y-3">
            {objetivoDiaMinutos && (
              <BarraObjetivo
                etiqueta="Hoy"
                segundos={hoySegundos}
                objetivoMinutos={objetivoDiaMinutos}
              />
            )}
            {objetivoSemanaMinutos && (
              <BarraObjetivo
                etiqueta="Esta semana"
                segundos={semanaSegundos}
                objetivoMinutos={objetivoSemanaMinutos}
              />
            )}
            {porRama.map((r) => (
              <BarraObjetivo
                key={r.id}
                etiqueta={r.camino}
                segundos={r.segundos}
                objetivoMinutos={r.objetivo}
              />
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- evolucion */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Cómo va el ritmo</h2>
            <p className="mt-0.5 text-xs text-muted">
              {unidad === "dia"
                ? "Día a día"
                : unidad === "semana"
                  ? "Semana a semana"
                  : unidad === "mes"
                    ? "Mes a mes"
                    : "Año a año"}
              . En verde lo que se cobra
              {comparar && ", y la línea es el periodo anterior"}.
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <GraficoRitmoEstadisticas
            puntos={puntos}
            comparar={comparar}
            desglosePunto={desglosePunto}
          />
        </div>
      </section>

      {/* ------------------------------------------------- area y mapa horas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="card p-4">
          <h2 className="text-sm font-semibold">En qué se va</h2>
          <p className="mb-2 mt-0.5 text-xs text-muted">Por área.</p>

          {porArea.length === 0 ? (
            <Vacio />
          ) : (
            <>
              <div className="h-48 w-full">
                <GraficoAreaEstadisticas
                  porArea={porArea}
                  coloresArea={coloresArea}
                  paleta={PALETA}
                  foco={foco}
                  onAlternarFoco={alternarFoco}
                  desgloseArea={desgloseArea}
                />
              </div>

              <ul className="mt-2 space-y-1">
                {porArea.slice(0, 6).map((g) => (
                  <li
                    key={g.clave}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      alternarFoco({ tipo: "area", clave: g.clave, etiqueta: g.etiqueta })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        alternarFoco({ tipo: "area", clave: g.clave, etiqueta: g.etiqueta })
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-baseline gap-2 rounded-[var(--radio-sm)] text-sm transition hover:bg-surface-2",
                      foco && foco.tipo === "area" && foco.clave !== g.clave && "opacity-40",
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: coloresArea.get(g.clave) ?? PALETA[0] }}
                    />
                    <span className="min-w-0 flex-1 truncate">{g.etiqueta}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {suma.segundos > 0
                        ? Math.round((g.segundos / suma.segundos) * 100)
                        : 0}
                      %
                    </span>
                    <span className="cifra shrink-0 font-medium">
                      {formatDurationShort(g.segundos)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold">Cuándo se trabaja</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Dónde cae de verdad el trabajo en la semana. Cuanto más oscuro, más
            horas.
          </p>
          <MapaDeCalor rejilla={rejilla} franja={franja} techo={techo} />
        </section>
      </div>

      {/* ------------------------------------------------ personas y ranking */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hayEquipo && (
          <section className="card p-4">
            <h2 className="text-sm font-semibold">Quién lo pone</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Horas por persona en el periodo.
            </p>
            {porPersona.length === 0 ? (
              <Vacio />
            ) : (
              <div style={{ height: Math.max(140, porPersona.length * 34) }}>
                <GraficoPersonasEstadisticas
                  porPersona={porPersona}
                  foco={foco}
                  onAlternarFoco={alternarFoco}
                  desglosePersona={desglosePersona}
                />
              </div>
            )}
          </section>
        )}

        <section className={cn("card p-4", !hayEquipo && "lg:col-span-2")}>
          <h2 className="text-sm font-semibold">Los proyectos que más pesan</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            De más a menos horas en el periodo.
          </p>
          {porProyecto.length === 0 ? (
            <Vacio />
          ) : (
            <ul className="space-y-2.5">
              {porProyecto.slice(0, 8).map((g) => {
                const parte =
                  suma.segundos > 0 ? (g.segundos / suma.segundos) * 100 : 0
                const cobrable =
                  g.segundos > 0 ? (g.facturables / g.segundos) * 100 : 0
                return (
                  <li
                    key={g.clave}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      alternarFoco({ tipo: "proyecto", clave: g.clave, etiqueta: g.etiqueta })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        alternarFoco({ tipo: "proyecto", clave: g.clave, etiqueta: g.etiqueta })
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-[var(--radio-sm)] transition hover:bg-surface-2",
                      foco &&
                        foco.tipo === "proyecto" &&
                        foco.clave !== g.clave &&
                        "opacity-40",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{g.etiqueta}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {Math.round(parte)}%
                      </span>
                      <span className="cifra shrink-0 font-medium">
                        {formatDurationShort(g.segundos)}
                      </span>
                    </div>
                    {/* La barra entera es lo que pesa; el trozo verde, lo que
                        de eso se cobra */}
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="relative h-full rounded-full"
                        style={{
                          width: `${parte}%`,
                          background: g.color ?? "var(--accent)",
                        }}
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-billable-fill"
                          style={{ width: `${cobrable}%` }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* -------------------------------------------------- coste por persona */}
      {puedeVerImportes && hayEquipo && costePorPersona.some((p) => p.dinero > 0) && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold">Coste por hora, por persona</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Lo que cada uno se lleva según el reparto configurado en Tarifas,
            entre sus horas facturables -no siempre es lo mismo que sus
            propias horas por su propia tarifa-.
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-semibold">Persona</th>
                  <th className="py-2 pr-3 text-right font-semibold">Horas</th>
                  <th className="py-2 pr-3 text-right font-semibold">Atribuido</th>
                  <th className="py-2 text-right font-semibold">€/h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {costePorPersona.map((p) => (
                  <tr
                    key={p.clave}
                    onClick={() =>
                      alternarFoco({ tipo: "persona", clave: p.clave, etiqueta: p.etiqueta })
                    }
                    className={cn(
                      "cursor-pointer transition hover:bg-surface-2",
                      foco &&
                        foco.tipo === "persona" &&
                        foco.clave !== p.clave &&
                        "opacity-40",
                    )}
                  >
                    <td className="py-2 pr-3">{p.etiqueta}</td>
                    <td className="tabular py-2 pr-3 text-right text-muted">
                      {formatDurationShort(p.segundos)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-medium">
                      {formatMoney(p.dinero)}
                    </td>
                    <td className="tabular py-2 text-right font-medium">
                      {p.porHora !== null
                        ? `${p.porHora.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/h`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- por hora */}
      {puedeVerImportes && porProyecto.some((g) => g.importe > 0) && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold">A cuánto sale la hora</h2>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            Por proyecto, contando solo las horas que se cobran
            {objetivoHora ? `. La línea es el objetivo: ${objetivoHora} €/h` : ""}.
          </p>
          <div className="h-56 w-full">
            <GraficoPorHoraEstadisticas
              porHoraProyectos={porHoraProyectos}
              objetivoHora={objetivoHora}
              foco={foco}
              onAlternarFoco={alternarFoco}
              desgloseProyectoDinero={desgloseProyectoDinero}
            />
          </div>
        </section>
      )}

      {hayFiltros(filtros) && (
        <p className="no-print text-center text-xs text-accent">
          Con filtros puestos: todo lo de arriba es solo de lo filtrado.
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ piezas */

function Vacio() {
  return <p className="py-6 text-center text-sm text-muted">Nada en este periodo.</p>
}

/** Una fila de "cuanto llevamos" contra un objetivo, con su barra. */
function BarraObjetivo({
  etiqueta,
  segundos,
  objetivoMinutos,
}: {
  etiqueta: string
  segundos: number
  objetivoMinutos: number
}) {
  const objetivoSegundos = objetivoMinutos * 60
  const parte =
    objetivoSegundos > 0 ? Math.min(100, (segundos / objetivoSegundos) * 100) : 0
  const cumplido = segundos >= objetivoSegundos

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{etiqueta}</span>
        <span className={cn("cifra shrink-0 font-medium", cumplido && "text-billable")}>
          {formatDurationShort(segundos)}{" "}
          <span className="text-muted">/ {formatObjetivo(objetivoMinutos)}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", cumplido ? "bg-billable-fill" : "bg-accent")}
          style={{ width: `${parte}%` }}
        />
      </div>
    </div>
  )
}

/** Un número grande con su comparación contra el periodo anterior. */
function Cifra({
  etiqueta,
  valor,
  pie,
  tono,
  antes,
  ahora,
  comparar,
}: {
  etiqueta: string
  valor: string
  pie?: string
  tono?: "billable" | "danger"
  antes?: number
  ahora?: number
  comparar?: boolean
}) {
  const hayComparacion =
    comparar && antes !== undefined && ahora !== undefined && antes > 0
  const cambio = hayComparacion ? ((ahora! - antes!) / antes!) * 100 : null
  const sube = (cambio ?? 0) >= 0

  return (
    <div className="card p-4">
      <p className="rotulo">{etiqueta}</p>
      <p
        className={cn(
          "cifra mt-1 text-2xl font-semibold leading-none",
          tono === "billable" && "text-billable",
          tono === "danger" && "text-danger",
        )}
      >
        {valor}
      </p>
      {cambio !== null && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium",
            sube ? "text-billable" : "text-danger",
          )}
        >
          {sube ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {sube ? "+" : ""}
          {Math.round(cambio)}% que antes
        </p>
      )}
      {pie && <p className="mt-1 text-xs text-muted">{pie}</p>}
    </div>
  )
}

/** Siete filas y una columna por hora: dónde cae el trabajo en la semana. */
function MapaDeCalor({
  rejilla,
  franja,
  techo,
}: {
  rejilla: number[][]
  franja: { min: number; max: number }
  techo: number
}) {
  const horas = Array.from(
    { length: franja.max - franja.min + 1 },
    (_, i) => franja.min + i,
  )
  /* Nada de title nativo -sale el aviso feo del navegador-: se sigue el
     cursor con una caja igual a la del resto de graficas. */
  const [hover, setHover] = useState<{ texto: string; x: number; y: number } | null>(
    null,
  )
  /* El hover no existe en tactil: una celda tocada se queda "activa" y su
     caja se queda puesta hasta que se toca la misma celda otra vez -o se
     toca fuera-, en vez de depender de un raton que ahi no hay. */
  const [activa, setActiva] = useState<string | null>(null)

  function mover(e: React.MouseEvent, texto: string) {
    setHover({ texto, x: e.clientX, y: e.clientY })
  }

  function tocar(e: React.MouseEvent<HTMLSpanElement>, clave: string, texto: string) {
    // Sin esto, el clic seguiria hasta el contenedor y su propio manejador
    // -pensado para cerrar al tocar fuera- borraria lo que se acaba de abrir.
    e.stopPropagation()
    if (activa === clave) {
      setActiva(null)
      setHover(null)
      return
    }
    setActiva(clave)
    setHover({ texto, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      className="scroll-thin overflow-x-auto"
      onClick={() => {
        if (activa) {
          setActiva(null)
          setHover(null)
        }
      }}
    >
      <div className="min-w-[22rem]">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `2.2rem repeat(${horas.length}, minmax(0, 1fr))`,
          }}
        >
          {rejilla.map((fila, d) => (
            <Fragment key={DIAS[d]}>
              <span className="flex items-center text-[11px] text-muted">
                {DIAS[d]}
              </span>
              {horas.map((h) => {
                const valor = fila[h]
                const texto = `${DIAS[d]} a las ${h}:00 · ${formatDurationShort(valor * 3600)}`
                const clave = `${d}-${h}`
                return (
                  <span
                    key={h}
                    onMouseEnter={(e) => mover(e, texto)}
                    onMouseMove={(e) => mover(e, texto)}
                    onMouseLeave={() => setHover(null)}
                    onClick={(e) => tocar(e, clave, texto)}
                    className="aspect-square rounded-[2px] bg-accent transition"
                    style={{
                      opacity: valor <= 0 ? 0.06 : 0.15 + (valor / techo) * 0.85,
                    }}
                  />
                )
              })}
            </Fragment>
          ))}

          <span />
          {horas.map((h) => (
            <span
              key={h}
              className="pt-1 text-center text-[10px] leading-none text-muted"
            >
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <CajaTooltip titulo={hover.texto} />
        </div>
      )}
    </div>
  )
}
