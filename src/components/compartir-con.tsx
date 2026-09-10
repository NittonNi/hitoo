"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import * as Popover from "@radix-ui/react-popover"
import { Check, Loader2, Users } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useAvisos } from "@/components/avisos"
import { useSesion } from "@/components/proveedor-sesion"
import type { EntradaVista, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

type Propuesta = { to_user: string; status: string }

/**
 * Con quién más cuenta esta hora, ya apuntada. Se puede cambiar después: a
 * quien se añade le llega una propuesta, y a quien se quita se le retira...
 * mientras no la haya aceptado. Una vez aceptada es una hora suya y no se le
 * puede borrar por la espalda: ahí solo cabe que la borre él.
 */
export function CompartirCon({
  entrada,
  miembros,
}: {
  entrada: EntradaVista
  miembros: Miembro[]
}) {
  const router = useRouter()
  const { perfil } = useSesion()
  const { avisar } = useAvisos()
  const [abierto, setAbierto] = useState(false)
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compartida = entrada.compartida_con ?? []
  const pendiente = compartida.some((c) => c.estado === "pendiente")
  /* Este rato vino de otra persona y lo aceptaste. Mientras ninguno de los dos
     cambie nada de fondo sigue siendo el mismo rato; en cuanto se toca, cada
     uno sigue por su lado y esto desaparece. */
  const vinoDe = entrada.venida_de
  // Con quién se puede compartir: todo el equipo menos la persona de la hora
  const otros = miembros.filter((m) => m.id !== entrada.user_id)
  /* ...y menos quien te la propuso: ya tiene este rato, y si se lo devuelves y
     lo acepta se queda con su propia hora dos veces, y así en bucle. Sale en
     la lista, marcado y quieto, pero no se le puede proponer. */
  const vinoDeId = entrada.venida_de_id
  const proponibles = otros.filter((m) => m.id !== vinoDeId)

  // Mismo texto para el title del ratón y el aria-label del lector de pantalla
  const tituloCompartir = vinoDe
    ? `Este rato lo apuntó ${vinoDe} y lo aceptaste: seguís teniendo el mismo. Si cambias algo, se separan.`
    : compartida.length === 0
      ? "Compartir estas horas con alguien más"
      : "También cuenta para " +
        compartida.map((c) => `${c.nombre} (${c.estado})`).join(", ")

  async function cargar() {
    const { data, error: err } = await createClient()
      .from("entry_invitations")
      .select("to_user, status")
      .eq("origin_entry_id", entrada.id)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setPropuestas(data ?? [])
  }

  function estadoDe(id: string) {
    return propuestas?.find((p) => p.to_user === id)?.status ?? null
  }

  async function alternar(id: string) {
    if (id === vinoDeId) return // aunque se fuerce el clic: no se le devuelve
    const ahora = estadoDe(id)
    if (ahora === "aceptada") return // ya es hora suya: no se toca

    setOcupado(true)
    setError(null)
    const supabase = createClient()

    if (ahora === null || ahora === "rechazada") {
      const { error: err } = await supabase.from("entry_invitations").insert({
        workspace_id: entrada.workspace_id,
        origin_entry_id: entrada.id,
        from_user: perfil.id,
        to_user: id,
        project_id: entrada.project_id,
        edition_id: entrada.edition_id,
        task_id: entrada.task_id,
        description: entrada.description,
        start_at: entrada.start_at,
        end_at: entrada.end_at!,
        billable: entrada.billable,
      })
      setOcupado(false)
      if (err) {
        setError(mensajeError(err))
        return
      }
      avisar("Propuesta enviada. Hasta que la acepte no se le apunta nada.")
    } else {
      // Pendiente: se retira sin dejar rastro
      const { error: err } = await supabase
        .from("entry_invitations")
        .delete()
        .eq("origin_entry_id", entrada.id)
        .eq("to_user", id)
        .eq("status", "pendiente")
      setOcupado(false)
      if (err) {
        setError(mensajeError(err))
        return
      }
      avisar("Propuesta retirada.")
    }

    await cargar()
    router.refresh()
  }

  async function todoElEquipo() {
    const faltan = proponibles.filter((m) => estadoDe(m.id) === null)
    if (faltan.length === 0) return

    setOcupado(true)
    setError(null)
    const { error: err } = await createClient()
      .from("entry_invitations")
      .insert(
        faltan.map((m) => ({
          workspace_id: entrada.workspace_id,
          origin_entry_id: entrada.id,
          from_user: perfil.id,
          to_user: m.id,
          project_id: entrada.project_id,
          edition_id: entrada.edition_id,
          task_id: entrada.task_id,
          description: entrada.description,
          start_at: entrada.start_at,
          end_at: entrada.end_at!,
          billable: entrada.billable,
        })),
      )
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }

    avisar(
      faltan.length === 1
        ? "Propuesta enviada."
        : `${faltan.length} propuestas enviadas.`,
    )
    await cargar()
    router.refresh()
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v)
        setError(null)
        if (v) void cargar()
      }}
    >
      <Popover.Trigger
        title={tituloCompartir}
        aria-label={tituloCompartir}
        className={cn(
          "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[0.6875rem] font-medium transition",
          vinoDe
            ? "border-accent-soft bg-accent-soft text-accent hover:brightness-95"
            : compartida.length === 0
              ? "border-transparent text-muted hover:border-line hover:bg-surface-2"
              : pendiente
                ? "border-live-line bg-live-soft text-live hover:brightness-95"
                : "border-line bg-surface-2 text-muted hover:border-line-strong",
        )}
      >
        <Users className="h-3 w-3" aria-hidden />
        {compartida.length > 0 && compartida.length}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="card z-50 w-64 p-1"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {vinoDe && (
            <p className="border-b border-line px-2 pb-2 pt-1.5 text-xs text-ink-soft">
              Este rato lo apuntó <span className="font-medium">{vinoDe}</span> y
              lo aceptaste: es el mismo para los dos.
              <span className="mt-1 block text-muted">
                Si cambias la hora, el proyecto o el texto, deja de serlo y cada
                uno sigue con el suyo.
              </span>
            </p>
          )}

          <p className="rotulo px-2 py-1.5">También cuenta para</p>

          {otros.length === 0 && (
            <p className="px-2 pb-2 text-xs text-muted">
              Cuando haya más gente en el espacio podrás compartir estas horas.
            </p>
          )}

          {propuestas === null && otros.length > 0 && (
            <p className="flex items-center gap-2 px-2 pb-2 text-xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> Mirando…
            </p>
          )}

          {propuestas !== null &&
            otros.map((miembro) => {
              const estado = estadoDe(miembro.id)
              const laPropuso = miembro.id === vinoDeId
              const puesta =
                laPropuso || estado === "pendiente" || estado === "aceptada"
              const cerrada = laPropuso || estado === "aceptada"
              return (
                <button
                  key={miembro.id}
                  type="button"
                  disabled={ocupado || cerrada}
                  onClick={() => void alternar(miembro.id)}
                  title={
                    estado === "aceptada" && !laPropuso
                      ? "Ya la aceptó: esas horas son suyas y las borra él"
                      : undefined
                  }
                  className="flex w-full items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-left text-sm transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                      puesta ? "border-ink bg-ink" : "border-line-strong",
                    )}
                  >
                    {puesta && (
                      <Check className="h-3 w-3 text-[color:var(--accent-fg)]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {miembro.full_name}
                  </span>
                  {laPropuso ? (
                    <span className="shrink-0 text-[0.6875rem] text-muted">
                      te la propuso
                    </span>
                  ) : estado === "pendiente" ? (
                    <span className="shrink-0 text-[0.6875rem] text-live">
                      sin contestar
                    </span>
                  ) : estado === "aceptada" ? (
                    <span className="shrink-0 text-[0.6875rem] text-billable">
                      aceptada
                    </span>
                  ) : null}
                </button>
              )
            })}

          {/* Con una sola persona a quien proponer, su fila ya hace lo mismo */}
          {propuestas !== null && proponibles.length > 1 && (
            <>
              <div className="my-1 h-px bg-line" />
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void todoElEquipo()}
                className="w-full rounded-[var(--radio-sm)] px-2 py-1.5 text-left text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50"
              >
                Proponérselo a todo el equipo
              </button>
            </>
          )}

          {error && <p className="px-2 py-1.5 text-xs text-danger">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
