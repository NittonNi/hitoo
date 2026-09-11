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

import { formatDateShort, fromDateKey } from "@/lib/time"

/**
 * Solo el gráfico de "Horas por día" del informe: se separa de
 * panel-informes.tsx para poder cargarlo con next/dynamic (ssr:false) - ver
 * el mismo patrón en grafico-resumen-proyecto.tsx.
 */
export function GraficoInformes({
  serie,
}: {
  serie: { dia: string; horas: number; facturables: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={serie} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dia"
          tickFormatter={(dia: string) =>
            fromDateKey(dia).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
            })
          }
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
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
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
            color: "var(--text)",
          }}
          labelFormatter={(dia) => formatDateShort(String(dia))}
          formatter={(valor, nombre) => [
            `${Number(valor ?? 0).toLocaleString("es-ES")} h`,
            nombre === "facturables" ? "Facturables" : "Horas",
          ]}
        />
        <Bar dataKey="horas" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="facturables" fill="var(--billable)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
