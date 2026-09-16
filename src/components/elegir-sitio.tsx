"use client"

import { useMemo, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Plus, Search } from "lucide-react"

import type { ProyectoEditor, SitioEditor } from "@/lib/editor-holded"
import { cn } from "@/lib/utils"

export type Eleccion =
  | { tipo: "sitio"; sitio: SitioEditor; proyecto: ProyectoEditor }
  | { tipo: "nueva"; proyecto: ProyectoEditor }

function normal(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/**
 * Elegir un sitio de la lista, buscando por nombre. Es la forma de enlazar y
 * de meter sin arrastrar: la única en el móvil, y la de quien va con teclado.
 *
 * - `vale` dice qué sitios se pueden elegir.
 * - `nuevaEn`, si se pasa, añade «Edición nueva» en los proyectos que la acepten.
 */
export function ElegirSitio({
  proyectos,
  vale,
  nuevaEn,
  titulo,
  onElegir,
  children,
  className,
}: {
  proyectos: ProyectoEditor[]
  vale: (sitio: SitioEditor, proyecto: ProyectoEditor) => boolean
  nuevaEn?: (proyecto: ProyectoEditor) => boolean
  titulo: string
  onElegir: (eleccion: Eleccion) => void
  children: React.ReactNode
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  const grupos = useMemo(() => {
    const q = normal(busqueda)
    return proyectos
      .map((p) => {
        const coincideProyecto = !q || normal(p.nombre).includes(q)
        const sitios = p.sitios.filter(
          (s) => vale(s, p) && (coincideProyecto || normal(s.nombre).includes(q)),
        )
        const nueva = Boolean(nuevaEn?.(p)) && coincideProyecto
        return { p, sitios, nueva }
      })
      .filter((g) => g.sitios.length > 0 || g.nueva)
      .slice(0, 40)
  }, [busqueda, proyectos, vale, nuevaEn])

  function elegir(eleccion: Eleccion) {
    setAbierto(false)
    setBusqueda("")
    onElegir(eleccion)
  }

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger className={cn("btn h-8 text-xs", className)}>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="card z-50 flex max-h-[min(26rem,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-24px))] flex-col p-2"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <p className="px-1 pb-1.5 text-xs font-medium text-muted">{titulo}</p>
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
              placeholder="Buscar proyecto o edición"
              aria-label="Buscar proyecto o edición"
            />
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {grupos.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted">Nada se llama así.</p>
            ) : (
              grupos.map(({ p, sitios, nueva }) => (
                <div key={p.id} className="py-1">
                  <p className="truncate px-1 text-xs font-semibold text-ink-soft">{p.nombre}</p>
                  {sitios.map((s) => (
                    <button
                      key={s.clave}
                      type="button"
                      onClick={() => elegir({ tipo: "sitio", sitio: s, proyecto: p })}
                      className="flex w-full items-center rounded-[var(--radio-sm)] px-2 py-1.5 text-left text-sm transition hover:bg-surface-2"
                    >
                      <span className="truncate">{s.nombre}</span>
                    </button>
                  ))}
                  {nueva && (
                    <button
                      type="button"
                      onClick={() => elegir({ tipo: "nueva", proyecto: p })}
                      className="flex w-full items-center gap-1.5 rounded-[var(--radio-sm)] px-2 py-1.5 text-left text-sm text-accent transition hover:bg-surface-2"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Edición nueva
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
