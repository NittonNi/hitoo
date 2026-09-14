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

import { formatDateShort, formatDurationShort, fromDateKey } from "@/lib/time"

/**
 * Solo el gráfico de "Horas por día" del informe: se separa de
 * panel-informes.tsx para poder cargarlo con next/dynamic (ssr:false) - ver
 * el mismo patrón en grafico-resumen-proyecto.tsx.
 */
export function GraficoInformes({
  serie,
  unidad,
}: {
  /** `dia` es el primer día de cada barra: un día, una semana o un mes. */
  serie: { dia: string; horas: number; facturables: number }[]
  unidad: "dia" | "semana" | "mes"
}) {
  const etiquetaEje = (dia: string) =>
    fromDateKey(dia).toLocaleDateString(
      "es-ES",
      unidad === "mes" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" },
    )
  const etiquetaCaja = (dia: string) =>
    unidad === "dia"
      ? formatDateShort(dia)
      : unidad === "semana"
        ? `Semana del ${formatDateShort(dia)}`
        : fromDateKey(dia).toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={serie} margin={{ top: 4, right: 8, bottom: 4, left: -4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dia"
          tickFormatter={etiquetaEje}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={16}
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
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            fontSize: "0.8rem",
            color: "var(--text)",
          }}
          labelFormatter={(dia) => etiquetaCaja(String(dia))}
          formatter={(valor, nombre) => [
            formatDurationShort(Math.round(Number(valor ?? 0) * 3600)),
            nombre === "facturables" ? "Facturables" : "Horas",
          ]}
        />
        <Bar dataKey="horas" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="facturables" fill="var(--billable)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
