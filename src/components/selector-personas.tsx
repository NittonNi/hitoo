"use client"

import { Check, Users } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

import type { Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * Alguien que ya cuenta para este rato y aquí no se le puede quitar -por
 * ejemplo quien te lo propuso: sale marcado y quieto, arriba del resto, y
 * cuenta en el texto del botón aunque no esté en `miembros`.
 */
export type PersonaFija = {
  id: string
  nombre: string
  /** Texto corto al lado, tipo "te la propuso". */
  motivo?: string
}

/**
 * A quien más le cuentan estas horas. No se las apunta directamente: a cada uno
 * le llega una propuesta que tiene que aceptar.
 */
export function SelectorPersonas({
  miembros: todos,
  seleccionadas,
  fijas = [],
  onChange,
}: {
  miembros: Miembro[]
  seleccionadas: string[]
  fijas?: PersonaFija[]
  onChange: (ids: string[]) => void
}) {
  // Una plaza sin cuenta no puede entrar a aceptar la propuesta
  const miembros = todos.filter((m) => !m.sin_cuenta)

  if (miembros.length === 0 && fijas.length === 0) {
    return (
      <p className="text-xs text-muted">
        Cuando haya más gente en el espacio podrás compartir estas horas con
        ellos.
      </p>
    )
  }

  const elegidas = miembros.filter((m) => seleccionadas.includes(m.id))
  const total = fijas.length + elegidas.length
  const todas = elegidas.length === miembros.length && miembros.length > 0

  function alternar(id: string) {
    onChange(
      seleccionadas.includes(id)
        ? seleccionadas.filter((x) => x !== id)
        : [...seleccionadas, id],
    )
  }

  const texto =
    total === 0
      ? "Solo para mí"
      : todas
        ? "Todo el equipo"
        : total === 1
          ? (fijas[0]?.nombre ?? elegidas[0].full_name)
          : `${total} personas más`

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-[var(--radio-sm)] border px-3 text-left text-sm transition",
          total > 0
            ? "border-ink bg-surface-2"
            : "border-line-strong bg-surface text-muted hover:bg-surface-2",
        )}
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="truncate">{texto}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[60] max-h-64 w-64 overflow-y-auto rounded-[var(--radio)] border border-line bg-surface p-1"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <p className="rotulo px-2 py-1.5">Compartir con</p>

          {/* Fijas: ya cuentan, marcadas y sin poder quitarlas de aquí. */}
          {fijas.map((fija) => (
            <div
              key={fija.id}
              className="flex items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm opacity-60"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-ink bg-ink">
                <Check className="h-3 w-3 text-[color:var(--accent-fg)]" />
              </span>
              <span className="min-w-0 flex-1 truncate">{fija.nombre}</span>
              {fija.motivo && (
                <span className="shrink-0 text-[0.6875rem] text-muted">{fija.motivo}</span>
              )}
            </div>
          ))}

          {miembros.length > 0 && (
            <>
              {fijas.length > 0 && <div className="my-1 h-px bg-line" />}

              {/* Una reunion es de todos: pedirlo persona a persona es un peaje */}
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault()
                  onChange(todas ? [] : miembros.map((m) => m.id))
                }}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm font-medium outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                    todas ? "border-ink bg-ink" : "border-line-strong",
                  )}
                >
                  {todas && <Check className="h-3 w-3 text-[color:var(--accent-fg)]" />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {todas ? "Quitar a todos" : "Todo el equipo"}
                </span>
                <span className="text-xs text-muted">{miembros.length}</span>
              </DropdownMenu.Item>

              <div className="my-1 h-px bg-line" />
              {miembros.map((miembro) => {
                const puesta = seleccionadas.includes(miembro.id)
                return (
                  <DropdownMenu.CheckboxItem
                    key={miembro.id}
                    checked={puesta}
                    onCheckedChange={() => alternar(miembro.id)}
                    onSelect={(e) => e.preventDefault()}
                    className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
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
                    <span className="min-w-0 flex-1 truncate">{miembro.full_name}</span>
                  </DropdownMenu.CheckboxItem>
                )
              })}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
