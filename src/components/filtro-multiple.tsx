"use client"

import { useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown, Minus, Search } from "lucide-react"

import { cn, paraBuscar } from "@/lib/utils"

/** A partir de cuántas opciones sale el buscador: con 124 proyectos no se busca a ojo. */
const CON_BUSCADOR = 10

export type OpcionFiltro = {
  id: string
  nombre: string
  /** Una aclaración corta a la derecha: «archivado», «plaza sin coger». */
  detalle?: string
}

/**
 * Un filtro de varios a la vez: sin nada marcado no filtra -"Todas las
 * areas"- y marcando dos o tres se quedan esas. Es el mismo menu con
 * casillas que las etiquetas y las personas, para que se use igual en toda
 * la app.
 *
 * Arriba va marcar todos, que es como se hace "todos menos este": son quince
 * clics de diferencia cuando la lista es larga. Para que marcar todos sea de
 * verdad lo mismo que no filtrar, las opciones tienen que cubrir cada hora
 * posible: también «sin proyecto», «sin etiqueta» y lo archivado.
 */
export function FiltroMultiple({
  etiqueta,
  todos,
  opciones,
  elegidas,
  onChange,
}: {
  etiqueta: string
  /** Lo que pone cuando no hay nada marcado. */
  todos: string
  opciones: OpcionFiltro[]
  elegidas: string[]
  onChange: (ids: string[]) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const puestas = opciones.filter((o) => elegidas.includes(o.id))
  const todasPuestas = opciones.length > 0 && puestas.length === opciones.length

  const texto = paraBuscar(busqueda)
  const vistas = texto
    ? opciones.filter((o) => paraBuscar(o.nombre).includes(texto))
    : opciones
  const buscando = texto.length > 0
  const vistasPuestas = vistas.filter((o) => elegidas.includes(o.id))

  /* Buscando, «marcar todos» marca lo encontrado, sin quitar lo que ya había:
     «TECH» y marcar todos deja los cinco TECH SKILLS. */
  function marcarVistas() {
    if (!buscando) {
      onChange(todasPuestas ? [] : opciones.map((o) => o.id))
      return
    }
    const ids = vistas.map((o) => o.id)
    onChange(
      vistasPuestas.length === vistas.length
        ? elegidas.filter((id) => !ids.includes(id))
        : [...new Set([...elegidas, ...ids])],
    )
  }

  const todasVistasPuestas = vistas.length > 0 && vistasPuestas.length === vistas.length

  return (
    <DropdownMenu.Root onOpenChange={(abierto) => !abierto && setBusqueda("")}>
      <DropdownMenu.Trigger
        aria-label={etiqueta}
        className={cn(
          "flex h-[2.125rem] shrink-0 items-center gap-1.5 rounded-[3px] border px-2.5 text-sm transition",
          puestas.length > 0
            ? "border-accent bg-accent-soft text-accent"
            : "border-line-strong bg-surface hover:bg-surface-2",
        )}
      >
        <span className="max-w-[11rem] truncate">
          {puestas.length === 0
            ? todos
            : puestas.length === 1
              ? puestas[0].nombre
              : `${etiqueta}: ${puestas.length}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 flex max-h-80 w-64 flex-col overflow-hidden rounded-[var(--radio)] border border-line bg-surface"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {opciones.length > CON_BUSCADOR && (
            <div className="relative border-b border-line p-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                // Las letras son para el buscador, no para saltar entre opciones
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown" && e.key !== "Escape") e.stopPropagation()
                }}
                placeholder={`Buscar en ${etiqueta.toLowerCase()}`}
                aria-label={`Buscar en ${etiqueta.toLowerCase()}`}
                className="field h-8 w-full pl-7 text-sm"
                autoFocus
              />
            </div>
          )}

          <div className="scroll-thin overflow-y-auto p-1">
            {/* Marcar todos y quitar uno es mas rapido que marcar quince. Con
                todos marcados se filtra igual que sin nada, pero se puede ir
                quitando desde ahi. */}
            {vistas.length > 0 && (
              <DropdownMenu.CheckboxItem
                checked={
                  (buscando ? vistasPuestas.length : elegidas.length) === 0
                    ? false
                    : (buscando ? todasVistasPuestas : todasPuestas)
                      ? true
                      : "indeterminate"
                }
                onCheckedChange={marcarVistas}
                onSelect={(e) => e.preventDefault()}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm font-medium outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
              >
                <Casilla
                  estado={
                    (buscando ? todasVistasPuestas : todasPuestas)
                      ? "si"
                      : (buscando ? vistasPuestas.length : elegidas.length) > 0
                        ? "algunas"
                        : "no"
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  {buscando
                    ? todasVistasPuestas
                      ? `Quitar las ${vistas.length} encontradas`
                      : `Marcar las ${vistas.length} encontradas`
                    : todasPuestas
                      ? "Quitar la selección"
                      : "Marcar todos"}
                </span>
                {elegidas.length > 0 && !buscando && (
                  <span className="cifra shrink-0 text-xs font-normal text-muted">
                    {puestas.length}/{opciones.length}
                  </span>
                )}
              </DropdownMenu.CheckboxItem>
            )}

            {vistas.length > 0 ? (
              <div className="my-1 h-px bg-line" />
            ) : (
              <p className="px-2 py-2 text-sm text-muted">Nada con «{busqueda.trim()}»</p>
            )}

            {vistas.map((opcion) => {
              const puesta = elegidas.includes(opcion.id)
              return (
                <DropdownMenu.CheckboxItem
                  key={opcion.id}
                  checked={puesta}
                  onCheckedChange={() =>
                    onChange(
                      puesta
                        ? elegidas.filter((id) => id !== opcion.id)
                        : [...elegidas, opcion.id],
                    )
                  }
                  onSelect={(e) => e.preventDefault()}
                  className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
                >
                  <Casilla estado={puesta ? "si" : "no"} />
                  <span className="min-w-0 flex-1 truncate">{opcion.nombre}</span>
                  {opcion.detalle && (
                    <span className="shrink-0 text-xs text-muted">{opcion.detalle}</span>
                  )}
                </DropdownMenu.CheckboxItem>
              )
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Casilla({ estado }: { estado: "si" | "no" | "algunas" }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
        estado !== "no" ? "border-ink bg-ink" : "border-line-strong",
      )}
    >
      {estado === "si" && <Check className="h-3 w-3 text-[color:var(--accent-fg)]" />}
      {estado === "algunas" && <Minus className="h-3 w-3 text-[color:var(--accent-fg)]" />}
    </span>
  )
}
