"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"

import { useAvisos } from "@/components/avisos"
import { haceCuanto, type HoldedConexion } from "@/lib/holded"
import {
  actualizarHolded,
  conectarHolded,
  desconectarHolded,
} from "@/app/(app)/gestion/holded/acciones"
import { cn } from "@/lib/utils"

/**
 * Gestión → Holded, arriba: poner la clave, ver de cuándo son los datos y
 * cuánto cupo queda. Lo de enlazar vive debajo, en el editor.
 */
export function ConexionHolded({
  esAdmin,
  conexion,
}: {
  esAdmin: boolean
  conexion: HoldedConexion | null
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [nuevaClave, setNuevaClave] = useState("")
  const [conectando, setConectando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualizando, setActualizando] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [dandoDeBaja, setDandoDeBaja] = useState(false)

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
    else
      avisar(
        r.aviso ??
          (r.actualizados === 1
            ? "1 proyecto de Holded actualizado."
            : `${r.actualizados} proyectos de Holded actualizados.`),
      )
    router.refresh()
  }

  async function desconectar() {
    setDandoDeBaja(true)
    const r = await desconectarHolded()
    setDandoDeBaja(false)
    setConfirmarBaja(false)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    avisar("Holded desconectado. En Holded no se ha borrado nada.")
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
              disabled={dandoDeBaja}
              className="btn btn-danger h-8 text-xs"
            >
              {dandoDeBaja && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Desconectar
            </button>
            <button type="button" onClick={() => setConfirmarBaja(false)} className="btn h-8 text-xs">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
