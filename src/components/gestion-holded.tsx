"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Link2, Loader2, RefreshCw, Unlink } from "lucide-react"

import { useAvisos } from "@/components/avisos"
import { formatDateShort, formatMoney } from "@/lib/time"
import { haceCuanto, type CierrePosible, type HoldedConexion, type HoldedProyecto } from "@/lib/holded"
import {
  actualizarHolded,
  conectarHolded,
  desconectarHolded,
  desenlazarCierre,
  enlazarCierre,
  enlazarVarios,
} from "@/app/(app)/gestion/holded/acciones"
import { cn } from "@/lib/utils"

type Cierre = CierrePosible & { etiqueta: string; income: number | null; expenses: number | null }
type Sitio = { proyectoId: string; edicionId: string | null }

const clave = (s: Sitio) => `${s.proyectoId}|${s.edicionId ?? ""}`

/**
 * Gestión → Holded. Arriba, la conexión: poner la clave, ver de cuándo son
 * los datos y cuánto cupo queda. Abajo, los proyectos de Holded y con qué
 * cierre de hitoo va cada uno, con lo que se parece ya propuesto.
 */
export function GestionHolded({
  esAdmin,
  conexion,
  proyectos,
  cierres,
  sugerencias,
}: {
  esAdmin: boolean
  conexion: HoldedConexion | null
  proyectos: HoldedProyecto[]
  cierres: Cierre[]
  sugerencias: Record<string, Sitio>
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [nuevaClave, setNuevaClave] = useState("")
  const [conectando, setConectando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [vista, setVista] = useState<"pendientes" | "enlazados">("pendientes")
  const [elegido, setElegido] = useState<Record<string, string>>({})

  const porClave = useMemo(() => new Map(cierres.map((c) => [clave(c), c])), [cierres])
  const enlazadoA = useMemo(
    () => new Map(cierres.filter((c) => c.holdedId).map((c) => [c.holdedId!, c])),
    [cierres],
  )
  const libres = cierres.filter((c) => !c.holdedId)
  const pendientes = proyectos.filter((p) => !enlazadoA.has(p.holded_id))
  const conPropuesta = pendientes.filter((p) => sugerencias[p.holded_id])
  const enlazados = proyectos.filter((p) => enlazadoA.has(p.holded_id))

  async function conectar() {
    setConectando(true)
    setError(null)
    const r = await conectarHolded(nuevaClave)
    setConectando(false)
    if ("error" in r) {
      setError(r.error)
      return
    }
    setNuevaClave("")
    avisar("Holded conectado.")
    router.refresh()
  }

  async function actualizar() {
    setActualizando(true)
    const r = await actualizarHolded()
    setActualizando(false)
    if (!r.ok) avisar(r.error, undefined, "mal")
    else avisar(r.aviso ?? (r.actualizados === 1 ? "1 cierre actualizado." : `${r.actualizados} cierres actualizados.`))
    router.refresh()
  }

  async function desconectar() {
    setOcupado("baja")
    const r = await desconectarHolded()
    setOcupado(null)
    setConfirmarBaja(false)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    avisar("Holded desconectado. En Holded no se ha borrado nada.")
    router.refresh()
  }

  async function enlazar(p: HoldedProyecto, sitio: Sitio) {
    setOcupado(p.holded_id)
    const r = await enlazarCierre({ ...sitio, holdedId: p.holded_id })
    setOcupado(null)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      router.refresh()
      return
    }
    avisar(`${p.name} enlazado.`, async () => {
      const d = await desenlazarCierre(r.cierreId)
      router.refresh()
      if ("error" in d) return d.error
    })
    router.refresh()
  }

  async function enlazarPropuestas() {
    setOcupado("todas")
    const r = await enlazarVarios(
      conPropuesta.map((p) => ({ ...sugerencias[p.holded_id], holdedId: p.holded_id })),
    )
    setOcupado(null)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    avisar(
      r.enlazados === 1 ? "1 proyecto enlazado." : `${r.enlazados} proyectos enlazados.`,
    )
    for (const e of r.errores.slice(0, 2)) avisar(e, undefined, "mal")
    router.refresh()
  }

  /* ------------------------------------------------------------ sin clave */
  if (!conexion) {
    return (
      <section className="card max-w-2xl p-4">
        <h2 className="text-sm font-semibold">Conectar Holded</h2>
        <p className="mt-0.5 text-sm text-muted">
          Los ingresos y gastos de cada edición llegarán solos desde Holded.
        </p>

        {esAdmin ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void conectar()
            }}
          >
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>
                En Holded: Configuración → Desarrolladores → Credenciales → Añadir token.
              </li>
              <li>
                Dale <strong>solo lectura</strong> en Proyectos y en Ventas. hitoo no escribe nada.
              </li>
              <li>Copia la clave y pégala aquí.</li>
            </ol>
            <div>
              <label className="label" htmlFor="holded-clave">
                Clave de Holded
              </label>
              <input
                id="holded-clave"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="field font-mono"
                value={nuevaClave}
                onChange={(e) => setNuevaClave(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">
                Se guarda cifrada y no vuelve a salir del servidor, ni para quien la pone.
              </p>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={conectando || !nuevaClave.trim()}
              className="btn btn-primary"
            >
              {conectando && <Loader2 className="h-4 w-4 animate-spin" />}
              {conectando ? "Comprobando y trayendo…" : "Conectar"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            Lo conecta quien administra el espacio, con una clave de Holded.
          </p>
        )}
      </section>
    )
  }

  /* ------------------------------------------------------------ con clave */
  return (
    <div className="space-y-5">
      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Holded conectado</h2>
            <p className="mt-0.5 text-sm text-muted" suppressHydrationWarning>
              Clave …{conexion.key_last4} ·{" "}
              {conexion.last_synced_at
                ? `datos traídos ${haceCuanto(conexion.last_synced_at)}`
                : "sin datos traídos todavía"}
              {conexion.usage_limit
                ? ` · ${conexion.usage_count?.toLocaleString("es-ES") ?? "?"} de ${conexion.usage_limit.toLocaleString("es-ES")} llamadas este mes`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted">Se actualiza solo una vez al día.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void actualizar()}
              disabled={actualizando}
              className="btn h-8 text-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", actualizando && "animate-spin")} />
              {actualizando ? "Trayendo…" : "Actualizar"}
            </button>
            {esAdmin && !confirmarBaja && (
              <button type="button" onClick={() => setConfirmarBaja(true)} className="btn h-8 text-xs">
                Desconectar
              </button>
            )}
          </div>
        </div>

        {conexion.last_error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-[var(--radio-sm)] border border-live-line bg-live-soft p-2.5 text-sm text-live">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {conexion.last_error}
          </p>
        )}

        {confirmarBaja && (
          <div className="mt-3 space-y-2 rounded-[var(--radio-sm)] bg-danger-soft p-3 text-sm">
            <p className="text-ink">
              Se borra la clave de hitoo. <strong>En Holded no se borra nada</strong>, y los
              cierres enlazados se quedan con sus últimas cifras.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void desconectar()}
                disabled={ocupado === "baja"}
                className="btn btn-danger h-8 text-xs"
              >
                {ocupado === "baja" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Desconectar
              </button>
              <button type="button" onClick={() => setConfirmarBaja(false)} className="btn h-8 text-xs">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" className="flex gap-1 border-b border-line">
            {(
              [
                ["pendientes", `Sin enlazar (${pendientes.length})`],
                ["enlazados", `Enlazados (${enlazados.length})`],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={vista === valor}
                onClick={() => setVista(valor)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition",
                  vista === valor
                    ? "border-accent font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {texto}
              </button>
            ))}
          </div>
          {vista === "pendientes" && conPropuesta.length > 1 && (
            <button
              type="button"
              onClick={() => void enlazarPropuestas()}
              disabled={ocupado !== null}
              className="btn btn-primary h-8 text-xs"
            >
              {ocupado === "todas" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Enlazar las {conPropuesta.length} propuestas
            </button>
          )}
        </div>

        {proyectos.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no se ha traído ningún proyecto de Holded. Pulsa «Actualizar».
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {(vista === "pendientes"
              ? [...conPropuesta, ...pendientes.filter((p) => !sugerencias[p.holded_id])]
              : enlazados
            ).map((p) => {
              const cierre = enlazadoA.get(p.holded_id)
              const propuesta = sugerencias[p.holded_id]
              const propuestaCierre = propuesta ? porClave.get(clave(propuesta)) : undefined
              return (
                <li
                  key={p.holded_id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="cifra text-xs text-muted">
                      {p.start_date ? `desde el ${formatDateShort(p.start_date)}` : "sin fecha"}
                    </p>
                  </div>

                  {cierre ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
                      <Link
                        href={`/proyectos/${cierre.proyectoId}?ver=ediciones`}
                        className="truncate text-sm text-accent hover:underline"
                      >
                        {cierre.etiqueta}
                      </Link>
                      <span className="cifra text-xs text-muted">
                        {formatMoney(cierre.income)} − {formatMoney(cierre.expenses)}
                      </span>
                    </div>
                  ) : propuestaCierre ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                      <span className="truncate text-sm text-ink-soft">
                        ¿{propuestaCierre.etiqueta}?
                      </span>
                      <button
                        type="button"
                        onClick={() => void enlazar(p, propuesta)}
                        disabled={ocupado !== null}
                        className="btn h-8 shrink-0 text-xs"
                      >
                        {ocupado === p.holded_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        Enlazar
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2 sm:justify-end">
                      <select
                        className="field h-8 min-w-0 flex-1 py-0 text-sm sm:w-56 sm:flex-none"
                        value={elegido[p.holded_id] ?? ""}
                        onChange={(e) => setElegido({ ...elegido, [p.holded_id]: e.target.value })}
                        aria-label={`Con qué cierre va ${p.name}`}
                      >
                        <option value="">Enlazar con…</option>
                        {libres.map((c) => (
                          <option key={clave(c)} value={clave(c)}>
                            {c.etiqueta}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const c = porClave.get(elegido[p.holded_id] ?? "")
                          if (c) void enlazar(p, c)
                        }}
                        disabled={ocupado !== null || !elegido[p.holded_id]}
                        className="btn h-8 shrink-0 text-xs"
                      >
                        {ocupado === p.holded_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Enlazar
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {vista === "enlazados" && enlazados.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Unlink className="h-3.5 w-3.5" aria-hidden />
            Para desenlazar o ajustar una cifra, entra en el proyecto.
          </p>
        )}
      </section>
    </div>
  )
}
