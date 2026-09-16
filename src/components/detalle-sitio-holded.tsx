"use client"

import { useId, useMemo, useState } from "react"
import Link from "next/link"
import * as Popover from "@radix-ui/react-popover"
import { ArrowRightLeft, Check, ExternalLink, Plus, Search, X } from "lucide-react"

import { ElegirSitio, type Eleccion } from "@/components/elegir-sitio"
import {
  beneficioPorHora,
  type HoldedEditor,
  type ProyectoEditor,
  type SitioEditor,
} from "@/lib/editor-holded"
import { formatDurationShort, formatMoney } from "@/lib/time"
import { cn } from "@/lib/utils"

function normal(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** «+1.000 € · −200 €», o vacío si nunca se han traído sus cifras. */
export function cifrasHolded(h: HoldedEditor) {
  if (h.ingresos === null && h.gastos === null) return ""
  return `+${formatMoney(h.ingresos)} · −${formatMoney(h.gastos)}`
}

/**
 * El detalle de un sitio: de dónde le viene el dinero, lo que deja y a cuánto
 * sale la hora facturable. Desde aquí se junta, se quita y se mete en otro
 * sitio, igual que arrastrando.
 */
export function DetalleSitioHolded({
  proyecto,
  sitio,
  cuentas,
  suyos,
  propuestos,
  holded,
  proyectos,
  traido,
  etiquetaDe,
  onMover,
  onDescartar,
  onMeter,
  onCerrar,
  cabecera = true,
}: {
  proyecto: ProyectoEditor
  sitio: SitioEditor
  cuentas: { ingresos: number | null; gastos: number | null }
  suyos: HoldedEditor[]
  propuestos: HoldedEditor[]
  holded: HoldedEditor[]
  proyectos: ProyectoEditor[]
  /** Los de Holded que acaban de llegar con lo que se ha metido aquí. */
  traido: string[] | null
  etiquetaDe: (clave: string | null) => string
  /** Lleva esos proyectos de Holded a un sitio, o a «por decidir» con null. */
  onMover: (ids: string[], clave: string | null) => void
  onDescartar: (h: HoldedEditor) => void
  onMeter: (eleccion: Eleccion) => void
  onCerrar?: () => void
  /** En el móvil se abre dentro de la tarjeta del sitio, que ya lo nombra. */
  cabecera?: boolean
}) {
  const ingresos = cuentas.ingresos ?? 0
  const gastos = cuentas.gastos ?? 0
  const beneficio = ingresos - gastos
  const porHora = beneficioPorHora(ingresos, gastos, sitio.facturables)
  const hayDinero = Boolean(cuentas.ingresos) || Boolean(cuentas.gastos)

  return (
    <div className="space-y-4">
      {cabecera && (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted">{proyecto.nombre}</p>
          <h3 className="truncate text-sm font-semibold">{sitio.nombre}</h3>
          <p className="cifra text-xs text-muted">
            {formatDurationShort(sitio.segundos)} · {formatDurationShort(sitio.facturables)} facturables
          </p>
        </div>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="btn h-7 w-7 shrink-0 p-0"
            aria-label="Cerrar el detalle"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      )}

      {traido && traido.length > 0 && (
        <DineroTraido
          proyecto={proyecto}
          sitio={sitio}
          traido={traido}
          holded={holded}
          onMover={onMover}
        />
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted">De dónde viene el dinero</p>
        {suyos.length === 0 && propuestos.length === 0 && (
          <p className="text-sm text-muted">
            {hayDinero ? "Apuntado a mano, sin Holded." : "Ningún proyecto de Holded todavía."}
          </p>
        )}
        <ul className="space-y-1.5">
          {suyos.map((h) => (
            <li key={h.holdedId} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{h.nombre}</p>
                <p className="cifra text-xs text-muted">{cifrasHolded(h)}</p>
              </div>
              <button
                type="button"
                onClick={() => onMover([h.holdedId], null)}
                className="btn h-7 shrink-0 px-2 text-xs"
              >
                Quitar
              </button>
            </li>
          ))}
          {propuestos.map((h) => (
            <li
              key={h.holdedId}
              className="flex items-start justify-between gap-2 rounded-[var(--radio-sm)] border border-dashed border-line-strong p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">{h.nombre}</p>
                <p className="text-xs text-muted">
                  {h.hermano ? `Se llama casi igual que ${h.hermano}` : "Se parece al nombre"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onMover([h.holdedId], sitio.clave)}
                  className="btn btn-primary h-7 px-2 text-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  Juntar aquí
                </button>
                <button
                  type="button"
                  onClick={() => onDescartar(h)}
                  className="btn h-7 px-2 text-xs"
                >
                  No va aquí
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {hayDinero && (
        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Ingresos</dt>
            <dd className="cifra text-billable">{formatMoney(ingresos)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Gastos</dt>
            <dd className="cifra">−{formatMoney(gastos)}</dd>
          </div>
          <div className="flex justify-between gap-3 font-semibold">
            <dt>Beneficio</dt>
            <dd className={cn("cifra", beneficio < 0 && "text-danger")}>{formatMoney(beneficio)}</dd>
          </div>
          <div className="pt-2">
            <dt className="text-xs text-muted">Beneficio por hora facturable</dt>
            {porHora === null ? (
              <dd className="text-sm text-muted">Faltan horas facturables para sacarlo.</dd>
            ) : (
              <dd>
                <span className={cn("cifra text-lg font-semibold", porHora < 0 && "text-danger")}>
                  {porHora.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/h
                </span>
                <span className="block text-xs text-muted">
                  {formatMoney(beneficio)} entre {formatDurationShort(sitio.facturables)} facturables
                </span>
              </dd>
            )}
          </div>
        </dl>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <AnadirHolded sitio={sitio} holded={holded} etiquetaDe={etiquetaDe} onMover={onMover} />
        <ElegirSitio
          titulo={`Meter ${sitio.edicionId ? sitio.nombre : proyecto.nombre} en…`}
          proyectos={proyectos}
          vale={(s, p) => sePuedeMeter(proyecto, sitio, p, s)}
          nuevaEn={(p) => p.id !== proyecto.id}
          onElegir={onMeter}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Meter en…
        </ElegirSitio>
        <Link href={`/proyectos/${proyecto.id}?ver=ediciones`} className="btn h-8 text-xs">
          <ExternalLink className="h-3.5 w-3.5" />
          Ver el proyecto
        </Link>
      </div>
    </div>
  )
}

/**
 * Si lo de `origen` (una edición, o el proyecto entero si no la tiene) se
 * puede meter en `destino`. No en sí mismo, no en su propio proyecto si se
 * mete entero, y no en el cierre general de un proyecto que ya tiene ediciones.
 */
export function sePuedeMeter(
  proyectoOrigen: ProyectoEditor,
  origen: SitioEditor,
  proyectoDestino: ProyectoEditor,
  destino: SitioEditor,
) {
  if (destino.archivado) return false
  if (destino.edicionId === null && proyectoDestino.conEdiciones) return false
  if (proyectoDestino.id !== proyectoOrigen.id) return true
  return origen.edicionId !== null && destino.edicionId !== null && destino.edicionId !== origen.edicionId
}

/* ------------------------------------------------------- lo que ha llegado */

function DineroTraido({
  proyecto,
  sitio,
  traido,
  holded,
  onMover,
}: {
  proyecto: ProyectoEditor
  sitio: SitioEditor
  traido: string[]
  holded: HoldedEditor[]
  onMover: (ids: string[], clave: string | null) => void
}) {
  const traidos = holded.filter((h) => traido.includes(h.holdedId))
  const ahora = traidos[0]?.sitio ?? null
  const general = `${proyecto.id}|`
  const otras = proyecto.sitios.filter(
    (s) => s.edicionId !== null && s.clave !== sitio.clave && !s.archivado,
  )
  const [otra, setOtra] = useState(otras.find((s) => s.clave === ahora)?.clave ?? "")
  // El detalle se pinta dos veces (móvil y ordenador): cada grupo, su nombre
  const grupo = useId()

  const opcion = (alElegir: () => void, texto: React.ReactNode, marcado: boolean) => (
    <label className={cn("flex items-center gap-2 py-1 text-sm", marcado && "font-medium")}>
      <input
        type="radio"
        name={grupo}
        checked={marcado}
        onChange={alElegir}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {texto}
    </label>
  )

  return (
    <fieldset className="rounded-[var(--radio-sm)] bg-accent-soft p-3">
      <legend className="sr-only">A dónde va el dinero que ha llegado</legend>
      <p className="mb-1 text-sm">
        Traía el dinero de <strong>{traidos.map((h) => h.nombre).join(" y ")}</strong>. ¿A dónde va?
      </p>
      {opcion(
        () => onMover(traido, sitio.clave),
        `A ${sitio.edicionId ? `esta edición, ${sitio.nombre}` : "este proyecto"}`,
        ahora === sitio.clave,
      )}
      {otras.length > 0 && (
        <div className="flex items-center gap-2">
          {opcion(
            () => otra && onMover(traido, otra),
            "A otra edición",
            Boolean(ahora) && ahora !== sitio.clave && ahora !== general,
          )}
          <select
            className="field h-7 w-auto min-w-0 flex-1 py-0 text-xs"
            value={otra}
            onChange={(e) => {
              setOtra(e.target.value)
              if (e.target.value) onMover(traido, e.target.value)
            }}
            aria-label="Qué edición"
          >
            <option value="">Elegir</option>
            {otras.map((s) => (
              <option key={s.clave} value={s.clave}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {proyecto.conEdiciones &&
        opcion(() => onMover(traido, general), `A todo el proyecto ${proyecto.nombre}`, ahora === general)}
      {opcion(() => onMover(traido, null), "A ninguno: queda por decidir", ahora === null)}
    </fieldset>
  )
}

/* ---------------------------------------------------------- añadir de Holded */

function AnadirHolded({
  sitio,
  holded,
  etiquetaDe,
  onMover,
}: {
  sitio: SitioEditor
  holded: HoldedEditor[]
  etiquetaDe: (clave: string | null) => string
  onMover: (ids: string[], clave: string | null) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  const opciones = useMemo(() => {
    const q = normal(busqueda)
    const lista = holded.filter(
      (h) => h.sitio !== sitio.clave && (!q || normal(h.nombre).includes(q)),
    )
    // Primero los que están por decidir: los otros ya tienen sitio
    return [...lista.filter((h) => !h.sitio), ...lista.filter((h) => h.sitio)].slice(0, 30)
  }, [busqueda, holded, sitio.clave])

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger className="btn h-8 text-xs">
        <Plus className="h-3.5 w-3.5" />
        Juntar de Holded…
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="card z-50 flex max-h-[min(26rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-24px))] flex-col p-2"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              autoFocus
              className="field h-8 py-0 pl-8 text-sm"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en Holded"
              aria-label="Buscar proyecto de Holded"
            />
          </div>
          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {opciones.length === 0 && (
              <li className="px-1 py-2 text-sm text-muted">Ningún proyecto de Holded se llama así.</li>
            )}
            {opciones.map((h) => (
              <li key={h.holdedId}>
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false)
                    setBusqueda("")
                    onMover([h.holdedId], sitio.clave)
                  }}
                  className="w-full rounded-[var(--radio-sm)] px-2 py-1.5 text-left transition hover:bg-surface-2"
                >
                  <span className="block truncate text-sm">{h.nombre}</span>
                  <span className="block truncate text-xs text-muted">
                    {h.sitio ? `Ahora en ${etiquetaDe(h.sitio)}: se mueve aquí` : "Por decidir"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
