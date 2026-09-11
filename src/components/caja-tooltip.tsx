"use client"

import { formatDurationShort } from "@/lib/time"
import type { Grupo } from "@/lib/informes"
import { cn } from "@/lib/utils"

const CAJA = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radio-sm)",
  fontSize: 12,
  color: "var(--ink)",
} as const

/**
 * El hover de todas las gráficas de estadísticas: un título, alguna cifra
 * suelta si hace falta, y el desglose por proyecto y por persona de lo que
 * hay detrás del dato -no solo el número, que es la queja que tenía Nicolas
 * del donut-.
 *
 * Vive en su propio fichero, sin depender de recharts: los gráficos que se
 * cargan con next/dynamic la importan desde aquí, y panel-estadisticas.tsx
 * también la usa en el mapa de calor, que no es una gráfica de recharts.
 */
export function CajaTooltip({
  titulo,
  lineas,
  proyectos,
  personas,
}: {
  titulo: string
  lineas?: { texto: string; tono?: "billable" }[]
  proyectos?: Grupo[]
  personas?: Grupo[]
}) {
  return (
    <div style={CAJA} className="pointer-events-none max-w-60 p-2.5">
      <p className="text-sm font-medium">{titulo}</p>
      {lineas?.map((l, i) => (
        <p
          key={i}
          className={cn("mt-0.5 text-xs", l.tono === "billable" ? "text-billable" : "text-muted")}
        >
          {l.texto}
        </p>
      ))}
      {proyectos && proyectos.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-xs">
          {proyectos.slice(0, 4).map((p) => (
            <div key={p.clave} className="flex justify-between gap-3">
              <span className="truncate">{p.etiqueta}</span>
              <span className="tabular shrink-0 text-muted">
                {formatDurationShort(p.segundos)}
              </span>
            </div>
          ))}
        </div>
      )}
      {personas && personas.length > 0 && (
        <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-muted">
          {personas
            .map((p) => `${p.etiqueta} ${formatDurationShort(p.segundos)}`)
            .join(" · ")}
        </p>
      )}
    </div>
  )
}
