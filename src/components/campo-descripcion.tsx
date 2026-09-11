"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Euro, TagIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useSesion } from "@/components/proveedor-sesion"
import {
  cargarHorasPasadas,
  filtrarSugerencias,
  sugerenciasDe,
  type HoraPasada,
  type Sugerencia,
} from "@/lib/sugerencias"
import type { BorradorEntrada, Catalogo } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * El «¿En qué estás trabajando?» de la barra del cronómetro, con lo que ya
 * usaste debajo, como en Clockify. Elegir una sugerencia copia a la barra su
 * descripción, su proyecto con edición y tarea, sus etiquetas y si era
 * facturable.
 *
 * Con el campo vacío no sale nada al entrar: ahí también se toca para
 * corregir lo que está corriendo, y en el móvil la lista taparía los
 * selectores justo cuando se abre el teclado. Repetir algo reciente ya lo
 * hace Continuar, en la lista de abajo. Quien la quiera igual, la abre con la
 * flecha abajo.
 *
 * Es un combobox de ARIA: el foco no sale nunca del campo y la opción marcada
 * se anuncia con `aria-activedescendant`.
 */

/** Lo que mide la barra de flechas de encima del teclado (`barra-teclado.tsx`). */
const ALTO_BARRA_TECLADO = 52
/** El `mt-2` que separa la lista del campo, más un poco de aire por abajo. */
const MARGEN = 16
/** Con menos de dos filas la lista no se deja usar: mejor cortada que perdida. */
const ALTO_MINIMO = 112

/**
 * Cuánto sitio queda debajo del campo sin que lo tape el teclado. Solo
 * `visualViewport` sabe dónde empieza el teclado en iOS y en Android a la
 * vez, y encima va además la barra de flechas mientras se escribe.
 */
function sitioDebajo(campo: HTMLElement): number {
  const vv = window.visualViewport
  let suelo = vv ? vv.offsetTop + vv.height : window.innerHeight
  if (document.documentElement.dataset.teclado === "si") suelo -= ALTO_BARRA_TECLADO
  const caja = campo.getBoundingClientRect()
  return Math.max(ALTO_MINIMO, Math.floor(suelo - caja.bottom - MARGEN))
}

