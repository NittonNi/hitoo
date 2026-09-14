"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * Solo el gráfico de barras del resumen del proyecto: se separa de
 * resumen-proyecto.tsx para poder cargarlo con next/dynamic (ssr:false) -
 * recharts pesa varios cientos de KB y hasta ahora viajaba entero en el
 * primer JS de /proyectos/[id] aunque el gráfico tarda en pintarse porque
 * necesita medir su contenedor en el navegador de todas formas.
 */
export function GraficoResumenProyecto({
  filas,
}: {
  filas: { clave: string; etiqueta: string; cobrables: number; resto: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filas} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(n: number) => n.toLocaleString("es-ES")}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radio-sm)",
            fontSize: 12,
            color: "var(--ink)",
          }}
          formatter={(valor, nombre) => [
            `${Number(valor ?? 0).toLocaleString("es-ES", {
              maximumFractionDigits: 2,
            })} h`,
            nombre === "cobrables" ? "Se cobran" : "No se cobran",
          ]}
        />
        <Bar
          dataKey="cobrables"
          stackId="h"
          fill="var(--billable-fill)"
          radius={[0, 0, 3, 3]}
          maxBarSize={56}
        />
        <Bar
          dataKey="resto"
          stackId="h"
          fill="var(--accent)"
          radius={[3, 3, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
