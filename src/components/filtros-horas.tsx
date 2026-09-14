"use client"

import { FiltroMultiple } from "@/components/filtro-multiple"
import { categoriasRaiz } from "@/lib/categorias"
import type { Catalogo, EntradaVista } from "@/lib/tipos"

/** Para poder pedir lo que no tiene nada: «sin proyecto», «sin área». */
export const SIN_NADA = "__sin__"

export type Filtros = {
  areas: string[]
  proyectos: string[]
  etiquetas: string[]
}

export const SIN_FILTROS: Filtros = { areas: [], proyectos: [], etiquetas: [] }

export function hayFiltros(filtros: Filtros) {
  return (
    filtros.areas.length > 0 ||
    filtros.proyectos.length > 0 ||
    filtros.etiquetas.length > 0
  )
}

/**
 * Deja solo las horas que encajan.
 *
 * Nada marcado es «todas»: los filtros solo quitan. Con varias cosas marcadas
 * dentro de un mismo filtro vale con encajar en cualquiera de ellas, que es
 * como se buscan las cosas -«enséñame TLT y Eventos»- y no como se cruzan.
 */
export function filtrarHoras(entradas: EntradaVista[], filtros: Filtros) {
  if (!hayFiltros(filtros)) return entradas
  return entradas.filter((entrada) => {
    if (
      filtros.areas.length > 0 &&
      !filtros.areas.includes(entrada.category_id ?? SIN_NADA)
    ) {
      return false
    }
    if (
      filtros.proyectos.length > 0 &&
      !filtros.proyectos.includes(entrada.project_id ?? SIN_NADA)
    ) {
      return false
    }
    if (
      filtros.etiquetas.length > 0 &&
      !filtros.etiquetas.some((t) =>
        t === SIN_NADA ? entrada.tags.length === 0 : entrada.tags.includes(t),
      )
    ) {
      return false
    }
    return true
  })
}

/**
 * Los proyectos para un filtro: primero los vivos y detrás los archivados,
 * marcados. Sin los archivados, «marcar todos» dejaba fuera sus horas.
 */
export function opcionesDeProyectos(catalogo: Pick<Catalogo, "proyectos">) {
  return [...catalogo.proyectos]
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, nombre: p.name, detalle: p.archived ? "archivado" : undefined }))
}

/**
 * Los mismos mandos en el calendario y en la hoja de la semana: por área, por
 * proyecto y por etiqueta, de varios en varios.
 */
export function FiltrosDeHoras({
  catalogo,
  valor,
  onChange,
}: {
  catalogo: Catalogo
  valor: Filtros
  onChange: (filtros: Filtros) => void
}) {
  const areas = categoriasRaiz(catalogo.categorias)

  return (
    <>
      {areas.length > 0 && (
        <FiltroMultiple
          etiqueta="Áreas"
          todos="Todas las áreas"
          opciones={[
            ...areas.map((c) => ({ id: c.id, nombre: c.name })),
            { id: SIN_NADA, nombre: "Sin área" },
          ]}
          elegidas={valor.areas}
          onChange={(areas) => onChange({ ...valor, areas })}
        />
      )}

      <FiltroMultiple
        etiqueta="Proyectos"
        todos="Todos los proyectos"
        opciones={[
          ...opcionesDeProyectos(catalogo),
          { id: SIN_NADA, nombre: "Sin proyecto" },
        ]}
        elegidas={valor.proyectos}
        onChange={(proyectos) => onChange({ ...valor, proyectos })}
      />

      {catalogo.etiquetas.length > 0 && (
        <FiltroMultiple
          etiqueta="Etiquetas"
          todos="Todas las etiquetas"
          opciones={[
            ...catalogo.etiquetas.map((t) => ({ id: t.name, nombre: t.name })),
            { id: SIN_NADA, nombre: "Sin etiqueta" },
          ]}
          elegidas={valor.etiquetas}
          onChange={(etiquetas) => onChange({ ...valor, etiquetas })}
        />
      )}
    </>
  )
}
