"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useSesion } from "@/components/proveedor-sesion"
import { FiltroMultiple } from "@/components/filtro-multiple"
import { categoriasRaiz, SIN_CATEGORIA } from "@/lib/categorias"
import { exportarCsv, exportarExcel, exportarPdf } from "@/lib/exportar"
import { AccionesInforme } from "@/components/acciones-informe"
import { DialogoEntrada } from "@/components/dialogo-entrada"
import { agrupar, porDia, rangos, totales } from "@/lib/informes"
import {
  formatDateShort,
  formatDurationShort,
  formatHoursDecimal,
  formatMoney,
} from "@/lib/time"
import type { Catalogo, EntradaVista, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * recharts pesa varios cientos de KB: se carga solo en el navegador y solo
 * cuando hace falta pintar el gráfico, en vez de ir en el primer JS de
 * /informes (mismo patrón que grafico-resumen-proyecto.tsx).
 */
const GraficoInformes = dynamic(
  () => import("@/components/grafico-informes").then((mod) => mod.GraficoInformes),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-[var(--radio-sm)] bg-surface-2" />
    ),
  },
)

type Facturable = "todo" | "si" | "no"

/** Para poder marcar «sin proyecto» o «sin área» como una opción más. */
const SIN_NADA = "__sin__"

export function PanelInformes({
  entradas,
  catalogo,
  miembros,
  desde,
  hasta,
  puedeVerImportes,
  puedeAbrirCerradas,
}: {
  entradas: EntradaVista[]
  catalogo: Catalogo
  miembros: Miembro[]
  desde: string
  hasta: string
  puedeVerImportes: boolean
  /** Las horas cerradas solo las vuelve a abrir quien administra. */
  puedeAbrirCerradas: boolean
}) {
  const router = useRouter()
  const { espacio } = useSesion()
  /* Varios a la vez: casi nunca se mira una sola persona o un solo proyecto,
     se mira un equipo o un puñado de cosas. Vacio es "todos". */
  const [personas, setPersonas] = useState<string[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [proyectos, setProyectos] = useState<string[]>([])
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [facturable, setFacturable] = useState<Facturable>("todo")
  const [cierre, setCierre] = useState<"todo" | "abiertas" | "cerradas">("todo")
  const [busqueda, setBusqueda] = useState("")
  const [verTodo, setVerTodo] = useState(false)
  const [generando, setGenerando] = useState<"excel" | "pdf" | "todo" | null>(
    null,
  )
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  // Corregir desde aqui: una a una o varias a la vez
  const [elegidas, setElegidas] = useState<string[]>([])
  const [editando, setEditando] = useState<EntradaVista | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Lo ultimo que se hizo, por si hay que dar marcha atras
  const [deshacer, setDeshacer] = useState<(() => Promise<string>) | null>(null)
  const [deshaciendo, setDeshaciendo] = useState(false)

  function cambiarRango(nuevoDesde: string, nuevoHasta: string) {
    router.push(`/informes?desde=${nuevoDesde}&hasta=${nuevoHasta}`)
  }

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return entradas.filter((entrada) => {
      if (!entrada.end_at) return false
      if (personas.length > 0 && !personas.includes(entrada.user_id)) return false
      if (
        categorias.length > 0 &&
        !categorias.includes(entrada.category_id ?? SIN_NADA)
      ) {
        return false
      }
      if (
        proyectos.length > 0 &&
        !proyectos.includes(entrada.project_id ?? SIN_NADA)
      ) {
        return false
      }
      // Con varias etiquetas marcadas vale con llevar cualquiera de ellas
      if (etiquetas.length > 0 && !etiquetas.some((t) => entrada.tags.includes(t))) {
        return false
      }
      if (facturable === "si" && !entrada.billable) return false
      if (facturable === "no" && entrada.billable) return false
      if (cierre === "cerradas" && !entrada.locked) return false
      if (cierre === "abiertas" && entrada.locked) return false
      if (texto) {
        const donde = `${entrada.description} ${entrada.project_name ?? ""} ${entrada.task_name ?? ""}`
        if (!donde.toLowerCase().includes(texto)) return false
      }
      return true
    })
  }, [
    entradas,
    personas,
    categorias,
    proyectos,
    etiquetas,
    facturable,
    cierre,
    busqueda,
  ])

  const suma = useMemo(() => totales(filtradas), [filtradas])
  const serie = useMemo(() => porDia(filtradas, desde, hasta), [filtradas, desde, hasta])

  const porProyecto = useMemo(
    () =>
      agrupar(
        filtradas,
        (e) => e.project_id ?? "sin",
        (e) => e.project_name ?? "Sin proyecto",
        (e) => e.project_color,
      ),
    [filtradas],
  )
  const porPersona = useMemo(
    () => agrupar(filtradas, (e) => e.user_id, (e) => e.user_name),
    [filtradas],
  )
  /* La categorizacion se lee por rama entera: la subcategoria cuenta dentro de
     su categoria, que es como se miran los objetivos. */
  const porCategoria = useMemo(
    () =>
      agrupar(
        filtradas,
        (e) => e.category_id ?? "sin",
        (e) =>
          e.category_name
            ? e.subcategory_name
              ? e.category_name + " / " + e.subcategory_name
              : e.category_name
            : SIN_CATEGORIA,
      ),
    [filtradas],
  )
  const porEdicion = useMemo(
    () =>
      agrupar(
        filtradas.filter((e) => e.edition_id),
        (e) => e.edition_id ?? "sin",
        (e) => (e.project_name ?? "") + " · " + (e.edition_name ?? ""),
      ),
    [filtradas],
  )

  const seleccionadas = filtradas.filter((e) => elegidas.includes(e.id))

  /* Si hay algo elegido, las descargas van de eso: es lo que espera cualquiera
     despues de marcar seis filas. */
  const paraDescargar = seleccionadas.length > 0 ? seleccionadas : filtradas

  const diasConHoras = serie.filter((d) => d.horas > 0).length
  const nombreFichero = `horas-${desde}-a-${hasta}`

  async function excel() {
    setGenerando("excel")
    try {
      await exportarExcel(paraDescargar, {
        nombre: nombreFichero,
        desde,
        hasta,
        conImportes: puedeVerImportes,
      })
    } finally {
      setGenerando(null)
    }
  }

  /** Todo lo que hay, sin filtros ni fechas: el boton de "dame el Excel". */
  async function todoElHistorico() {
    setGenerando("todo")
    setErrorDescarga(null)
    try {
      const { data, error } = await createClient()
        .from("v_entries")
        .select("*")
        .eq("workspace_id", espacio.id)
        .not("end_at", "is", null)
        .order("local_date", { ascending: true })
        .limit(50000)
      if (error) throw error

      const todas = (data ?? []) as EntradaVista[]
      if (todas.length === 0) {
        setErrorDescarga("Todavía no hay horas que descargar.")
        return
      }

      await exportarExcel(todas, {
        nombre: "horas-" + espacio.slug + "-completo",
        desde: todas[0].local_date,
        hasta: todas[todas.length - 1].local_date,
        conImportes: puedeVerImportes,
      })
    } catch (err) {
      setErrorDescarga(mensajeError(err))
    } finally {
      setGenerando(null)
    }
  }

  async function pdf() {
    setGenerando("pdf")
    try {
      await exportarPdf({
        titulo: "Informe de horas",
        subtitulo: `${formatDateShort(desde)} - ${formatDateShort(hasta)}`,
        resumen: [
          { etiqueta: "Total", valor: `${formatHoursDecimal(suma.segundos)} h` },
          {
            etiqueta: "Facturable",
            valor: `${formatHoursDecimal(suma.facturables)} h`,
          },
          ...(puedeVerImportes
            ? [{ etiqueta: "Importe", valor: formatMoney(suma.importe) }]
            : []),
        ],
        columnas: [
          "Fecha",
          "Persona",
          "Proyecto",
          "Descripción",
          "Horas",
          ...(puedeVerImportes ? ["Importe"] : []),
        ],
        filas: paraDescargar.map((entrada) => [
          formatDateShort(entrada.local_date),
          entrada.user_name,
          entrada.project_name ?? "",
          entrada.description,
          formatHoursDecimal(entrada.duration_seconds),
          ...(puedeVerImportes
            ? [entrada.amount != null ? formatMoney(Number(entrada.amount)) : ""]
            : []),
        ]),
        nombre: nombreFichero,
      })
    } finally {
      setGenerando(null)
    }
  }

  const visibles = verTodo ? filtradas : filtradas.slice(0, 50)

  /**
   * El equipo trabaja junto: cualquiera puede corregir las horas de cualquiera.
   * Lo unico intocable son las cerradas, que solo abre quien administra. La
   * base de datos dice lo mismo, asi que esto es solo lo que se pinta.
   */
  function puedeEditar(entrada: EntradaVista) {
    return !entrada.locked || puedeAbrirCerradas
  }

  /* Sobre lo filtrado entero, no solo lo pintado: elegir no necesita pintar
     la fila, y si no fuera asi, "elegir todas" con mas de 50 resultados
     filtrados solo cogeria las primeras 50 sin avisar de que quedan mas. */
  const editables = filtradas.filter(puedeEditar)
  const todasElegidas =
    editables.length > 0 && editables.every((e) => elegidas.includes(e.id))

  function alternar(id: string) {
    setAviso(null)
    setElegidas((previas) =>
      previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id],
    )
  }

  function alternarTodas() {
    setAviso(null)
    setElegidas(todasElegidas ? [] : editables.map((e) => e.id))
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ filtros */}
      <section className="card no-print space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {rangos().map((rango) => {
            const activo = rango.desde === desde && rango.hasta === hasta
            return (
              <button
                key={rango.clave}
                type="button"
                onClick={() => cambiarRango(rango.desde, rango.hasta)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-sm font-medium transition",
                  activo
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {rango.etiqueta}
              </button>
            )
          })}

          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              className="field tabular w-36 py-1"
              value={desde}
              onChange={(e) => cambiarRango(e.target.value, hasta)}
              aria-label="Desde"
            />
            <span className="text-muted">-</span>
            <input
              type="date"
              className="field tabular w-36 py-1"
              value={hasta}
              onChange={(e) => cambiarRango(desde, e.target.value)}
              aria-label="Hasta"
            />
          </div>
        </div>

        {/* En movil, dos columnas: siete desplegables uno debajo de otro son
            media pantalla de filtros antes de ver un solo dato. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {miembros.length > 0 && (
            <FiltroMultiple
              etiqueta="Personas"
              todos="Todo el equipo"
              opciones={miembros.map((m) => ({ id: m.id, nombre: m.full_name }))}
              elegidas={personas}
              onChange={setPersonas}
            />
          )}

          <FiltroMultiple
            etiqueta="Áreas"
            todos="Todas las áreas"
            opciones={[
              ...categoriasRaiz(catalogo.categorias).map((c) => ({
                id: c.id,
                nombre: c.name,
              })),
              { id: SIN_NADA, nombre: "Sin área" },
            ]}
            elegidas={categorias}
            onChange={setCategorias}
          />

          <FiltroMultiple
            etiqueta="Proyectos"
            todos="Todos los proyectos"
            opciones={[
              ...catalogo.proyectos.map((p) => ({ id: p.id, nombre: p.name })),
              { id: SIN_NADA, nombre: "Sin proyecto" },
            ]}
            elegidas={proyectos}
            onChange={setProyectos}
          />

          <FiltroMultiple
            etiqueta="Etiquetas"
            todos="Todas las etiquetas"
            opciones={catalogo.etiquetas.map((t) => ({
              id: t.name,
              nombre: t.name,
            }))}
            elegidas={etiquetas}
            onChange={setEtiquetas}
          />

          <select
            className="field h-[2.125rem] w-full rounded-[3px] py-0 sm:w-auto"
            value={facturable}
            onChange={(e) => setFacturable(e.target.value as Facturable)}
            aria-label="Facturable"
          >
            <option value="todo">Facturable y no</option>
            <option value="si">Solo facturable</option>
            <option value="no">Solo no facturable</option>
          </select>

          <select
            className="field h-[2.125rem] w-full rounded-[3px] py-0 sm:w-auto"
            value={cierre}
            onChange={(e) =>
              setCierre(e.target.value as "todo" | "abiertas" | "cerradas")
            }
            aria-label="Cerradas o abiertas"
          >
            <option value="todo">Cerradas y abiertas</option>
            <option value="abiertas">Solo las abiertas</option>
            <option value="cerradas">Solo las cerradas</option>
          </select>

          <input
            className="field h-[2.125rem] w-auto flex-1 rounded-[3px] py-0"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la descripción"
            aria-label="Buscar"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => void excel()}
            disabled={paraDescargar.length === 0 || generando !== null}
            className="btn btn-primary py-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {generando === "excel" ? "Generando..." : "Excel"}
          </button>
          <button
            type="button"
            onClick={() => exportarCsv(paraDescargar, nombreFichero)}
            disabled={paraDescargar.length === 0}
            className="btn py-1.5"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void pdf()}
            disabled={paraDescargar.length === 0 || generando !== null}
            className="btn py-1.5"
          >
            <FileText className="h-4 w-4" />
            {generando === "pdf" ? "Generando..." : "PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn py-1.5"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>

          <span className="hidden w-px self-stretch bg-line sm:block" />

          <button
            type="button"
            onClick={() => void todoElHistorico()}
            disabled={generando !== null}
            title="Un Excel con todas las horas del espacio, sin filtros ni fechas"
            className="btn col-span-2 py-1.5 sm:col-span-1"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {generando === "todo" ? "Generando..." : "Todo, desde el principio"}
          </button>

          {seleccionadas.length > 0 && (
            <span className="col-span-2 self-center text-xs text-muted sm:col-span-1">
              Se descargan las {seleccionadas.length} elegidas
            </span>
          )}
        </div>

        {errorDescarga && (
          <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
            {errorDescarga}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------ resumen */}
      <section className="grid grid-cols-1 grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta etiqueta="Total" valor={formatDurationShort(suma.segundos)} pie={`${suma.entradas} entradas`} />
        <Tarjeta
          etiqueta="Facturable"
          valor={formatDurationShort(suma.facturables)}
          pie={
            suma.segundos > 0
              ? `${Math.round((suma.facturables / suma.segundos) * 100)}% del total`
              : "-"
          }
          acento
        />
        {puedeVerImportes ? (
          <Tarjeta
            etiqueta="Importe"
            valor={formatMoney(suma.importe)}
            pie="Según tarifas vigentes"
          />
        ) : (
          <Tarjeta
            etiqueta="Proyectos"
            valor={String(porProyecto.length)}
            pie="con horas en el rango"
          />
        )}
        <Tarjeta
          etiqueta="Media por día"
          valor={formatDurationShort(
            diasConHoras > 0 ? suma.segundos / diasConHoras : 0,
          )}
          pie={`${diasConHoras} días con horas`}
        />
      </section>

      {/* ------------------------------------------------------------ grafico */}
      <section className="card min-w-0 p-4">
        <h2 className="mb-3 text-sm font-semibold">Horas por día</h2>
        <div className="h-64 w-full">
          <GraficoInformes serie={serie} />
        </div>
      </section>

      {/* ---------------------------------------------------------- desgloses */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Desglose
          titulo="Por proyecto"
          grupos={porProyecto}
          total={suma.segundos}
          conImporte={puedeVerImportes}
        />
        {miembros.length > 0 && (
          <Desglose
            titulo="Por persona"
            grupos={porPersona}
            total={suma.segundos}
            conImporte={puedeVerImportes}
          />
        )}

        <Desglose
          titulo="Por categoría"
          grupos={porCategoria}
          total={suma.segundos}
          conImporte={puedeVerImportes}
        />

        {porEdicion.length > 0 && (
          <Desglose
            titulo="Por edición"
            grupos={porEdicion}
            total={suma.segundos}
            conImporte={puedeVerImportes}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ detalle */}
      <section className="card min-w-0 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Detalle <span className="text-muted">({filtradas.length})</span>
          </h2>
          {filtradas.length > 50 && (
            <button
              type="button"
              onClick={() => setVerTodo((v) => !v)}
              className="no-print text-xs font-medium text-accent"
            >
              {verTodo ? "Ver solo las 50 primeras" : `Ver las ${filtradas.length}`}
            </button>
          )}
        </div>

        {aviso && (
          <div className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-[var(--radio-sm)] border border-line bg-surface-2 px-3 py-2 text-sm text-ink-soft">
            <span>{aviso}</span>
            {deshacer && (
              <button
                type="button"
                disabled={deshaciendo}
                onClick={async () => {
                  setDeshaciendo(true)
                  try {
                    const hecho = await deshacer()
                    setAviso(hecho)
                    setDeshacer(null)
                    router.refresh()
                  } catch (err) {
                    setAviso(
                      "No se ha podido deshacer: " +
                        (err instanceof Error ? err.message : "algo ha fallado"),
                    )
                  } finally {
                    setDeshaciendo(false)
                  }
                }}
                className="btn h-7 py-0 text-xs"
              >
                {deshaciendo ? "Deshaciendo..." : "Deshacer"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAviso(null)
                setDeshacer(null)
              }}
              className="ml-auto text-xs text-muted transition hover:text-ink"
            >
              Cerrar
            </button>
          </div>
        )}

        {seleccionadas.length > 0 && (
          <AccionesInforme
            seleccionadas={seleccionadas}
            catalogo={catalogo}
            puedeBloquear={puedeAbrirCerradas}
            onListo={(mensaje, volver) => {
              setAviso(mensaje)
              setDeshacer(() => volver ?? null)
            }}
            onLimpiar={() => setElegidas([])}
          />
        )}

        {filtradas.length === 0 ? (
          <p className="py-3 text-sm text-muted">
            No hay horas con estos filtros.
          </p>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  {editables.length > 0 && (
                    <th className="no-print w-8 py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={todasElegidas}
                        onChange={alternarTodas}
                        aria-label="Elegir todas las que puedo editar"
                        className="h-3.5 w-3.5 accent-[color:var(--accent)]"
                      />
                    </th>
                  )}
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="hidden py-2 pr-3 font-semibold sm:table-cell">
                    Persona
                  </th>
                  <th className="py-2 pr-3 font-semibold">Proyecto</th>
                  <th className="hidden py-2 pr-3 font-semibold sm:table-cell">
                    Descripción
                  </th>
                  <th className="py-2 pr-3 text-right font-semibold">Horas</th>
                  {puedeVerImportes && (
                    <th className="hidden py-2 text-right font-semibold sm:table-cell">
                      Importe
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibles.map((entrada) => (
                  <tr
                    key={entrada.id}
                    onClick={() => puedeEditar(entrada) && setEditando(entrada)}
                    className={cn(
                      elegidas.includes(entrada.id) && "bg-accent-soft",
                      puedeEditar(entrada) && "cursor-pointer hover:bg-surface-2",
                    )}
                    title={puedeEditar(entrada) ? "Pulsa para corregirla" : undefined}
                  >
                    {editables.length > 0 && (
                      <td className="no-print py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                        {puedeEditar(entrada) && (
                          <input
                            type="checkbox"
                            checked={elegidas.includes(entrada.id)}
                            onChange={() => alternar(entrada.id)}
                            aria-label={"Elegir la hora de " + entrada.user_name}
                            className="h-3.5 w-3.5 accent-[color:var(--accent)]"
                          />
                        )}
                      </td>
                    )}
                    <td className="tabular whitespace-nowrap py-2 pr-2 align-top text-muted sm:pr-3">
                      <span className="sm:hidden">
                        {formatDateShort(entrada.local_date).slice(0, 5)}
                      </span>
                      <span className="hidden sm:inline">
                        {formatDateShort(entrada.local_date)}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap py-2 pr-3 sm:table-cell">
                      {entrada.user_name}
                      {entrada.locked && (
                        <span className="chip ml-1.5">cerrada</span>
                      )}
                    </td>
                    <td className="w-full max-w-0 py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: entrada.project_color ?? "var(--border-strong)",
                          }}
                        />
                        <span className="truncate">
                          {entrada.project_name ?? "Sin proyecto"}
                          {entrada.task_name && ` · ${entrada.task_name}`}
                        </span>
                      </span>
                      {/* En movil no hay columna para la descripcion ni para
                          la persona: van aqui debajo, en pequeño */}
                      <span className="mt-0.5 block truncate text-xs text-muted sm:hidden">
                        {entrada.description ||
                          (puedeEditar(entrada) ? "Añadir descripción" : "Sin descripción")}
                        {" · "}
                        {entrada.user_name}
                      </span>
                    </td>
                    <td className="hidden max-w-[22rem] truncate py-2 pr-3 text-muted sm:table-cell">
                      {entrada.description || "-"}
                    </td>
                    <td
                      className={cn(
                        "tabular py-2 pr-3 text-right font-medium",
                        entrada.billable && "text-billable",
                      )}
                    >
                      {formatHoursDecimal(entrada.duration_seconds)}
                    </td>
                    {puedeVerImportes && (
                      <td className="tabular hidden py-2 text-right sm:table-cell">
                        {entrada.amount != null
                          ? formatMoney(Number(entrada.amount))
                          : "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

function Tarjeta({
  etiqueta,
  valor,
  pie,
  acento = false,
}: {
  etiqueta: string
  valor: string
  pie: string
  acento?: boolean
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p
        className={cn(
          "tabular mt-0.5 text-xl font-semibold",
          acento && "text-billable",
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-muted">{pie}</p>
    </div>
  )
}

function Desglose({
  titulo,
  grupos,
  total,
  conImporte,
}: {
  titulo: string
  grupos: ReturnType<typeof agrupar>
  total: number
  conImporte: boolean
}) {
  return (
    <section className="card min-w-0 p-4">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>

      {grupos.length === 0 ? (
        <p className="py-2 text-sm text-muted">Sin datos.</p>
      ) : (
        <ul className="space-y-2.5">
          {grupos.map((grupo) => {
            const porcentaje = total > 0 ? (grupo.segundos / total) * 100 : 0
            return (
              <li key={grupo.clave}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: grupo.color ?? "var(--accent)" }}
                    />
                    <span className="truncate">{grupo.etiqueta}</span>
                  </span>
                  <span className="tabular shrink-0 font-medium">
                    {formatDurationShort(grupo.segundos)}
                    {conImporte && grupo.importe > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted">
                        {formatMoney(grupo.importe)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${porcentaje}%`,
                      background: grupo.color ?? "var(--accent)",
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
