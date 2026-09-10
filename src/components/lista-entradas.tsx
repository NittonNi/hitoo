"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Euro, Play, Tag } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { FilaEntrada } from "@/components/fila-entrada"
import { useAvisos } from "@/components/avisos"
import { useCronometro } from "@/components/proveedor-cronometro"
import { SelectorProyecto } from "@/components/selector-proyecto"
import { SelectorEtiquetas } from "@/components/selector-etiquetas"
import {
  dayLabel,
  formatClock,
  formatDurationShort,
  formatObjetivoCorto,
  weekKey,
  weekLabel,
} from "@/lib/time"
import type { TablesUpdate } from "@/lib/database.types"
import type { Catalogo, EntradaVista, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * Lo que junta dos ratos: el mismo dia y el mismo proyecto -con su edicion, que
 * TBCE 1 y TBCE 2 no son lo mismo-. La descripcion, la tarea, las etiquetas y
 * si se cobra pueden cambiar y siguen yendo juntos: se ven al abrir. Los dias
 * nunca se juntan; agrupar ocurre siempre dentro de un dia.
 */
function claveGrupo(e: EntradaVista): string {
  return [e.user_id, e.project_id ?? "-", e.edition_id ?? "-"].join("|")
}

/** El valor que llevan todos, o null si cada uno lleva el suyo. */
function comun<T>(valores: T[]): T | null {
  const primero = valores[0]
  return valores.every((v) => v === primero) ? primero : null
}

type Grupo = { clave: string; entradas: EntradaVista[] }

/** Que celda de la fila de grupo esta abierta. Solo una a la vez. */
type CampoGrupo = "descripcion" | "proyecto" | "etiquetas" | null

/** Agrupa conservando el orden en que vienen (de la mas nueva a la mas vieja). */
function agrupar(entradas: EntradaVista[]): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const entrada of entradas) {
    const clave = claveGrupo(entrada)
    const grupo = mapa.get(clave)
    if (grupo) grupo.entradas.push(entrada)
    else mapa.set(clave, { clave, entradas: [entrada] })
  }
  return [...mapa.values()]
}

/**
 * Las horas van agrupadas por semana y, dentro, por dia. La cabecera de cada
 * bloque lleva su total y, si el espacio tiene objetivo, cuanto es de cuanto.
 */
