"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import type { Espacio } from "@/lib/tipos"
import { EMPRESA, PRECIO } from "@/lib/empresa"
import { cn, nuevoCodigo } from "@/lib/utils"

export type Plaza = {
  id: string
  name: string
  claimed_by: string | null
  quien: string | null
}

/**
 * El alta al estilo Tricount: quien administra escribe los nombres del equipo y
 * reparte un enlace. Cada uno entra y dice cual es el suyo, sin que nadie tenga
 * que ir pidiendo correos.
 */
export function GestionPlazas({
  espacio,
  plazas,
  personas,
}: {
  espacio: Espacio
  plazas: Plaza[]
  /** Cuanta gente va a haber en el espacio, contando huecos sin coger. */
  personas: number
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const enlace = espacio.join_code
    ? `${typeof window === "undefined" ? "" : window.location.origin}/unirse/${espacio.join_code}`
    : null

  async function hacer(trabajo: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true)
    setError(null)
    const { error: err } = await trabajo()
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return false
    }
    router.refresh()
    return true
  }

  async function anadir() {
    const limpio = nombre.trim()
    if (!limpio) return
    const ok = await hacer(() =>
      createClient()
        .from("workspace_seats")
        .insert({ workspace_id: espacio.id, name: limpio }),
    )
    if (ok) setNombre("")
  }

  async function quitar(id: string) {
    await hacer(() => createClient().from("workspace_seats").delete().eq("id", id))
  }

  async function cambiarEnlace(quitarlo = false) {
    await hacer(() =>
      createClient()
        .from("workspaces")
        .update({ join_code: quitarlo ? null : nuevoCodigo() })
        .eq("id", espacio.id),
    )
  }

  async function copiar() {
    if (!enlace) return
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError("El navegador no ha dejado copiar. Selecciónalo a mano.")
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">Quién es quién</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">
        Escribe los nombres y reparte el enlace: cada uno entra con su correo o
        con Google y dice cuál es el suyo.
      </p>

      {error && (
        <p className="mb-3 rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {/* La cuota cubre 20 personas. Se avisa, no se corta: con un solo precio
          y sin plan de mas arriba, cerrarle la puerta al equipo 21 es
          rechazar al cliente mas grande que tienes. Decidido el 7-sep-2026. */}
      {personas > PRECIO.personas && (
        <p className="mb-3 rounded-[var(--radio-sm)] bg-surface-2 p-2.5 text-sm">
          Sois <strong>{personas}</strong> y la cuota cubre {PRECIO.personas}.
          No se corta nada y todo el mundo puede apuntar, pero escríbenos a{" "}
          <a href={`mailto:${EMPRESA.correo}`} className="underline">
            {EMPRESA.correo}
          </a>{" "}
          y lo ajustamos.
        </p>
      )}

      <ul className="divide-y divide-line">
        {plazas.length === 0 && (
          <li className="py-2 text-sm text-muted">
            Todavía no hay nombres apuntados.
          </li>
        )}
        {plazas.map((plaza) => (
          <li key={plaza.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{plaza.name}</span>
            {plaza.claimed_by ? (
              <span className="chip chip-facturable gap-1">
                <Check className="h-3 w-3" />
                {plaza.quien ?? "ya está dentro"}
              </span>
            ) : (
              <>
                <span className="chip">sin coger</span>
                <button
                  type="button"
                  onClick={() => void quitar(plaza.id)}
                  disabled={ocupado}
                  aria-label={`Quitar a ${plaza.name} de la lista`}
                  className="btn btn-ghost p-1.5 text-muted hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void anadir()
        }}
        className="mt-3 flex gap-2"
      >
        <input
          className="field"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ane Etxebarria"
          aria-label="Nombre de alguien del equipo"
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

      {/* ------------------------------------------------------- el enlace */}
      <div className="mt-4 border-t border-line pt-4">
        <span className="label">Enlace para unirse</span>
        {enlace ? (
          <>
            <div className="flex gap-2">
              <input
                readOnly
                value={enlace}
                onFocus={(e) => e.currentTarget.select()}
                className="field font-mono text-xs"
                aria-label="Enlace para unirse"
              />
              <button
                type="button"
                onClick={() => void copiar()}
                className={cn("btn shrink-0", copiado && "text-billable")}
              >
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void cambiarEnlace()}
                disabled={ocupado}
                className="btn btn-ghost text-xs text-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Cambiarlo
              </button>
              <button
                type="button"
                onClick={() => void cambiarEnlace(true)}
                disabled={ocupado}
                className="btn btn-ghost text-xs text-danger"
              >
                Dejar de aceptar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Quien tenga el enlace puede entrar como miembro. Si se te va de las
              manos, cámbialo y el anterior deja de valer.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void cambiarEnlace()}
            disabled={ocupado}
            className="btn"
          >
            <Link2 className="h-4 w-4" />
            Crear el enlace
          </button>
        )}
      </div>
    </section>
  )
}
