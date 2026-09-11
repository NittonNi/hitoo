"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatDurationShort } from "@/lib/time"
import type { Grupo } from "@/lib/informes"
import { CajaTooltip } from "@/components/caja-tooltip"

/** Con que dato se ha cruzado la pagina entera: un clic en cualquier grafica. */
type Foco = { tipo: "area" | "proyecto" | "persona"; clave: string; etiqueta: string }

/**
 * Las barras de "Quién lo pone", por persona, aparte para poder cargarlas con
 * next/dynamic (ssr:false) - ver panel-estadisticas.tsx.
 */
export function GraficoPersonasEstadisticas({
  porPersona,
  foco,
  onAlternarFoco,
  desglosePersona,
}: {
  porPersona: Grupo[]
  foco: Foco | null
  onAlternarFoco: (foco: Foco) => void
  desglosePersona: Map<string, Grupo[]>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={porPersona.map((g) => ({
          clave: g.clave,
          nombre: g.etiqueta,
          horas: Math.round((g.segundos / 3600) * 100) / 100,
          cobrables: Math.round((g.facturables / 3600) * 100) / 100,
        }))}
        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="var(--line)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="nombre"
          width={110}
          tick={{ fontSize: 12, fill: "var(--ink)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const fila = payload[0].payload as {
              clave: string
              nombre: string
              horas: number
              cobrables: number
            }
            const g = porPersona.find((p) => p.clave === fila.clave)
            if (!g) return null
            return (
              <CajaTooltip
                titulo={`${g.etiqueta} · ${formatDurationShort(g.segundos)}`}
                lineas={[
                  {
                    texto: `Se cobran: ${formatDurationShort(g.facturables)}`,
                    tono: "billable",
                  },
                ]}
                proyectos={desglosePersona.get(g.clave)}
              />
            )
          }}
        />
        <Bar
          dataKey="horas"
          fill="var(--accent)"
          radius={[0, 3, 3, 0]}
          cursor="pointer"
          onClick={(_, i) => {
            const g = porPersona[i]
            if (g) onAlternarFoco({ tipo: "persona", clave: g.clave, etiqueta: g.etiqueta })
          }}
        >
          {porPersona.map((g) => (
            <Cell
              key={g.clave}
              fill="var(--accent)"
              opacity={
                foco && foco.tipo === "persona" && foco.clave !== g.clave ? 0.35 : 1
              }
            />
          ))}
        </Bar>
        <Bar
          dataKey="cobrables"
          fill="var(--billable-fill)"
          radius={[0, 3, 3, 0]}
          cursor="pointer"
          onClick={(_, i) => {
            const g = porPersona[i]
            if (g) onAlternarFoco({ tipo: "persona", clave: g.clave, etiqueta: g.etiqueta })
          }}
        >
          {porPersona.map((g) => (
            <Cell
              key={g.clave}
              fill="var(--billable-fill)"
              opacity={
                foco && foco.tipo === "persona" && foco.clave !== g.clave ? 0.35 : 1
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
