"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import {
  analizarCsv,
  catalogoFaltante,
  combinarFicheros,
  normalizar,
  personasDe,
  resumenDeFichero,
  type Analisis,
  type FilaClockify,
  type FormatoFecha,
} from "@/lib/clockify"
import { formatDateShort, formatDurationShort, toDateKeyInZone } from "@/lib/time"
import type { Rol } from "@/lib/roles"
import type { Catalogo, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/** Filas por tanda al insertar: cada tanda es una sola sentencia SQL. */
const LOTE = 200
/**
 * Páginas al leer lo ya importado: una consulta filtrada por espacio y
 * source, nunca un IN con cientos de claves -eso sí generaba URLs enormes-.
 */
const TAMANO_PAGINA = 1000
const OMITIR = "__omitir__"

type Resultado = {
  insertadas: number
  duplicadas: number
  omitidas: number
  etiquetasSinAplicar: number
  creados: {
    areas: number
    proyectos: number
    tareas: number
    etiquetas: number
  }
}

type Progreso = { etapa: string; porcentaje: number | null }

type FicheroEstado = {
  id: string
  nombre: string
  analizando: boolean
  error: string | null
  analisis: Analisis | null
  formato: FormatoFecha | undefined
  texto: string | null
}

/** Lee el fichero y lo analiza, dejando pintar el spinner antes del trabajo pesado. */
async function analizarFichero(
  fichero: File,
  timeZone: string,
  formato?: FormatoFecha,
): Promise<{ texto: string; analisis: Analisis }> {
  const texto = await fichero.text()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const analisis = analizarCsv(texto, timeZone, formato)
  return { texto, analisis }
}

export function ImportadorClockify({
  espacioId,
  timeZone,
  yoId,
  rol,
  catalogo,
  miembros,
}: {
  espacioId: string
  timeZone: string
  yoId: string
  rol: Rol
  catalogo: Catalogo
  miembros: Miembro[]
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)

  const [ficheros, setFicheros] = useState<FicheroEstado[]>([])
  const [asignacion, setAsignacion] = useState<Record<string, string>>({})
  const [crearFaltantes, setCrearFaltantes] = useState(true)
  const [progreso, setProgreso] = useState<Progreso | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const esAdmin = rol === "admin"

  async function anadirFicheros(lista: File[]) {
    const csv = lista.filter((f) => /\.csv$/i.test(f.name))
    const noCsv = lista.length - csv.length
    setError(
      noCsv > 0
        ? `${noCsv} fichero${noCsv === 1 ? "" : "s"} no ${noCsv === 1 ? "es un CSV y no se ha" : "son CSV y no se han"} añadido. En Clockify: Informes > Detallado > Exportar > CSV.`
        : null,
    )
    if (csv.length === 0) return

    const nuevos = csv.map((fichero) => ({
      id: crypto.randomUUID(),
      fichero,
      nombre: fichero.name,
    }))

    setFicheros((actual) => [
      ...actual,
      ...nuevos.map(({ id, nombre }) => ({
        id,
        nombre,
        analizando: true,
        error: null,
        analisis: null,
        formato: undefined,
        texto: null,
      })),
    ])
    setResultado(null)

    for (const { id, fichero } of nuevos) {
      try {
        const { texto, analisis } = await analizarFichero(fichero, timeZone)
        setFicheros((actual) =>
          actual.map((f) =>
            f.id === id
              ? { ...f, texto, analisis, formato: analisis.formato, analizando: false }
              : f,
          ),
        )
      } catch (err) {
        setFicheros((actual) =>
          actual.map((f) =>
            f.id === id ? { ...f, analizando: false, error: mensajeError(err) } : f,
          ),
        )
      }
    }
  }

  async function reanalizar(id: string, formato: FormatoFecha) {
    const fichero = ficheros.find((f) => f.id === id)
    if (!fichero?.texto) return
    setFicheros((actual) => actual.map((f) => (f.id === id ? { ...f, analizando: true } : f)))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const analisis = analizarCsv(fichero.texto, timeZone, formato)
    setFicheros((actual) =>
      actual.map((f) => (f.id === id ? { ...f, analisis, formato, analizando: false } : f)),
    )
  }

  function quitarFichero(id: string) {
    setFicheros((actual) => actual.filter((f) => f.id !== id))
    setResultado(null)
  }

  const ficherosListos = useMemo(
    () => ficheros.filter((f): f is FicheroEstado & { analisis: Analisis } => f.analisis !== null),
    [ficheros],
  )

  const combinado = useMemo(
    () =>
      combinarFicheros(
        ficherosListos.map((f) => ({ nombre: f.nombre, analisis: f.analisis })),
      ),
    [ficherosListos],
  )

  const totalDescartadas = useMemo(
    () => ficherosListos.reduce((s, f) => s + f.analisis.descartadas.length, 0),
    [ficherosListos],
  )

  const personas = useMemo(() => personasDe(combinado.filas), [combinado])

  // Cada persona nueva que aparece se enchufa a quien tenga el mismo correo;
  // lo que el admin ya haya decidido para otra no se toca.
  useEffect(() => {
    setAsignacion((actual) => {
      let cambio = false
      const siguiente = { ...actual }
      for (const persona of personas) {
        if (siguiente[persona.clave] !== undefined) continue
        const encontrado = miembros.find(
          (m) =>
            m.email.toLowerCase() === persona.clave ||
            m.email.toLowerCase() === persona.email.toLowerCase(),
        )
        siguiente[persona.clave] = esAdmin
          ? (encontrado?.id ?? OMITIR)
          : encontrado?.id === yoId
            ? yoId
            : OMITIR
        cambio = true
      }
      return cambio ? siguiente : actual
    })
  }, [personas, miembros, esAdmin, yoId])

  const seleccionadas = useMemo(
    () =>
      combinado.filas.filter((f) => {
        const destino = asignacion[(f.email || f.usuario || "?").toLowerCase()]
        return destino && destino !== OMITIR
      }),
    [combinado, asignacion],
  )

  const faltante = useMemo(
    () => catalogoFaltante(seleccionadas, catalogo),
    [seleccionadas, catalogo],
  )

  const resumen = useMemo(() => {
    if (seleccionadas.length === 0) return null
    // El dia es el del huso del espacio: recortar el ISO se queda en UTC y
    // desplaza un dia los ratos de madrugada.
    const fechas = seleccionadas
      .map((f) => toDateKeyInZone(new Date(f.inicio), timeZone))
      .sort()
    return {
      filas: seleccionadas.length,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      segundos: seleccionadas.reduce((s, f) => s + f.segundos, 0),
    }
  }, [seleccionadas, timeZone])

  async function importar() {
    if (seleccionadas.length === 0) return
    setError(null)
    setResultado(null)

    const supabase = createClient()
    const creados = { areas: 0, proyectos: 0, tareas: 0, etiquetas: 0 }
    let insertadas = 0
    let etiquetasSinAplicar = 0

    try {
      /* ------------------------------------------------ catalogo que falta */
      const areasMapa = new Map(
        catalogo.categorias.filter((c) => !c.parent_id).map((c) => [normalizar(c.name), c.id]),
      )
      const proyectosMapa = new Map(catalogo.proyectos.map((p) => [normalizar(p.name), p.id]))
      const tareasMapa = new Map(
        catalogo.tareas.map((t) => [`${t.project_id}|${normalizar(t.name)}`, t.id]),
      )
      const etiquetasMapa = new Map(catalogo.etiquetas.map((t) => [normalizar(t.name), t.id]))

      if (crearFaltantes) {
        setProgreso({ etapa: "Creando catálogo…", porcentaje: null })

        if (faltante.areas.length > 0) {
          /* La columna «Client» del informe es, en LEINN, la rama del equipo
             -TLT, Care team...-: aqui entra como area y los proyectos cuelgan
             de ella. */
          const { data, error: err } = await supabase
            .from("categories")
            .insert(faltante.areas.map((name) => ({ workspace_id: espacioId, name })))
            .select("id, name")
          if (err) throw err
          for (const fila of data ?? []) areasMapa.set(normalizar(fila.name), fila.id)
          creados.areas = data?.length ?? 0
        }

        if (faltante.proyectos.length > 0) {
          const { data, error: err } = await supabase
            .from("projects")
            .insert(
              faltante.proyectos.map((p) => ({
                workspace_id: espacioId,
                name: p.nombre,
                category_id: p.area ? (areasMapa.get(normalizar(p.area)) ?? null) : null,
              })),
            )
            .select("id, name")
          if (err) throw err
          for (const fila of data ?? []) proyectosMapa.set(normalizar(fila.name), fila.id)
          creados.proyectos = data?.length ?? 0
        }

        const filasTareas = faltante.tareas
          .map((t) => ({ name: t.nombre, project_id: proyectosMapa.get(normalizar(t.proyecto)) }))
          .filter((t): t is { name: string; project_id: string } => Boolean(t.project_id))
        if (filasTareas.length > 0) {
          const { data, error: err } = await supabase
            .from("tasks")
            .insert(filasTareas.map((t) => ({ ...t, workspace_id: espacioId })))
            .select("id, name, project_id")
          if (err) throw err
          for (const fila of data ?? [])
            tareasMapa.set(`${fila.project_id}|${normalizar(fila.name)}`, fila.id)
          creados.tareas = data?.length ?? 0
        }

        if (faltante.etiquetas.length > 0) {
          const { data, error: err } = await supabase
            .from("tags")
            .insert(faltante.etiquetas.map((name) => ({ workspace_id: espacioId, name })))
            .select("id, name")
          if (err) throw err
          for (const fila of data ?? []) etiquetasMapa.set(normalizar(fila.name), fila.id)
          creados.etiquetas = data?.length ?? 0
        }
      }

      /* ------------------------------------------- lo que ya esta importado */
      setProgreso({ etapa: "Comprobando qué ya está importado…", porcentaje: null })

      const yaEstan = new Set<string>()
      let desde = 0
      for (;;) {
        const { data, error: err } = await supabase
          .from("time_entries")
          .select("external_id")
          .eq("workspace_id", espacioId)
          .eq("source", "clockify")
          // Sin un orden fijo, dos páginas pueden repetir o saltarse filas, y
          // una clave saltada se volvería a importar
          .order("id")
          .range(desde, desde + TAMANO_PAGINA - 1)
        if (err) throw err
        for (const fila of data ?? []) {
          if (fila.external_id) yaEstan.add(fila.external_id)
        }
        if (!data || data.length < TAMANO_PAGINA) break
        desde += TAMANO_PAGINA
      }

      const pendientes = seleccionadas.filter((f) => !yaEstan.has(f.clave))
      const duplicadas = seleccionadas.length - pendientes.length

      /* ----------------------------------------------------------- insercion */
      setProgreso({ etapa: "Importando…", porcentaje: 0 })

      for (let i = 0; i < pendientes.length; i += LOTE) {
        const lote = pendientes.slice(i, i + LOTE)

        const filas = lote.map((fila: FilaClockify) => {
          const proyectoId = fila.proyecto
            ? (proyectosMapa.get(normalizar(fila.proyecto)) ?? null)
            : null
          const tareaId =
            fila.tarea && proyectoId
              ? (tareasMapa.get(`${proyectoId}|${normalizar(fila.tarea)}`) ?? null)
              : null
          return {
            workspace_id: espacioId,
            user_id: asignacion[(fila.email || fila.usuario || "?").toLowerCase()],
            project_id: proyectoId,
            task_id: tareaId,
            description: fila.descripcion,
            start_at: fila.inicio,
            end_at: fila.fin,
            billable: fila.facturable,
            source: "clockify",
            external_id: fila.clave,
          }
        })

        const { data, error: err } = await supabase
          .from("time_entries")
          .insert(filas)
          .select("id, external_id")
        if (err) throw err

        insertadas += data?.length ?? 0

        // Etiquetas de las entradas recien creadas. Un fallo aqui no debe
        // tirar el resto de la importacion: las horas ya estan a salvo.
        const porClave = new Map((data ?? []).map((fila) => [fila.external_id ?? "", fila.id]))
        const relaciones: { entry_id: string; tag_id: string }[] = []
        for (const fila of lote) {
          const entryId = porClave.get(fila.clave)
          if (!entryId) continue
          for (const etiqueta of fila.etiquetas) {
            const tagId = etiquetasMapa.get(normalizar(etiqueta))
            if (tagId) relaciones.push({ entry_id: entryId, tag_id: tagId })
          }
        }
        if (relaciones.length > 0) {
          const { error: errTags } = await supabase.from("time_entry_tags").insert(relaciones)
          if (errTags) etiquetasSinAplicar += relaciones.length
        }

        setProgreso({
          etapa: "Importando…",
          porcentaje: Math.round(((i + lote.length) / pendientes.length) * 100),
        })
      }

      setResultado({
        insertadas,
        duplicadas,
        omitidas: combinado.filas.length - seleccionadas.length,
        etiquetasSinAplicar,
        creados,
      })
      router.refresh()
    } catch (err) {
      setError(
        mensajeError(err) +
          (insertadas > 0
            ? ` Se importaron ${insertadas} antes del fallo: puedes volver a intentarlo, no se duplicarán.`
            : ""),
      )
    } finally {
      setProgreso(null)
    }
  }

  /* ------------------------------------------------------------------ vista */

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold">Importar de Clockify</h2>
        <p className="mb-3 text-xs text-muted">
          En Clockify: Informes &gt; Detallado, elige las fechas y exporta en
          CSV. La versión gratuita solo exporta un año cada vez: se pueden
          soltar varios ficheros a la vez, uno por tramo. Cada hora se
          reconoce por persona y hora exacta, así que se puede reimportar sin
          duplicar nada.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            const lista = Array.from(e.dataTransfer.files ?? [])
            if (lista.length > 0) void anadirFicheros(lista)
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition",
            arrastrando ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2",
          )}
        >
          <FileUp className="h-6 w-6 text-muted" />
          <p className="text-sm">
            {ficheros.length > 0
              ? "Suelta más CSV aquí, o elígelos"
              : "Arrastra aquí uno o varios CSV, o elígelos"}
          </p>
          <input
            ref={entrada}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={(e) => {
              const lista = Array.from(e.target.files ?? [])
              if (lista.length > 0) void anadirFicheros(lista)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="btn"
          >
            <Upload className="h-4 w-4" />
            Elegir ficheros
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-danger-soft p-2.5 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      {ficheros.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Ficheros</h2>
          <ul className="divide-y divide-line">
            {ficheros.map((fichero) => (
              <FilaFichero
                key={fichero.id}
                fichero={fichero}
                timeZone={timeZone}
                onFormato={(formato) => void reanalizar(fichero.id, formato)}
                onQuitar={() => quitarFichero(fichero.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {combinado.filas.length > 0 && (
        <>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Qué voy a importar</h2>

            {resumen ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato etiqueta="Entradas" valor={String(resumen.filas)} />
                <Dato
                  etiqueta="Horas"
                  valor={formatDurationShort(resumen.segundos)}
                />
                <Dato etiqueta="Desde" valor={formatDateShort(resumen.desde)} />
                <Dato etiqueta="Hasta" valor={formatDateShort(resumen.hasta)} />
              </div>
            ) : (
              <p className="text-sm text-muted">
                Ninguna persona del fichero esta asignada todavía.
              </p>
            )}

            {resumen && crearFaltantes && (
              <p className="mt-3 text-xs text-muted">
                Se crearán {faltante.areas.length} áreas,{" "}
                {faltante.proyectos.length} proyectos, {faltante.tareas.length}{" "}
                tareas y {faltante.etiquetas.length} etiquetas que no existen
                aún.
              </p>
            )}

            {(totalDescartadas > 0 || combinado.repetidasEntreFicheros > 0) && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radio-sm)] border border-line bg-surface-2 p-2.5 text-xs text-ink-soft">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                <span>
                  {totalDescartadas > 0 &&
                    `${totalDescartadas} filas no se pueden leer y quedan fuera. `}
                  {combinado.repetidasEntreFicheros > 0 &&
                    `${combinado.repetidasEntreFicheros} horas salen repetidas entre ficheros y solo cuentan una vez.`}
                </span>
              </p>
            )}

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={crearFaltantes}
                onChange={(e) => setCrearFaltantes(e.target.checked)}
              />
              Crear las áreas, proyectos, tareas y etiquetas que falten
            </label>

            <p className="mt-3 text-xs text-muted">
              La columna «Client» entra como área -Backoffice, TLT, Eventos…-
              y los proyectos cuelgan de ella.
            </p>
          </section>

          <section className="card p-4">
            <h2 className="mb-1 text-sm font-semibold">Personas</h2>
            <p className="mb-3 text-xs text-muted">
              {esAdmin
                ? "Empareja cada persona del informe con su cuenta. Lo que dejes sin asignar no se importa."
                : "Solo puedes importar tus propias horas. Pide a un administrador que importe las del resto."}
            </p>

            <ul className="divide-y divide-line">
              {personas.map((persona) => (
                <li key={persona.clave} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{persona.nombre}</p>
                    <p className="truncate text-xs text-muted">
                      {persona.email || "sin correo"} · {persona.filas} entradas
                    </p>
                  </div>
                  <select
                    className="field w-52 py-1"
                    value={asignacion[persona.clave] ?? OMITIR}
                    onChange={(e) =>
                      setAsignacion({
                        ...asignacion,
                        [persona.clave]: e.target.value,
                      })
                    }
                  >
                    <option value={OMITIR}>No importar</option>
                    {(esAdmin ? miembros : miembros.filter((m) => m.id === yoId)).map(
                      (miembro) => (
                        <option key={miembro.id} value={miembro.id}>
                          {miembro.full_name}
                        </option>
                      ),
                    )}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            {progreso && (
              <div className="mb-3">
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full bg-accent transition-all",
                      progreso.porcentaje === null && "w-1/3 animate-pulse",
                    )}
                    style={
                      progreso.porcentaje !== null
                        ? { width: `${progreso.porcentaje}%` }
                        : undefined
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {progreso.etapa}
                  {progreso.porcentaje !== null && ` ${progreso.porcentaje}%`}
                </p>
              </div>
            )}

            {resultado && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-running/30 bg-running-soft p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-running" />
                <div>
                  <p className="font-medium text-running">
                    {resultado.insertadas} entradas importadas
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {resultado.duplicadas} ya estaban de una importación anterior
                    {resultado.omitidas > 0 &&
                      `, ${resultado.omitidas} omitidas por no tener persona asignada`}
                    . Se crearon {resultado.creados.areas} áreas,{" "}
                    {resultado.creados.proyectos} proyectos,{" "}
                    {resultado.creados.tareas} tareas y{" "}
                    {resultado.creados.etiquetas} etiquetas.
                    {resultado.etiquetasSinAplicar > 0 &&
                      ` ${resultado.etiquetasSinAplicar} etiquetas no se pudieron aplicar; las horas sí se importaron.`}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void importar()}
              disabled={progreso !== null || seleccionadas.length === 0}
              className={cn("btn btn-primary w-full")}
            >
              {progreso !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {seleccionadas.length} entradas
            </button>
          </section>
        </>
      )}
    </div>
  )
}

function FilaFichero({
  fichero,
  timeZone,
  onFormato,
  onQuitar,
}: {
  fichero: FicheroEstado
  timeZone: string
  onFormato: (formato: FormatoFecha) => void
  onQuitar: () => void
}) {
  const resumen = fichero.analisis
    ? resumenDeFichero({ nombre: fichero.nombre, analisis: fichero.analisis }, timeZone)
    : null
  const sinCabeceras = (fichero.analisis?.cabecerasFaltan.length ?? 0) > 0

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{fichero.nombre}</p>

        {fichero.analizando && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="h-3 w-3 animate-spin" /> Analizando…
          </p>
        )}

        {fichero.error && (
          <p className="mt-0.5 text-xs text-danger">{fichero.error}</p>
        )}

        {sinCabeceras && (
          <p className="mt-0.5 text-xs text-danger">
            No encuentro las columnas de fecha y hora de inicio. Comprueba que
            es un informe detallado y no un resumen.
          </p>
        )}

        {resumen && !sinCabeceras && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {resumen.filas} filas
            {resumen.descartadas > 0 && `, ${resumen.descartadas} descartadas`}
            {resumen.desde && resumen.hasta && (
              <>
                {" · "}
                {formatDateShort(resumen.desde)} – {formatDateShort(resumen.hasta)}
              </>
            )}
          </p>
        )}
      </div>

      {fichero.analisis && !sinCabeceras && (
        <select
          className="field w-32 shrink-0 py-1 text-xs"
          value={fichero.formato}
          onChange={(e) => onFormato(e.target.value as FormatoFecha)}
        >
          <option value="dmy">Día/Mes/Año</option>
          <option value="mdy">Mes/Día/Año</option>
          <option value="iso">Año-Mes-Día</option>
        </select>
      )}

      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${fichero.nombre}`}
        className="shrink-0 rounded p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="tabular mt-0.5 text-base font-semibold">{valor}</p>
    </div>
  )
}