export function CampoDescripcion({
  catalogo,
  valor,
  actual,
  onChange,
  alSalir,
  alPulsarEnter,
  alElegir,
}: {
  catalogo: Catalogo
  valor: string
  /** Lo que ya lleva la barra: la sugerencia que coincide en todo no se ofrece. */
  actual: BorradorEntrada
  onChange: (texto: string) => void
  /** Se sale del campo sin haber elegido nada. */
  alSalir: () => void
  /** Enter sin ninguna sugerencia marcada: lo de siempre. */
  alPulsarEnter: () => void
  alElegir: (borrador: BorradorEntrada) => void
}) {
  const { perfil, espacio } = useSesion()
  const idLista = useId()
  const campoRef = useRef<HTMLInputElement>(null)
  const cargando = useRef(false)

  const [horas, setHoras] = useState<HoraPasada[] | null>(null)
  const [abierta, setAbierta] = useState(false)
  /* Por clave y no por posición: si llegan horas nuevas con la lista abierta,
     la marca no salta a otra sugerencia. */
  const [marcada, setMarcada] = useState<string | null>(null)
  const [altoMaximo, setAltoMaximo] = useState<number>()

  const sugerencias = useMemo(
    () => (horas ? sugerenciasDe(horas, catalogo) : []),
    [horas, catalogo],
  )
  const visibles = filtrarSugerencias(sugerencias, valor, actual)
  const mostrar = abierta && visibles.length > 0
  const indice = visibles.findIndex((s) => s.clave === marcada)
  const idOpcion = (i: number) => `${idLista}-${i}`

  /* Con la lista abierta, el teclado del móvil puede abrirse, cerrarse o
     mover la página: el sitio de debajo se vuelve a medir cada vez. */
  useEffect(() => {
    if (!mostrar) return
    const medir = () => {
      if (campoRef.current) setAltoMaximo(sitioDebajo(campoRef.current))
    }
    const vv = window.visualViewport
    vv?.addEventListener("resize", medir)
    vv?.addEventListener("scroll", medir)
    window.addEventListener("resize", medir)
    window.addEventListener("scroll", medir, true)
    return () => {
      vv?.removeEventListener("resize", medir)
      vv?.removeEventListener("scroll", medir)
      window.removeEventListener("resize", medir)
      window.removeEventListener("scroll", medir, true)
    }
  }, [mostrar])

  /* Cada vez que se entra en el campo, por si has apuntado algo desde la
     última: es una sola consulta, pequeña, y mientras llega se sigue
     sugiriendo lo de antes. */
  async function cargar() {
    if (cargando.current) return
    cargando.current = true
    try {
      setHoras(
        await cargarHorasPasadas(createClient(), {
          usuarioId: perfil.id,
          espacioId: espacio.id,
        }),
      )
    } catch {
      /* Sin sugerencias se escribe igual: no merece un aviso. Se vuelve a
         probar la próxima vez que se entre en el campo. */
    } finally {
      cargando.current = false
    }
  }

  function abrir() {
    setAbierta(true)
    if (campoRef.current) setAltoMaximo(sitioDebajo(campoRef.current))
  }

  function cerrar() {
    setAbierta(false)
    setMarcada(null)
  }

  function elegir(sugerencia: Sugerencia) {
    cerrar()
    alElegir(sugerencia.borrador)
  }

  /** Las flechas abren la lista si está cerrada y dan la vuelta al llegar al final. */
  function mover(paso: 1 | -1) {
    const desde = mostrar ? indice : -1
    const siguiente =
      desde === -1
        ? paso === 1
          ? 0
          : visibles.length - 1
        : (desde + paso + visibles.length) % visibles.length
    if (!mostrar) abrir()
    setMarcada(visibles[siguiente].clave)
    requestAnimationFrame(() =>
      document.getElementById(idOpcion(siguiente))?.scrollIntoView({ block: "nearest" }),
    )
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    // Mientras se compone una letra (acentos, teclados asiáticos) las teclas son suyas
    if (e.nativeEvent.isComposing) return

    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && visibles.length > 0) {
      e.preventDefault()
      mover(e.key === "ArrowDown" ? 1 : -1)
      return
    }
    if (e.key === "Escape" && mostrar) {
      e.preventDefault()
      cerrar()
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (mostrar && indice >= 0) {
        elegir(visibles[indice])
        return
      }
      e.currentTarget.blur()
      alPulsarEnter()
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={campoRef}
        value={valor}
        onChange={(e) => {
          onChange(e.target.value)
          setMarcada(null)
          if (e.target.value.trim()) abrir()
          else cerrar()
        }}
        onFocus={() => void cargar()}
        onBlur={() => {
          cerrar()
          alSalir()
        }}
        onKeyDown={alTeclear}
        placeholder="¿En qué estás trabajando?"
        /* El autocompletado del navegador saldría encima del nuestro */
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={mostrar ? idLista : undefined}
        aria-activedescendant={mostrar && indice >= 0 ? idOpcion(indice) : undefined}
        className="w-full bg-transparent px-1 text-[0.95rem] outline-none placeholder:text-muted"
      />

      {mostrar && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Descripciones que ya has usado"
          /* Tocar la lista no puede quitarle el foco al campo: se cerraría
             antes de que llegase el clic, y en el móvil se iría el teclado. */
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          className="card entra scroll-thin absolute left-0 top-full z-50 mt-2 w-full overflow-y-auto overscroll-contain p-1 sm:min-w-80"
          style={{ boxShadow: "var(--shadow-lg)", maxHeight: altoMaximo }}
        >
          {visibles.map((sugerencia, i) => (
            <li
              key={sugerencia.clave}
              id={idOpcion(i)}
              role="option"
              aria-selected={i === indice}
              onClick={() => elegir(sugerencia)}
              className={cn(
                "cursor-pointer rounded-[var(--radio-sm)] px-2.5 py-1.5",
                i === indice ? "bg-accent-soft" : "hover:bg-surface-2",
              )}
            >
              <span className="block truncate text-sm">
                {sugerencia.borrador.description}
              </span>
              <Detalle borrador={sugerencia.borrador} catalogo={catalogo} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Debajo de la descripción, en pequeño: dónde se apuntó y con qué etiquetas. */
function Detalle({
  borrador,
  catalogo,
}: {
  borrador: BorradorEntrada
  catalogo: Catalogo
}) {
  const proyecto = catalogo.proyectos.find((p) => p.id === borrador.project_id)
  const edicion = catalogo.ediciones.find((e) => e.id === borrador.edition_id)
  const tarea = catalogo.tareas.find((t) => t.id === borrador.task_id)
  const etiquetas = catalogo.etiquetas.filter((e) => borrador.tagIds.includes(e.id))

  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
      {proyecto ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: proyecto.color }}
          />
          {/* Como en el selector de proyecto: el nombre de su color, y la
              edicion y la tarea detras */}
          <span className="truncate">
            <span className="font-medium" style={{ color: proyecto.color }}>
              {proyecto.name}
            </span>
            {edicion && ` · ${edicion.name}`}
            {tarea && ` · ${tarea.name}`}
          </span>
        </span>
      ) : (
        <span className="shrink-0">Sin proyecto</span>
      )}

      {etiquetas.length > 0 && (
        /* Si no cabe todo, las etiquetas ceden antes que el proyecto */
        <span className="flex min-w-0 shrink-3 items-center gap-1">
          <TagIcon aria-hidden className="h-3 w-3 shrink-0" />
          <span className="truncate">{etiquetas.map((e) => e.name).join(", ")}</span>
        </span>
      )}

      {borrador.billable && (
        <span className="ml-auto flex shrink-0 items-center text-billable">
          <Euro aria-hidden className="h-3 w-3" />
          <span className="sr-only">Facturable</span>
        </span>
      )}
    </span>
  )
}
