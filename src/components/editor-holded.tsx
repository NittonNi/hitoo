"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, GripVertical, Link2, Loader2, Plus, Search, X } from "lucide-react"

import { useAvisos } from "@/components/avisos"
import { ElegirSitio, type Eleccion } from "@/components/elegir-sitio"
import {
  cifrasHolded,
  DetalleSitioHolded,
  sePuedeMeter,
} from "@/components/detalle-sitio-holded"
import {
  beneficioPorHora,
  type HoldedEditor,
  type ModeloEditor,
  type ProyectoEditor,
  type SitioEditor,
} from "@/lib/editor-holded"
import { claveSitio, type Sitio } from "@/lib/holded"
import { formatDurationShort } from "@/lib/time"
import {
  aparcarHolded,
  deshacerMeter,
  enlazarHolded,
  enlazarVarios,
  meterEn,
  type Destino,
  type HechoEnlace,
} from "@/app/(app)/gestion/holded/acciones"
import { cn } from "@/lib/utils"

const sitioDeClave = (clave: string): Sitio => {
  const [proyectoId, edicionId] = clave.split("|")
  return { proyectoId, edicionId: edicionId || null }
}

function normal(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Lo que se lleva en la mano al arrastrar. */
type Carga =
  | { tipo: "holded"; h: HoldedEditor }
  | { tipo: "sitio"; proyecto: ProyectoEditor; sitio: SitioEditor }

type Arrastre = {
  carga: Carga
  x: number
  y: number
  /** De dónde sale la línea, cuando se arrastra un proyecto de Holded. */
  ancla: { x: number; y: number } | null
}

/**
 * Gestión → Holded, como las relaciones de Power BI: a la izquierda el dinero
 * (proyectos de Holded) y a la derecha las horas (proyectos y ediciones de
 * hitoo), con líneas que los unen.
 *
 * - Un proyecto de Holded se arrastra desde su tarjeta hasta su sitio, o a
 *   «Por decidir» para quitarlo. Varios en un sitio se suman.
 * - Un proyecto o una edición de hitoo se arrastra por su asa hasta una
 *   edición (se juntan las horas) o a «edición nueva» de otro proyecto.
 * - Todo tiene su botón al lado para hacerlo sin arrastrar, que en el móvil es
 *   la única forma: allí no hay líneas.
 * - Lo que no tiene duda está enlazado; lo dudoso sale propuesto, con línea
 *   discontinua, para confirmarlo o quitarlo.
 */
export function EditorHolded({ modelo }: { modelo: ModeloEditor }) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [busqueda, setBusqueda] = useState("")
  const [ver, setVer] = useState<"dinero" | "todo">("dinero")
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [descartadas, setDescartadas] = useState<Set<string>>(() => new Set())
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [traido, setTraido] = useState<{ clave: string; ids: string[] } | null>(null)
  const [arrastre, setArrastre] = useState<Arrastre | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  /* Lo movido se ve al momento, antes de que vuelva la base. Cuando llegan
     datos nuevos del servidor, mandan ellos. */
  const [movidos, setMovidos] = useState<Record<string, string | null>>({})
  const [modeloVisto, setModeloVisto] = useState(modelo)
  if (modeloVisto !== modelo) {
    setModeloVisto(modelo)
    setMovidos({})
  }

  const holded = useMemo(
    () =>
      modelo.holded.map((h) =>
        h.holdedId in movidos ? { ...h, sitio: movidos[h.holdedId], propuesta: null } : h,
      ),
    [modelo.holded, movidos],
  )

  const sitios = useMemo(() => {
    const mapa = new Map<string, { proyecto: ProyectoEditor; sitio: SitioEditor }>()
    for (const p of modelo.proyectos) for (const s of p.sitios) mapa.set(s.clave, { proyecto: p, sitio: s })
    return mapa
  }, [modelo.proyectos])

  const { suyos, propuestos, porDecidir } = useMemo(() => {
    const suyos = new Map<string, HoldedEditor[]>()
    const propuestos = new Map<string, HoldedEditor[]>()
    const porDecidir: HoldedEditor[] = []
    for (const h of holded) {
      if (h.sitio) suyos.set(h.sitio, [...(suyos.get(h.sitio) ?? []), h])
      else if (h.propuesta && !descartadas.has(h.holdedId) && sitios.has(h.propuesta)) {
        propuestos.set(h.propuesta, [...(propuestos.get(h.propuesta) ?? []), h])
      } else porDecidir.push(h)
    }
    return { suyos, propuestos, porDecidir }
  }, [holded, descartadas, sitios])

  function etiquetaDe(clave: string | null) {
    if (!clave) return "por decidir"
    const s = sitios.get(clave)
    if (s) return s.sitio.edicionId ? `${s.proyecto.nombre} › ${s.sitio.nombre}` : s.proyecto.nombre
    const p = modelo.proyectos.find((x) => x.id === sitioDeClave(clave).proyectoId)
    return p?.nombre ?? "otro sitio"
  }

  /** Ingresos y gastos del sitio con lo que tiene ahora, movido o no. */
  function cuentasDe(s: SitioEditor) {
    const ahora = suyos.get(s.clave) ?? []
    const igual =
      ahora.length === s.holdedIds.length && ahora.every((h) => s.holdedIds.includes(h.holdedId))
    if (igual) return { ingresos: s.ingresos, gastos: s.gastos }
    if (ahora.length === 0) return s.holdedIds.length ? { ingresos: null, gastos: null } : { ingresos: s.ingresos, gastos: s.gastos }
    return {
      ingresos: s.extraIngresos + ahora.reduce((t, h) => t + (h.ingresos ?? 0), 0),
      gastos: s.extraGastos + ahora.reduce((t, h) => t + (h.gastos ?? 0), 0),
    }
  }

  const visibles = useMemo(() => {
    const q = normal(busqueda)
    return modelo.proyectos.filter((p) => {
      const conAlgo = p.sitios.some(
        (s) =>
          (suyos.get(s.clave)?.length ?? 0) > 0 ||
          (propuestos.get(s.clave)?.length ?? 0) > 0 ||
          Boolean(s.ingresos) ||
          Boolean(s.gastos),
      )
      const elegido = p.sitios.some((s) => s.clave === seleccion)
      if (ver === "dinero" && !conAlgo && !elegido) return false
      if (p.archivado && !conAlgo && !elegido) return false
      if (!q) return true
      return (
        normal(p.nombre).includes(q) ||
        p.sitios.some(
          (s) =>
            normal(s.nombre).includes(q) ||
            [...(suyos.get(s.clave) ?? []), ...(propuestos.get(s.clave) ?? [])].some((h) =>
              normal(h.nombre).includes(q),
            ),
        )
      )
    })
  }, [busqueda, ver, seleccion, modelo.proyectos, suyos, propuestos])

  const decidirVisibles = useMemo(() => {
    const q = normal(busqueda)
    return porDecidir.filter((h) => !q || normal(h.nombre).includes(q))
  }, [busqueda, porDecidir])

  const todasLasPropuestas = [...propuestos.entries()].flatMap(([clave, lista]) =>
    lista.map((h) => ({ h, clave })),
  )

  /* ------------------------------------------------------------- acciones */

  /** Lleva unos proyectos de Holded a un sitio, o a «por decidir» con null. */
  async function mover(ids: string[], clave: string | null) {
    const lista = holded.filter((h) => ids.includes(h.holdedId) && h.sitio !== clave)
    if (lista.length === 0) return
    setMovidos((m) => ({ ...m, ...Object.fromEntries(lista.map((h) => [h.holdedId, clave])) }))
    setOcupado(lista.length === 1 ? lista[0].holdedId : "varios")

    const hechos: { h: HoldedEditor; antes: Sitio | null }[] = []
    let error: string | null = null
    let aviso: string | null = null
    for (const h of lista) {
      const r: HechoEnlace = clave
        ? await enlazarHolded(h.holdedId, sitioDeClave(clave))
        : await aparcarHolded(h.holdedId)
      if ("error" in r) {
        error = r.error
        break
      }
      hechos.push({ h, antes: r.antes })
      aviso = r.aviso ?? aviso
    }
    setOcupado(null)

    if (error) avisar(error, undefined, "mal")
    if (hechos.length > 0) {
      const nombres = hechos.length === 1 ? hechos[0].h.nombre : `${hechos.length} proyectos de Holded`
      const texto = clave ? `${nombres} → ${etiquetaDe(clave)}.` : `${nombres}: por decidir.`
      avisar(aviso ? `${texto} ${aviso}` : texto, async () => {
        for (const { h, antes } of hechos) {
          const d = antes ? await enlazarHolded(h.holdedId, antes) : await aparcarHolded(h.holdedId)
          if ("error" in d) {
            router.refresh()
            return d.error
          }
        }
        router.refresh()
      })
    }
    router.refresh()
  }

  async function enlazarPropuestas() {
    setOcupado("propuestas")
    const r = await enlazarVarios(
      todasLasPropuestas.map(({ h, clave }) => ({ holdedId: h.holdedId, sitio: sitioDeClave(clave) })),
    )
    setOcupado(null)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    avisar(r.enlazados === 1 ? "1 propuesta enlazada." : `${r.enlazados} propuestas enlazadas.`)
    for (const e of r.errores.slice(0, 2)) avisar(e, undefined, "mal")
    router.refresh()
  }

  async function meter(proyecto: ProyectoEditor, sitio: SitioEditor, destino: Destino) {
    const origen = { proyectoId: proyecto.id, edicionId: sitio.edicionId }
    const nombreOrigen = sitio.edicionId ? sitio.nombre : proyecto.nombre
    setOcupado("meter")
    const r = await meterEn(origen, destino)
    setOcupado(null)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    const clave = claveSitio({ proyectoId: destino.proyectoId, edicionId: r.edicionId })
    const p = modelo.proyectos.find((x) => x.id === destino.proyectoId)
    const nombreDestino = destino.nueva
      ? `edición nueva de ${p?.nombre ?? "otro proyecto"}`
      : etiquetaDe(clave)
    setSeleccion(clave)
    setTraido(r.enlaces.length ? { clave, ids: r.enlaces } : null)
    avisar(
      `${nombreOrigen} → ${nombreDestino} (${formatDurationShort(r.segundos)}).`,
      async () => {
        const d = await deshacerMeter(r.deshacer)
        setTraido(null)
        setSeleccion(sitio.clave)
        router.refresh()
        if ("error" in d) return d.error
      },
    )
    router.refresh()
  }

  function meterEleccion(proyecto: ProyectoEditor, sitio: SitioEditor, e: Eleccion) {
    void meter(
      proyecto,
      sitio,
      e.tipo === "nueva"
        ? { proyectoId: e.proyecto.id, edicionId: null, nueva: true }
        : { proyectoId: e.proyecto.id, edicionId: e.sitio.edicionId, nueva: false },
    )
  }

  function descartar(h: HoldedEditor) {
    setDescartadas((d) => new Set(d).add(h.holdedId))
  }

  /* ------------------------------------------------------------- arrastre */

  const sobreRef = useRef<string | null>(null)
  const velocidad = useRef(0)

  function sePuedeSoltar(carga: Carga, destino: string) {
    const [tipo, valor] = [destino.slice(0, destino.indexOf(":")), destino.slice(destino.indexOf(":") + 1)]
    if (carga.tipo === "holded") {
      if (tipo === "sitio") return valor !== carga.h.sitio
      if (tipo === "decidir") return carga.h.sitio !== null
      return false
    }
    if (tipo === "nueva") return valor !== carga.proyecto.id
    if (tipo === "sitio") {
      const d = sitios.get(valor)
      return Boolean(d) && sePuedeMeter(carga.proyecto, carga.sitio, d!.proyecto, d!.sitio)
    }
    return false
  }

  function soltarEn(carga: Carga, destino: string) {
    const tipo = destino.slice(0, destino.indexOf(":"))
    const valor = destino.slice(destino.indexOf(":") + 1)
    if (carga.tipo === "holded") {
      void mover([carga.h.holdedId], tipo === "sitio" ? valor : null)
      return
    }
    void meter(
      carga.proyecto,
      carga.sitio,
      tipo === "nueva"
        ? { proyectoId: valor, edicionId: null, nueva: true }
        : { ...sitioDeClave(valor), nueva: false },
    )
  }

  function empezar(e: React.PointerEvent, carga: Carga, alPulsar: () => void) {
    if (e.button !== 0 || ocupado) return
    if ((e.target as HTMLElement).closest("button, a, input, select")) return
    const x0 = e.clientX
    const y0 = e.clientY
    let activo = false
    let marco = 0

    const ancla = () => {
      if (carga.tipo !== "holded") return null
      const el = document.querySelector(`[data-ancla-holded="${CSS.escape(carga.h.holdedId)}"]`)
      const r = el?.getBoundingClientRect()
      return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    }

    const desplazar = () => {
      if (velocidad.current) window.scrollBy(0, velocidad.current)
      marco = requestAnimationFrame(desplazar)
    }

    const alMover = (ev: PointerEvent) => {
      if (!activo) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return
        activo = true
        document.body.style.userSelect = "none"
        marco = requestAnimationFrame(desplazar)
      }
      const borde = 72
      velocidad.current =
        ev.clientY < borde
          ? -Math.ceil((borde - ev.clientY) / 6)
          : ev.clientY > window.innerHeight - borde
            ? Math.ceil((ev.clientY - (window.innerHeight - borde)) / 6)
            : 0
      const debajo = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>("[data-soltar]")?.dataset.soltar
      const valido = debajo && sePuedeSoltar(carga, debajo) ? debajo : null
      sobreRef.current = valido
      setSobre(valido)
      setArrastre({ carga, x: ev.clientX, y: ev.clientY, ancla: ancla() })
    }

    const terminar = (soltar: boolean) => {
      window.removeEventListener("pointermove", alMover)
      window.removeEventListener("pointerup", alSoltar)
      window.removeEventListener("pointercancel", alCancelar)
      window.removeEventListener("keydown", alTeclear)
      cancelAnimationFrame(marco)
      velocidad.current = 0
      document.body.style.userSelect = ""
      const destino = sobreRef.current
      sobreRef.current = null
      setArrastre(null)
      setSobre(null)
      if (!activo) {
        if (soltar) alPulsar()
        return
      }
      if (soltar && destino) soltarEn(carga, destino)
    }
    const alSoltar = () => terminar(true)
    const alCancelar = () => terminar(false)
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") terminar(false)
    }

    window.addEventListener("pointermove", alMover)
    window.addEventListener("pointerup", alSoltar)
    window.addEventListener("pointercancel", alCancelar)
    window.addEventListener("keydown", alTeclear)
  }

  /* --------------------------------------------------------------- líneas */

  const lienzo = useRef<HTMLDivElement>(null)
  const lineas = useRef<SVGSVGElement>(null)

  /* Las líneas se miden del DOM después de pintar: van de la tarjeta de
     Holded al sitio, estén donde estén. Se dibujan a mano en el SVG para no
     volver a pintar la pantalla entera por cada medida. */
  useLayoutEffect(() => {
    const cont = lienzo.current
    const svg = lineas.current
    if (!cont || !svg) return
    const dibujar = () => {
      const base = cont.getBoundingClientRect()
      const trozos: string[] = []
      cont.querySelectorAll<HTMLElement>("[data-linea]").forEach((el) => {
        const [holdedId, clave, tipo] = (el.dataset.linea ?? "").split("§")
        const a = el.querySelector("[data-ancla-holded]")?.getBoundingClientRect()
        const b = cont
          .querySelector(`[data-ancla-sitio="${CSS.escape(clave)}"]`)
          ?.getBoundingClientRect()
        if (!a?.width || !b?.width || !holdedId) return
        const x1 = a.left + a.width / 2 - base.left
        const y1 = a.top + a.height / 2 - base.top
        const x2 = b.left + b.width / 2 - base.left
        const y2 = b.top + b.height / 2 - base.top
        const medio = (x1 + x2) / 2
        const elegida = clave === seleccion
        trozos.push(
          `<path d="M${x1},${y1} C${medio},${y1} ${medio},${y2} ${x2},${y2}" fill="none" stroke="${
            elegida ? "var(--accent)" : "var(--line-strong)"
          }" stroke-width="${elegida ? 2.5 : 1.75}"${tipo === "propuesta" ? ' stroke-dasharray="6 5"' : ""}/>`,
        )
      })
      svg.innerHTML = trozos.join("")
    }
    dibujar()
    const observador = new ResizeObserver(dibujar)
    observador.observe(cont)
    return () => observador.disconnect()
  })

  /* ------------------------------------------------------------- pintar */

  const elegido = seleccion ? sitios.get(seleccion) : undefined

  const detalle = (onCerrar?: () => void, cabecera = true) =>
    elegido && (
      <DetalleSitioHolded
        proyecto={elegido.proyecto}
        sitio={elegido.sitio}
        cuentas={cuentasDe(elegido.sitio)}
        suyos={suyos.get(elegido.sitio.clave) ?? []}
        propuestos={propuestos.get(elegido.sitio.clave) ?? []}
        holded={holded}
        proyectos={modelo.proyectos}
        traido={traido?.clave === elegido.sitio.clave ? traido.ids : null}
        etiquetaDe={etiquetaDe}
        onMover={(ids, clave) => void mover(ids, clave)}
        onDescartar={descartar}
        onMeter={(e) => meterEleccion(elegido.proyecto, elegido.sitio, e)}
        onCerrar={onCerrar}
        cabecera={cabecera}
      />
    )

  const enlazarCon = (h: HoldedEditor) => (
    <ElegirSitio
      titulo={`Enlazar ${h.nombre} con…`}
      proyectos={modelo.proyectos}
      vale={(s) => !s.archivado}
      onElegir={(e) => e.tipo === "sitio" && void mover([h.holdedId], e.sitio.clave)}
      className="h-7 shrink-0 px-2"
    >
      <Link2 className="h-3.5 w-3.5" />
      Enlazar
    </ElegirSitio>
  )

  return (
    <section className="space-y-3">
      {/* ------------------------------------------------------ barra */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            className="field h-8 py-0 pl-8 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar en hitoo y en Holded"
          />
        </div>
        <div className="flex overflow-hidden rounded-[var(--radio-sm)] border border-line" role="radiogroup" aria-label="Qué proyectos se ven">
          {(
            [
              ["dinero", "Con dinero"],
              ["todo", "Todos"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={ver === valor}
              onClick={() => setVer(valor)}
              className={cn(
                "h-8 px-3 text-xs transition",
                ver === valor ? "bg-accent text-accent-fg" : "bg-surface text-ink-soft",
              )}
            >
              {texto}
            </button>
          ))}
        </div>
        {todasLasPropuestas.length > 1 && (
          <button
            type="button"
            onClick={() => void enlazarPropuestas()}
            disabled={ocupado !== null}
            className="btn btn-primary h-8 text-xs"
          >
            {ocupado === "propuestas" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Aceptar las {todasLasPropuestas.length} propuestas
          </button>
        )}
        {ocupado && ocupado !== "propuestas" && (
          <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Guardando" />
        )}
      </div>
      <p className="hidden text-xs text-muted lg:block">
        Arrastra un proyecto de Holded hasta su sitio, o un proyecto o una edición de hitoo por
        su asa hasta otra edición. Línea continua: enlazado. Discontinua: propuesta.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {/* ------------------------------------------ por decidir, móvil */}
          {porDecidir.length > 0 && (
            <details className="card mb-3 p-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold">
                Por decidir ({porDecidir.length})
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {decidirVisibles.map((h) => (
                  <li key={h.holdedId} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{h.nombre}</p>
                      {cifrasHolded(h) && <p className="cifra text-xs text-muted">{cifrasHolded(h)}</p>}
                    </div>
                    {enlazarCon(h)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {visibles.length === 0 && (
            <p className="card p-4 text-sm text-muted">
              {busqueda
                ? "Nada se llama así."
                : ver === "dinero"
                  ? "Todavía no hay ningún proyecto con dinero de Holded. Arrastra uno desde «Por decidir» o mira «Todos»."
                  : "No hay proyectos."}
            </p>
          )}

          {/* ------------------------------------------ el lienzo */}
          <div ref={lienzo} className="relative">
            <svg
              ref={lineas}
              className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
              aria-hidden
            />

            <div className="hidden grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] pb-1 text-xs font-semibold text-muted lg:grid">
              <span>HOLDED · DINERO</span>
              <span />
              <span>HITOO · HORAS</span>
            </div>

            {visibles.map((p) => {
              const aSoltar = `nueva:${p.id}`
              const cargaProyecto: Carga | null = p.conEdiciones
                ? { tipo: "sitio", proyecto: p, sitio: { ...p.sitios[0], edicionId: null, clave: `${p.id}|`, nombre: p.nombre } }
                : null
              const mostrarNueva =
                arrastre?.carga.tipo === "sitio" && arrastre.carga.proyecto.id !== p.id
              return (
                <div key={p.id} className="pt-3">
                  {/* cabecera del proyecto */}
                  <div className="flex min-h-9 items-center gap-2 border-b border-line pb-1.5 lg:ml-[calc(50%+2rem)]">
                    {cargaProyecto && (
                      <span
                        onPointerDown={(e) => empezar(e, cargaProyecto, () => {})}
                        className="hidden cursor-grab touch-none text-muted lg:block"
                        title="Arrastrar el proyecto entero"
                        aria-hidden
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    )}
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nombre}</h3>
                    {p.archivado && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">archivado</span>}
                    {mostrarNueva && (
                      <span
                        data-soltar={aSoltar}
                        className={cn(
                          "hidden shrink-0 items-center gap-1 rounded-[var(--radio-sm)] border-2 border-dashed border-accent px-2 py-1 text-xs font-medium text-accent lg:flex",
                          sobre === aSoltar && "bg-accent-soft",
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Soltar para edición nueva
                      </span>
                    )}
                  </div>

                  {p.sitios.map((s) => {
                    const cuentas = cuentasDe(s)
                    const lista = suyos.get(s.clave) ?? []
                    const dudas = propuestos.get(s.clave) ?? []
                    // Sin dinero no hay €/h que enseñar: un 0 €/h sería un cero de mentira
                    const porHora =
                      cuentas.ingresos || cuentas.gastos
                        ? beneficioPorHora(cuentas.ingresos ?? 0, cuentas.gastos ?? 0, s.facturables)
                        : null
                    const aSoltarSitio = `sitio:${s.clave}`
                    const encima = sobre === aSoltarSitio
                    const cargaSitio: Carga | null =
                      s.edicionId !== null || !p.conEdiciones ? { tipo: "sitio", proyecto: p, sitio: s } : null
                    const elegida = seleccion === s.clave
                    const resumen = (
                      <>
                        <p className="truncate text-sm font-medium">{s.nombre}</p>
                        <p className="cifra truncate text-xs text-muted">
                          {formatDurationShort(s.segundos)} · {formatDurationShort(s.facturables)} fact.
                          {porHora !== null && (
                            <span className={cn("font-semibold text-ink", porHora < 0 && "text-danger")}>
                              {" · "}
                              {porHora.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/h
                            </span>
                          )}
                        </p>
                      </>
                    )

                    return (
                      <div key={s.clave}>
                        {/* ---------------- ordenador: Holded | líneas | sitio */}
                        <div className="hidden grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center py-1.5 lg:grid">
                          <div className="space-y-1.5">
                            {[...lista.map((h) => ({ h, duda: false })), ...dudas.map((h) => ({ h, duda: true }))].map(
                              ({ h, duda }) => (
                                <div
                                  key={h.holdedId}
                                  data-linea={`${h.holdedId}§${s.clave}§${duda ? "propuesta" : "enlace"}`}
                                  onPointerDown={(e) =>
                                    empezar(e, { tipo: "holded", h }, () => setSeleccion(s.clave))
                                  }
                                  className={cn(
                                    "relative flex cursor-grab touch-none items-center gap-2 rounded-[var(--radio-sm)] border bg-surface py-1.5 pl-2 pr-3",
                                    duda ? "border-dashed border-line-strong" : "border-line",
                                    arrastre?.carga.tipo === "holded" &&
                                      arrastre.carga.h.holdedId === h.holdedId &&
                                      "opacity-40",
                                    ocupado === h.holdedId && "opacity-60",
                                  )}
                                >
                                  <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm" title={h.nombre}>
                                      {h.nombre}
                                    </p>
                                    <p className="cifra truncate text-xs text-muted">
                                      {duda
                                        ? h.hermano
                                          ? `se llama casi igual que ${h.hermano}`
                                          : "¿va aquí?"
                                        : cifrasHolded(h)}
                                    </p>
                                  </div>
                                  {duda && (
                                    <div className="flex shrink-0 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => void mover([h.holdedId], s.clave)}
                                        className="btn h-7 w-7 p-0 text-accent"
                                        aria-label={`Juntar ${h.nombre} aquí`}
                                        title="Juntar aquí"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => descartar(h)}
                                        className="btn h-7 w-7 p-0"
                                        aria-label={`${h.nombre} no va aquí`}
                                        title="No va aquí"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                  <span
                                    data-ancla-holded={h.holdedId}
                                    className="absolute -right-[6px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
                                  />
                                </div>
                              ),
                            )}
                          </div>
                          <span />
                          <div
                            data-soltar={aSoltarSitio}
                            onPointerDown={(e) =>
                              cargaSitio
                                ? empezar(e, cargaSitio, () => setSeleccion(elegida ? null : s.clave))
                                : undefined
                            }
                            onClick={() => !cargaSitio && setSeleccion(elegida ? null : s.clave)}
                            className={cn(
                              "relative flex items-center gap-2 rounded-[var(--radio-sm)] border bg-surface py-1.5 pl-2 pr-3 transition",
                              cargaSitio ? "cursor-grab touch-none" : "cursor-pointer",
                              elegida ? "border-accent ring-1 ring-accent" : "border-line",
                              encima && "border-accent bg-accent-soft ring-1 ring-accent",
                              s.archivado && "opacity-60",
                              arrastre?.carga.tipo === "sitio" &&
                                arrastre.carga.sitio.clave === s.clave &&
                                "opacity-40",
                            )}
                          >
                            <GripVertical
                              className={cn("h-4 w-4 shrink-0", cargaSitio ? "text-muted" : "text-transparent")}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">{resumen}</div>
                            {encima && arrastre?.carga.tipo === "sitio" && (
                              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">
                                se juntan
                              </span>
                            )}
                            <span
                              data-ancla-sitio={s.clave}
                              className="absolute -left-[6px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
                            />
                          </div>
                        </div>

                        {/* ---------------- móvil: el sitio con lo suyo dentro */}
                        <div
                          className={cn(
                            "mt-2 rounded-[var(--radio-sm)] border bg-surface lg:hidden",
                            elegida ? "border-accent" : "border-line",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSeleccion(elegida ? null : s.clave)}
                            aria-expanded={elegida}
                            className="w-full px-3 py-2 text-left"
                          >
                            {resumen}
                            {!elegida &&
                              [...lista, ...dudas].map((h) => (
                                <p key={h.holdedId} className="mt-1 truncate text-xs text-ink-soft">
                                  {dudas.includes(h) ? "¿" : "· "}
                                  {h.nombre}
                                  {dudas.includes(h) ? "?" : ""}
                                </p>
                              ))}
                          </button>
                          {elegida && (
                            <div className="border-t border-line p-3">{detalle(undefined, false)}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* ------------------------------------------ lateral, ordenador */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-3">
            {elegido && (
              <div className="card shrink-0 overflow-y-auto p-4">{detalle(() => setSeleccion(null))}</div>
            )}
            <div
              data-soltar="decidir:"
              className={cn(
                "card flex min-h-0 flex-col p-3 transition",
                sobre === "decidir:" && "border-accent bg-accent-soft ring-1 ring-accent",
              )}
            >
              <p className="text-sm font-semibold">Por decidir ({porDecidir.length})</p>
              <p className="text-xs text-muted">
                {arrastre?.carga.tipo === "holded" && arrastre.carga.h.sitio
                  ? "Suéltalo aquí para quitarlo de su sitio."
                  : "Arrástralos a su sitio, o pulsa «Enlazar»."}
              </p>
              <ul className="mt-2 min-h-0 space-y-1.5 overflow-y-auto">
                {decidirVisibles.map((h) => (
                  <li
                    key={h.holdedId}
                    onPointerDown={(e) => empezar(e, { tipo: "holded", h }, () => {})}
                    className={cn(
                      "cursor-grab touch-none rounded-[var(--radio-sm)] border border-line bg-surface py-1.5 pl-1.5 pr-2",
                      arrastre?.carga.tipo === "holded" &&
                        arrastre.carga.h.holdedId === h.holdedId &&
                        "opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" title={h.nombre}>
                          {h.nombre}
                        </p>
                        {cifrasHolded(h) && (
                          <p className="cifra truncate text-xs text-muted">{cifrasHolded(h)}</p>
                        )}
                      </div>
                      {enlazarCon(h)}
                    </div>
                  </li>
                ))}
                {porDecidir.length === 0 && (
                  <li className="text-sm text-muted">Todo tiene su sitio.</li>
                )}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------ lo que se arrastra */}
      {arrastre && (
        <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
          {arrastre.carga.tipo === "holded" && arrastre.ancla && (
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              <path
                d={`M${arrastre.ancla.x},${arrastre.ancla.y} C${(arrastre.ancla.x + arrastre.x) / 2},${arrastre.ancla.y} ${(arrastre.ancla.x + arrastre.x) / 2},${arrastre.y} ${arrastre.x},${arrastre.y}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2.5}
              />
            </svg>
          )}
          <div
            className="absolute max-w-64 -rotate-2 rounded-[var(--radio-sm)] border border-accent bg-surface px-3 py-1.5"
            style={{
              left: arrastre.x + 12,
              top: arrastre.y + 10,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <p className="truncate text-sm font-medium">
              {arrastre.carga.tipo === "holded"
                ? arrastre.carga.h.nombre
                : arrastre.carga.sitio.edicionId
                  ? `${arrastre.carga.proyecto.nombre} › ${arrastre.carga.sitio.nombre}`
                  : arrastre.carga.proyecto.nombre}
            </p>
            <p className="cifra text-xs text-muted">
              {arrastre.carga.tipo === "holded"
                ? cifrasHolded(arrastre.carga.h)
                : `${formatDurationShort(
                    arrastre.carga.sitio.edicionId
                      ? arrastre.carga.sitio.segundos
                      : arrastre.carga.proyecto.sitios.reduce((t, x) => t + x.segundos, 0),
                  )} de horas`}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
