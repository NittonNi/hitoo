import { NextResponse } from "next/server"

import { actualizarEspacio, CUPO_PEQUENO, servicio } from "@/lib/holded-servidor"

/**
 * La vuelta diaria de Holded, la llama el cron de Vercel (`vercel.json`).
 *
 * Es pública para el proxy -Vercel llega sin sesión- y por eso exige la
 * cabecera `Authorization: Bearer <CRON_SECRET>`, que Vercel pone sola.
 * Sin el secreto configurado no hace nada.
 *
 * Los espacios con un cupo pequeño de Holded solo se actualizan los lunes:
 * con unas decenas de cierres enlazados, una vuelta al día no les cabe.
 */
export const maxDuration = 300

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: conexiones, error } = await servicio()
    .from("holded_connections")
    .select("workspace_id, usage_limit")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const esLunes = new Date().getUTCDay() === 1
  const resumen: { espacio: string; resultado: string }[] = []

  for (const c of conexiones ?? []) {
    if (c.usage_limit !== null && c.usage_limit < CUPO_PEQUENO && !esLunes) {
      resumen.push({ espacio: c.workspace_id, resultado: "cupo pequeño: solo los lunes" })
      continue
    }
    const r = await actualizarEspacio(c.workspace_id, { sinCerradas: true })
    resumen.push({
      espacio: c.workspace_id,
      resultado: r.ok ? `${r.actualizados} cierres` : r.error,
    })
  }

  return NextResponse.json({ espacios: resumen.length, resumen })
}
