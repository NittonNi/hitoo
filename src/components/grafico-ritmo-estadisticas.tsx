"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatDurationShort } from "@/lib/time"
import type { Punto } from "@/lib/estadisticas"
import type { Grupo } from "@/lib/informes"
import { CajaTooltip } from "@/components/caja-tooltip"

/**
 * La gráfica de "Cómo va el ritmo", aparte para poder cargarla con
 * next/dynamic (ssr:false) - ver panel-estadisticas.tsx.
 */
export function GraficoRitmoEstadisticas({
  puntos,
  comparar,
  desglosePunto,
}: {
  puntos: Punto[]
  comparar: boolean
  desglosePunto: Map<string, { proyectos: Grupo[]; personas: Grupo[] }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={puntos} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const punto = payload[0].payload as Punto
            const desglose = desglosePunto.get(punto.clave)
            return (
              <CajaTooltip
                titulo={`${punto.etiqueta} · ${formatDurationShort(punto.horas * 3600)}`}
                lineas={[
                  {
                    texto: `Se cobran: ${formatDurationShort(punto.cobrables * 3600)}`,
                    tono: "billable",
                  },
                  ...(comparar && punto.antes !== undefined
                    ? [{ texto: `Periodo anterior: ${formatDurationShort(punto.antes * 3600)}` }]
                    : []),
                ]}
                proyectos={desglose?.proyectos}
                personas={desglose?.personas}
              />
            )
          }}
        />
        <Bar
          dataKey="cobrables"
          stackId="h"
          fill="var(--billable-fill)"
          radius={[0, 0, 3, 3]}
          maxBarSize={48}
        />
        <Bar
          dataKey="resto"
          stackId="h"
          fill="var(--accent)"
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
        {comparar && (
          <Line
            type="monotone"
            dataKey="antes"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
