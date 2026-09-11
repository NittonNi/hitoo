"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { formatDurationShort } from "@/lib/time"
import type { Grupo } from "@/lib/informes"
import { CajaTooltip } from "@/components/caja-tooltip"

/** Con que dato se ha cruzado la pagina entera: un clic en cualquier grafica. */
type Foco = { tipo: "area" | "proyecto" | "persona"; clave: string; etiqueta: string }

/**
 * El donut de "En qué se va", por área, aparte para poder cargarlo con
 * next/dynamic (ssr:false) - ver panel-estadisticas.tsx. La leyenda de debajo
 * no es de recharts y se queda en el fichero principal.
 */
export function GraficoAreaEstadisticas({
  porArea,
  coloresArea,
  paleta,
  foco,
  onAlternarFoco,
  desgloseArea,
}: {
  porArea: Grupo[]
  coloresArea: Map<string, string>
  paleta: string[]
  foco: Foco | null
  onAlternarFoco: (foco: Foco) => void
  desgloseArea: Map<string, { proyectos: Grupo[]; personas: Grupo[] }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={porArea.map((g) => ({
            nombre: g.etiqueta,
            horas: Math.round((g.segundos / 3600) * 100) / 100,
          }))}
          dataKey="horas"
          nameKey="nombre"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {porArea.map((g) => (
            <Cell
              key={g.clave}
              fill={coloresArea.get(g.clave) ?? paleta[0]}
              onClick={() =>
                onAlternarFoco({ tipo: "area", clave: g.clave, etiqueta: g.etiqueta })
              }
              cursor="pointer"
              opacity={
                foco && foco.tipo === "area" && foco.clave !== g.clave ? 0.35 : 1
              }
            />
          ))}
        </Pie>
        {/* offset alto: que no se pegue al donut y tape la porcion de al
            lado, que es justo lo que impedia seguir clicando */}
        <Tooltip
          offset={28}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const nombre = payload[0].name as string
            const grupo = porArea.find((g) => g.etiqueta === nombre)
            if (!grupo) return null
            const desglose = desgloseArea.get(grupo.clave)
            return (
              <CajaTooltip
                titulo={`${grupo.etiqueta} · ${formatDurationShort(grupo.segundos)}`}
                proyectos={desglose?.proyectos}
                personas={desglose?.personas}
              />
            )
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
