"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { Grupo } from "@/lib/informes"
import { CajaTooltip } from "@/components/caja-tooltip"

/** Con que dato se ha cruzado la pagina entera: un clic en cualquier grafica. */
type Foco = { tipo: "area" | "proyecto" | "persona"; clave: string; etiqueta: string }

type FilaPorHora = { clave: string; nombre: string; color: string; porHora: number }

/**
 * La gráfica de "A cuánto sale la hora", por proyecto, aparte para poder
 * cargarla con next/dynamic (ssr:false) - ver panel-estadisticas.tsx.
 */
export function GraficoPorHoraEstadisticas({
  porHoraProyectos,
  objetivoHora,
  foco,
  onAlternarFoco,
  desgloseProyectoDinero,
}: {
  porHoraProyectos: FilaPorHora[]
  objetivoHora: number | null
  foco: Foco | null
  onAlternarFoco: (foco: Foco) => void
  desgloseProyectoDinero: Map<string, Grupo[]>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={porHoraProyectos} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="nombre"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          interval={0}
          height={40}
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
            const g = payload[0].payload as FilaPorHora
            return (
              <CajaTooltip
                titulo={`${g.nombre} · ${g.porHora} €/h`}
                personas={desgloseProyectoDinero.get(g.clave)}
              />
            )
          }}
        />
        {objetivoHora ? (
          <ReferenceLine y={objetivoHora} stroke="var(--ink)" strokeDasharray="4 3" />
        ) : null}
        <Bar
          dataKey="porHora"
          radius={[3, 3, 0, 0]}
          maxBarSize={56}
          cursor="pointer"
          onClick={(_, i) => {
            const g = porHoraProyectos[i]
            if (g) onAlternarFoco({ tipo: "proyecto", clave: g.clave, etiqueta: g.nombre })
          }}
        >
          {porHoraProyectos.map((g) => (
            <Cell
              key={g.clave}
              fill={g.color}
              opacity={
                foco && foco.tipo === "proyecto" && foco.clave !== g.clave ? 0.35 : 1
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
