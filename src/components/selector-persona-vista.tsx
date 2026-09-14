"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import type { Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * De quién son las horas que se miran en el cronómetro y el calendario. Solo lo
 * tiene quien ve las de todo el equipo; mirar las de otro es solo mirar. Las
 * plazas que aún no ha cogido nadie salen también: sus horas ya están dentro.
 */
export function SelectorPersonaVista({
  yoId,
  personaId,
  miembros,
  className,
}: {
  yoId: string
  personaId: string
  miembros: Miembro[]
  className?: string
}) {
  const router = useRouter()
  const ruta = usePathname()
  const parametros = useSearchParams()
  const [cargando, empezar] = useTransition()

  const otros = miembros
    .filter((m) => m.id !== yoId && m.role !== "coach")
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  function elegir(id: string) {
    const siguientes = new URLSearchParams(parametros.toString())
    if (id === yoId) siguientes.delete("persona")
    else siguientes.set("persona", id)
    // Lo cargado de más es de la persona anterior
    siguientes.delete("desde")
    const consulta = siguientes.toString()
    empezar(() => router.push(consulta ? `${ruta}?${consulta}` : ruta, { scroll: false }))
  }

  return (
    <label className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="shrink-0 text-sm text-muted">Horas de</span>
      <select
        value={personaId}
        onChange={(e) => elegir(e.target.value)}
        className="field h-8 w-auto min-w-0 max-w-[16rem] py-0 text-sm"
        aria-label="De quién son las horas"
      >
        <option value={yoId}>Tú</option>
        {otros.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
            {m.sin_cuenta ? " · plaza" : !m.active ? " · desactivado" : ""}
          </option>
        ))}
      </select>
      {cargando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-label="Cargando" />}
    </label>
  )
}