export function ListaEntradas({
  entradas,
  catalogo,
  miembros = [],
  mostrarPersona = false,
  objetivoDia = null,
  objetivoSemana = null,
}: {
  entradas: EntradaVista[]
  catalogo: Catalogo
  /** El equipo, para compartir horas desde la propia fila. */
  miembros?: Miembro[]
  mostrarPersona?: boolean
  /** Minutos al dia, del espacio. */
  objetivoDia?: number | null
  /** Minutos a la semana, del espacio. */
  objetivoSemana?: number | null
}) {
  const semanas = useMemo(() => {
    const mapa = new Map<string, Map<string, EntradaVista[]>>()
    for (const e of entradas) {
      if (!e.end_at) continue // el cronometro en marcha ya sale en la barra
      const semana = weekKey(e.local_date)
      const dias = mapa.get(semana) ?? new Map<string, EntradaVista[]>()
      const lista = dias.get(e.local_date)
      if (lista) lista.push(e)
      else dias.set(e.local_date, [e])
      mapa.set(semana, dias)
    }
    return [...mapa.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([semana, dias]) => ({
        semana,
        dias: [...dias.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([dia, delDia]) => ({ dia, grupos: agrupar(delDia) })),
      }))
  }, [entradas])

  if (semanas.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-sm font-medium">Aquí aparecerán tus horas</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Escribe arriba en qué estás trabajando y dale al play. En modo
          manual apuntas un rato que ya has echado.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {semanas.map(({ semana, dias }) => {
        const totalSemana = dias.reduce(
          (s, { grupos }) => s + segundosDe(grupos.flatMap((g) => g.entradas)),
          0,
        )
        return (
          <section key={semana}>
            <header className="flex items-baseline justify-between border-b border-line px-1 pb-1.5">
              <h2 className="text-sm font-semibold">{weekLabel(semana)}</h2>
              <Cifra segundos={totalSemana} objetivo={objetivoSemana} />
            </header>

            <div className="mt-3 space-y-4">
              {dias.map(({ dia, grupos }) => (
                <div key={dia}>
                  <header className="flex items-baseline justify-between px-1 pb-1.5">
                    <h3 className="text-sm font-medium text-ink-soft">
                      {dayLabel(dia)}
                    </h3>
                    <Cifra
                      segundos={segundosDe(grupos.flatMap((g) => g.entradas))}
                      objetivo={objetivoDia}
                      discreto
                    />
                  </header>
                  <ul className="card overflow-hidden">
                    {grupos.map((grupo) =>
                      grupo.entradas.length === 1 ? (
                        <FilaEntrada
                          key={grupo.entradas[0].id}
                          entrada={grupo.entradas[0]}
                          catalogo={catalogo}
                          miembros={miembros}
                          mostrarPersona={mostrarPersona}
                        />
                      ) : (
                        <FilaGrupo
                          key={grupo.clave}
                          grupo={grupo}
                          catalogo={catalogo}
                          miembros={miembros}
                          mostrarPersona={mostrarPersona}
                        />
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function segundosDe(entradas: EntradaVista[]): number {
  return entradas.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
}

/**
 * Varios ratos del mismo proyecto en el mismo dia. La fila de arriba resume
 * -cuantos son y cuanto suman- y se edita: lo que se cambie ahi cae sobre todos
 * los ratos del grupo, tambien los de antes. Lo que no se puede es fundirlos:
 * cada rato sigue entero dentro, con su horario y su duracion.
 */
function FilaGrupo({
  grupo,
  catalogo,
  miembros,
  mostrarPersona,
}: {
  grupo: Grupo
  catalogo: Catalogo
  miembros: Miembro[]
  mostrarPersona: boolean
}) {
  const router = useRouter()
  const { arrancar } = useCronometro()
  const { avisar } = useAvisos()
  const [abierto, setAbierto] = useState(false)
  const [campo, setCampo] = useState<CampoGrupo>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entradas = grupo.entradas
  const primera = entradas[0]
  const total = segundosDe(entradas)
  const cuantos = entradas.length
  // Con una cerrada, el grupo entero no se toca: se abre y se edita lo de dentro
  const bloqueado = entradas.some((e) => e.locked)

  /* Lo que comparten todos se enseña tal cual; lo que no, se enseña junto, para
     que se vea que ahi dentro hay cosas distintas antes de cambiarlas. */
  const descripcion = comun(entradas.map((e) => e.description.trim()))
  /* Las vacias cuentan como una descripcion mas: si un rato lleva texto y otro
     no, no se puede enseñar solo el texto como si fuera de los dos. */
  const descripciones = [
    ...new Set(
      entradas.map((e) => e.description.trim() || "sin descripción"),
    ),
  ]
  const tarea = comun(entradas.map((e) => e.task_name))
  const facturable = comun(entradas.map((e) => e.billable))
  const mismasEtiquetas =
    comun(entradas.map((e) => [...e.tags].sort().join("|"))) !== null

  const etiquetasPuestas = catalogo.etiquetas
    .filter((t) => primera.tags.includes(t.name))
    .map((t) => t.id)

  /* De cuando empezo el primero a cuando acabo el ultimo. Las fechas de la base
     vienen todas con el mismo formato, asi que se pueden comparar como texto. */
  const empieza = entradas.reduce(
    (antes, e) => (e.start_at < antes ? e.start_at : antes),
    primera.start_at,
  )
  const acaba = entradas.reduce(
    (despues, e) => ((e.end_at ?? "") > despues ? e.end_at! : despues),
    primera.end_at ?? primera.start_at,
  )
  const acabaOtroDia = (() => {
    const medianoche = new Date(empieza)
    medianoche.setHours(24, 0, 0, 0)
    return new Date(acaba) > medianoche
  })()

  /** Un cambio para todo el grupo, con su vuelta atras rato a rato. */
  async function guardarEnTodas(
    cambios: TablesUpdate<"time_entries">,
    contar: (n: number) => string,
  ) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const antes = entradas.map((e) => ({
      id: e.id,
      description: e.description,
      project_id: e.project_id,
      edition_id: e.edition_id,
      task_id: e.task_id,
      billable: e.billable,
    }))

    const { data, error: err } = await supabase
      .from("time_entries")
      .update(cambios)
      .in(
        "id",
        entradas.map((e) => e.id),
      )
      .select("id")
    setOcupado(false)
    setCampo(null)

    if (err) {
      setError(mensajeError(err))
      return
    }

    const cambiados = data?.length ?? 0
    router.refresh()

    if (cambiados < cuantos) {
      const aviso =
        cambiados === 0
          ? "No se ha cambiado nada. Puede haberse acabado tu sesión: recarga la página."
          : `Solo se han cambiado ${cambiados} de ${cuantos}: alguna hora está cerrada.`
      setError(aviso)
      avisar(aviso)
      return
    }

    avisar(contar(cambiados), async () => {
      const cliente = createClient()
      for (const { id, ...valores } of antes) {
        const { error: errVolver } = await cliente
          .from("time_entries")
          .update(valores)
          .eq("id", id)
        if (errVolver) throw new Error(mensajeError(errVolver))
      }
      router.refresh()
      return "Como estaban."
    })
  }

  /** Las etiquetas viven en otra tabla: se quitan y se vuelven a poner. */
  async function guardarEtiquetasEnTodas(ids: string[]) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const antes = entradas.map((e) => ({
      id: e.id,
      tagIds: catalogo.etiquetas
        .filter((t) => e.tags.includes(t.name))
        .map((t) => t.id),
    }))

    const poner = async (reparto: { id: string; tagIds: string[] }[]) => {
      await supabase
        .from("time_entry_tags")
        .delete()
        .in(
          "entry_id",
          reparto.map((r) => r.id),
        )
      const filas = reparto.flatMap((r) =>
        r.tagIds.map((tag_id) => ({ entry_id: r.id, tag_id })),
      )
      if (filas.length === 0) return null
      const { error: err } = await supabase.from("time_entry_tags").insert(filas)
      return err ? mensajeError(err) : null
    }

    const fallo = await poner(entradas.map((e) => ({ id: e.id, tagIds: ids })))
    setOcupado(false)
    setCampo(null)
    if (fallo) {
      setError(fallo)
      return
    }
    router.refresh()

    avisar(`Etiquetas puestas en ${cuantos} ratos.`, async () => {
      const fallo = await poner(antes)
      if (fallo) throw new Error(fallo)
      router.refresh()
      return "Como estaban."
    })
  }

  const pulsable =
    "rounded-[6px] px-1.5 py-1 text-left transition hover:bg-surface-3/70"

  return (
    <li
      className={cn(
        "border-b border-line last:border-b-0",
        ocupado && "opacity-50",
      )}
    >
      <div
        className={cn(
          "group flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-2 transition md:flex-nowrap md:gap-3 md:py-2.5",
        )}
      >
        {/* ------------------------------------------- contador y descripcion */}
        <div className="min-w-0 flex-1 md:w-[30%] md:flex-none">
          <div className="flex items-center gap-1.5">
          {/* Cuantos ratos son, y abre o cierra */}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            title={abierto ? "Juntar los ratos" : `Ver los ${cuantos} ratos`}
            className="flex h-9 shrink-0 items-center gap-1 rounded-[6px] py-1 pl-1 pr-1.5 text-muted transition hover:bg-surface-3/70 hover:text-ink md:h-auto md:pl-0.5 md:pr-1"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                abierto && "rotate-90",
              )}
              aria-hidden
            />
            <span className="tabular grid h-5 min-w-5 place-items-center rounded-full border border-line px-1 text-[0.6875rem] font-semibold">
              {cuantos}
            </span>
          </button>

          <div className="min-w-0 flex-1">
          {campo === "descripcion" ? (
            <input
              autoFocus
              defaultValue={descripcion ?? ""}
              placeholder={
                descripciones.length > 1
                  ? `Poner la misma a los ${cuantos}`
                  : "¿En qué has trabajado?"
              }
              onBlur={(e) => {
                const valor = e.target.value
                /* En blanco y con descripciones distintas no se toca nada: se
                   entra a escribir una comun, no a borrar las que hay. */
                if (
                  valor === (descripcion ?? "") ||
                  (!valor && descripcion === null)
                ) {
                  setCampo(null)
                  return
                }
                void guardarEnTodas(
                  { description: valor },
                  (n) => `Descripción puesta en ${n} ratos.`,
                )
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
                if (e.key === "Escape") setCampo(null)
              }}
              className="field py-1 text-[0.9375rem]"
            />
          ) : (
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setCampo("descripcion")}
              title={
                descripciones.length > 1
                  ? `Cada rato tiene la suya: ${descripciones.join(" · ")}`
                  : undefined
              }
              className={cn(pulsable, "block w-full truncate text-[0.9375rem]")}
            >
              {descripcion === null ? (
                <span className="text-ink-soft">
                  {descripciones.join(" · ")}
                </span>
              ) : descripcion === "" ? (
                <span className="text-muted">
                  {bloqueado ? "Sin descripción" : "Añadir descripción"}
                </span>
              ) : (
                descripcion
              )}
            </button>
          )}
          </div>
          </div>

        </div>

        {/* ---------------------------------------------------- proyecto */}
        <div className="hidden w-52 shrink-0 md:block">
          {campo === "proyecto" ? (
            <SelectorProyecto
              catalogo={catalogo}
              compacto
              autoAbrir
              valor={{
                project_id: primera.project_id,
                task_id: tarea === null ? null : primera.task_id,
                edition_id: primera.edition_id,
              }}
              onChange={(sel) =>
                void guardarEnTodas(
                  {
                    project_id: sel.project_id,
                    task_id: sel.task_id,
                    edition_id: sel.edition_id,
                  },
                  (n) => `Proyecto cambiado en ${n} ratos.`,
                )
              }
            />
          ) : (
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setCampo("proyecto")}
              className={cn(pulsable, "flex w-full items-center gap-1.5")}
            >
              {primera.project_name ? (
                <>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      facturable && "marca-facturable",
                    )}
                    style={{
                      background: primera.project_color ?? "var(--line-strong)",
                    }}
                  />
                  <span
                    className="min-w-0 truncate text-[0.8125rem] font-medium"
                    style={{ color: primera.project_color ?? undefined }}
                  >
                    {primera.project_name}
                    {primera.edition_name && (
                      <span className="text-muted">
                        {" "}
                        · {primera.edition_name}
                      </span>
                    )}
                    {tarea ? (
                      <span className="text-muted"> · {tarea}</span>
                    ) : (
                      <span className="text-muted"> · varias tareas</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-[0.8125rem] text-muted">
                  {bloqueado ? "Sin proyecto" : "Añadir proyecto"}
                </span>
              )}
            </button>
          )}
        </div>

        {/* --------------------------------------------------- etiquetas */}
        <div className="hidden flex-1 md:block" aria-hidden />

        <div className="hidden w-36 shrink-0 lg:block">
          {campo === "etiquetas" ? (
            <SelectorEtiquetas
              etiquetas={catalogo.etiquetas}
              seleccionadas={mismasEtiquetas ? etiquetasPuestas : []}
              compacto
              autoAbrir
              onChange={(ids) => void guardarEtiquetasEnTodas(ids)}
            />
          ) : (
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setCampo("etiquetas")}
              className={cn(pulsable, "flex w-full items-center gap-1")}
            >
              {mostrarPersona && (
                <span className="chip min-w-0 truncate">
                  {primera.user_name}
                </span>
              )}
              {!mismasEtiquetas ? (
                <span
                  className="chip shrink-0 text-muted"
                  title="Cada rato lleva las suyas"
                >
                  varias
                </span>
              ) : (
                <>
                  {primera.tags.length === 0 && !mostrarPersona && (
                    <Tag className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Etiquetas" />
                  )}
                  {primera.tags.slice(0, 1).map((t) => (
                    <span key={t} className="chip min-w-0 truncate">
                      {t}
                    </span>
                  ))}
                  {primera.tags.length > 1 && (
                    <span className="chip shrink-0">
                      +{primera.tags.length - 1}
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </div>

        {/* Hueco del "compartida con": cada rato lleva el suyo dentro */}
        <div className="hidden w-7 shrink-0 sm:block" aria-hidden />

        {/* -------------------------------------------------- facturable */}
        <button
          type="button"
          disabled={bloqueado}
          onClick={() =>
            void guardarEnTodas({ billable: !facturable }, (n) =>
              facturable ? `${n} ratos ya no se cobran.` : `${n} ratos se cobran.`,
            )
          }
          title={
            facturable === null
              ? "Unas se cobran y otras no: pulsa para cobrarlas todas"
              : facturable
                ? "Se cobran"
                : "No se cobran"
          }
          aria-pressed={facturable === true}
          className={cn(
            "order-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] transition md:order-none md:h-auto md:w-auto md:p-1",
            facturable
              ? "text-billable hover:bg-billable-soft"
              : "text-muted hover:bg-surface-3/70",
          )}
        >
          <Euro className="h-3.5 w-3.5" />
        </button>

        {/* De lo mas temprano a lo mas tarde del grupo. No es un rato seguido
            -por eso no se puede pulsar-, pero situa el trabajo en el dia. */}
        <div className="hidden w-28 shrink-0 sm:block">
          <p
            className="tabular px-1.5 py-1 text-right text-[0.8125rem] text-muted"
            title={`Del primer rato al ultimo, ${cuantos} en total`}
          >
            {formatClock(empieza)}–{formatClock(acaba)}
            {acabaOtroDia && (
              <sup className="ml-0.5 font-semibold text-live" title="Termina al día siguiente">
                +1
              </sup>
            )}
          </p>
        </div>

        {/* ---------------------------------------------------- el total */}
        <div className="w-[4.75rem] shrink-0 md:w-[5.5rem]">
          <p className="caja-horas w-full text-[0.9375rem] font-semibold">
            {formatDurationShort(total)}
          </p>
        </div>

        {/* En movil la fila parte aqui: arriba el grupo y su total, abajo el
            proyecto, el horario y el play. */}
        <span className="basis-full md:hidden" aria-hidden />

          {/* En movil, debajo: de que es el grupo y de cuando a cuando */}
          <p className="order-1 flex min-w-0 flex-1 items-center gap-1.5 truncate py-0.5 pl-1.5 text-xs text-muted md:hidden">
            {primera.project_name ? (
              <>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: primera.project_color ?? "var(--line-strong)" }}
                />
                <span
                  className="min-w-0 truncate font-medium"
                  style={{ color: primera.project_color ?? undefined }}
                >
                  {primera.project_name}
                </span>
              </>
            ) : (
              <span className="shrink-0">Sin proyecto</span>
            )}
            <span aria-hidden>·</span>
            <span className="tabular shrink-0">
              {formatClock(empieza)}–{formatClock(acaba)}
              {acabaOtroDia && <sup className="ml-0.5 text-live">+1</sup>}
            </span>
          </p>

        <button
          type="button"
          title="Continuar con esto ahora"
          onClick={() =>
            void arrancar({
              project_id: primera.project_id,
              edition_id: primera.edition_id,
              task_id: tarea === null ? null : primera.task_id,
              description: descripcion ?? "",
              billable: facturable === true,
              tagIds: mismasEtiquetas ? etiquetasPuestas : [],
            })
          }
          /* Naranja, que en esta casa es el color de lo que corre: el play es lo
            unico de la fila que pone el cronometro en marcha */
          className="order-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-live transition hover:bg-live-soft md:order-none md:h-auto md:w-auto md:px-2 md:py-1.5"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Hueco de los tres puntos: cada rato tiene los suyos dentro */}
        <span className="order-4 w-10 shrink-0 md:order-none md:w-8" aria-hidden />
      </div>


      {error && <p className="px-2.5 pb-2 text-xs text-danger">{error}</p>}

      {abierto && (
        <ul className="border-t border-line bg-surface-2">
          {grupo.entradas.map((entrada) => (
            <FilaEntrada
              key={entrada.id}
              entrada={entrada}
              catalogo={catalogo}
              miembros={miembros}
              mostrarPersona={mostrarPersona}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** "6:12" o "6:12 / 8:00" cuando hay objetivo. */
function Cifra({
  segundos,
  objetivo,
  discreto = false,
}: {
  segundos: number
  objetivo: number | null
  discreto?: boolean
}) {
  const cumplido = objetivo !== null && segundos >= objetivo * 60

  return (
    <span className="tabular text-sm">
      <span
        className={cn(
          cumplido ? "font-medium text-billable" : discreto ? "text-ink-soft" : "text-ink",
        )}
      >
        {formatDurationShort(segundos)}
      </span>
      {objetivo !== null && (
        <span className="text-muted"> / {formatObjetivoCorto(objetivo)}</span>
      )}
    </span>
  )
}
