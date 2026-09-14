"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
import { COLORES_PROYECTO, type Catalogo, type Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/** Filas por tanda al insertar: cada tanda es una sola sentencia SQL. */
const LOTE = 200
/**
 * Páginas al leer lo ya importado: una consulta filtrada por espacio y
 * source, nunca un IN con cientos de claves -eso sí generaba URLs enormes-.
 */
const TAMANO_PAGINA = 1000
const OMITIR = "__omitir__"
/**
 * Quien aún no tiene cuenta entra como plaza con sus horas
 * (`crear_plaza_con_horas`): al unirse con el enlace y elegir su nombre, se
 * las lleva.
 */
const CREAR = "__crear__"

export type PlazaImportable = {
  nombre: string
  email: string | null
  /** Quien la cogió o, si nadie, la persona sin cuenta que guarda sus horas. */
  personaId: string | null
}

type Resultado = {
  insertadas: number
  duplicadas: number
  omitidas: number
  etiquetasSinAplicar: number
  creados: {
    plazas: number
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

const numero = (n: number) => n.toLocaleString("es-ES")

/** «1 proyecto», «3 proyectos»: sin paréntesis ni barras. */
function contar(n: number, uno: string, varios: string) {
  return `${numero(n)} ${n === 1 ? uno : varios}`
}

export function ImportadorClockify({
  espacioId,
  timeZone,
  yoId,
  rol,
  catalogo,
  miembros,
  plazas,
}: {
  espacioId: string
  timeZone: string
  yoId: string
  rol: Rol
  catalogo: Catalogo
  miembros: Miembro[]
  plazas: PlazaImportable[]
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
  const conCuenta = miembros.filter((m) => !m.sin_cuenta)
  const deUnaPlaza = miembros.filter((m) => m.sin_cuenta)

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

  /* Cada persona nueva del informe se enchufa sola: a quien tenga su correo;
     si no, a la plaza que ya lleva su correo o su nombre -reimportar no crea
     otra-; y si no hay ninguna, a una plaza nueva con sus horas. Lo que el
     admin ya haya decidido para otra no se toca. */
  useEffect(() => {
    setAsignacion((actual) => {
      let cambio = false
      const siguiente = { ...actual }
      for (const persona of personas) {
        if (siguiente[persona.clave] !== undefined) continue
        const correo = persona.email.toLowerCase()
        /* Por correo y, si no, por nombre: en Clockify cada uno suele usar el
           del trabajo, y en hitoo el suyo */
        const conSuCorreo =
          miembros.find(
            (m) =>
              !m.sin_cuenta &&
              (m.email.toLowerCase() === persona.clave || (correo && m.email.toLowerCase() === correo)),
          ) ??
          miembros.find((m) => !m.sin_cuenta && normalizar(m.full_name) === normalizar(persona.nombre))
        const suPlaza = plazas.find(
          (p) =>
            p.personaId &&
            miembros.some((m) => m.id === p.personaId) &&
            ((correo && p.email?.toLowerCase() === correo) ||
              normalizar(p.nombre) === normalizar(persona.nombre)),
        )
        const destino = conSuCorreo?.id ?? suPlaza?.personaId ?? null
        siguiente[persona.clave] = esAdmin
          ? (destino ?? CREAR)
          : destino === yoId
            ? yoId
            : OMITIR
        cambio = true
      }
      return cambio ? siguiente : actual
    })
  }, [personas, miembros, plazas, esAdmin, yoId])

  const seleccionadas = useMemo(
    () =>
      combinado.filas.filter((f) => {
        const destino = asignacion[(f.email || f.usuario || "?").toLowerCase()]
        return destino && destino !== OMITIR
      }),
    [combinado, asignacion],
  )

  /* Lo ya importado se mira en cuanto hay filas, no al pulsar: así el resumen
     dice lo que de verdad es nuevo, y reimportar lo mismo no propone crear
     plazas ni catálogo para horas que ya estaban. */
  const [yaEstan, setYaEstan] = useState<Set<string> | null>(null)
  const hayFilas = combinado.filas.length > 0
  useEffect(() => {
    if (!hayFilas || yaEstan) return
    let vivo = true
    leerYaImportadas()
      .then(({ claves, personaDe }) => {
        if (!vivo) return
        setYaEstan(claves)
        setDeAntes(personaDe)
      })
      .catch((err) => vivo && setError(mensajeError(err)))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo la primera vez que hay filas
  }, [hayFilas])

  /* Quien ya se importó antes va a donde fueron sus horas, aunque su correo o
     su nombre no digan nada: la segunda cuenta de Clockify de alguien se juntó
     a mano con la primera, y eso ya está en la base. Solo cambia lo que iba a
     una plaza nueva; lo elegido a mano, no. */
  const [deAntes, setDeAntes] = useState<Map<string, string> | null>(null)
  const yaColocadas = useRef(new Set<string>())
  useEffect(() => {
    if (!deAntes || !esAdmin) return
    // Fuera del actualizador: React lo repite en desarrollo, y apuntar ahí
    // las ya vistas hacía que la segunda pasada lo deshiciera
    const cambios: Record<string, string> = {}
    for (const persona of personas) {
      if (yaColocadas.current.has(persona.clave) || asignacion[persona.clave] === undefined) continue
      yaColocadas.current.add(persona.clave)
      const suyo = deAntes.get(persona.clave)
      if (asignacion[persona.clave] === CREAR && suyo && miembros.some((m) => m.id === suyo)) {
        cambios[persona.clave] = suyo
      }
    }
    if (Object.keys(cambios).length > 0) setAsignacion((actual) => ({ ...actual, ...cambios }))
  }, [deAntes, personas, asignacion, miembros, esAdmin])

  /**
   * Las claves de lo ya importado y, por cada persona del informe (lo que va
   * antes del primer «|» de la clave), a quién fueron sus horas.
   */
  async function leerYaImportadas() {
    const supabase = createClient()
    const claves = new Set<string>()
    const personaDe = new Map<string, string>()
    let desde = 0
    for (;;) {
      const { data, error: err } = await supabase
        .from("time_entries")
        .select("external_id, user_id")
        .eq("workspace_id", espacioId)
        .eq("source", "clockify")
        // Sin un orden fijo, dos páginas pueden repetir o saltarse filas, y
        // una clave saltada se volvería a importar
        .order("id")
        .range(desde, desde + TAMANO_PAGINA - 1)
      if (err) throw err
      for (const fila of data ?? []) {
        if (!fila.external_id) continue
        claves.add(fila.external_id)
        const quien = fila.external_id.split("|")[0]
        if (!personaDe.has(quien)) personaDe.set(quien, fila.user_id)
      }
      if (!data || data.length < TAMANO_PAGINA) break
      desde += TAMANO_PAGINA
    }
    return { claves, personaDe }
  }

  const nuevas = useMemo(
    () => (yaEstan ? seleccionadas.filter((f) => !yaEstan.has(f.clave)) : seleccionadas),
    [seleccionadas, yaEstan],
  )
  const yaImportadas = seleccionadas.length - nuevas.length

  const faltante = useMemo(() => catalogoFaltante(nuevas, catalogo), [nuevas, catalogo])

  /* Solo hace falta plaza para quien trae algo nuevo */
  const conAlgoNuevo = useMemo(
    () => new Set(nuevas.map((f) => (f.email || f.usuario || "?").toLowerCase())),
    [nuevas],
  )
  const plazasNuevas = personas.filter(
    (p) => asignacion[p.clave] === CREAR && conAlgoNuevo.has(p.clave),
  ).length

  const resumen = useMemo(() => {
    if (nuevas.length === 0) return null
    // El dia es el del huso del espacio: recortar el ISO se queda en UTC y
    // desplaza un dia los ratos de madrugada.
    const fechas = nuevas.map((f) => toDateKeyInZone(new Date(f.inicio), timeZone)).sort()
    return {
      filas: nuevas.length,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      segundos: nuevas.reduce((s, f) => s + f.segundos, 0),
    }
  }, [nuevas, timeZone])

  /* Lo que se va a crear, en una frase y solo lo que no es cero */
  const aCrear = [
    plazasNuevas > 0 && contar(plazasNuevas, "plaza", "plazas"),
    crearFaltantes && faltante.areas.length > 0 && contar(faltante.areas.length, "área", "áreas"),
    crearFaltantes &&
      faltante.proyectos.length > 0 &&
      contar(faltante.proyectos.length, "proyecto", "proyectos"),
    crearFaltantes && faltante.tareas.length > 0 && contar(faltante.tareas.length, "tarea", "tareas"),
    crearFaltantes &&
      faltante.etiquetas.length > 0 &&
      contar(faltante.etiquetas.length, "etiqueta", "etiquetas"),
  ].filter((t): t is string => Boolean(t))

  async function importar() {
    if (seleccionadas.length === 0) return
    setError(null)
    setResultado(null)

    const supabase = createClient()
    const creados = { plazas: 0, areas: 0, proyectos: 0, tareas: 0, etiquetas: 0 }
    let insertadas = 0
    let etiquetasSinAplicar = 0
    const destinos: Record<string, string> = { ...asignacion }

    try {
      /* ------------------------------------------- lo que ya esta importado */
      // Otra vez, por si alguien ha importado mientras tanto
      setProgreso({ etapa: "Comprobando qué ya está importado…", porcentaje: null })
      const { claves: yaImportado } = await leerYaImportadas()
      const pendientes = seleccionadas.filter((f) => !yaImportado.has(f.clave))
      const duplicadas = seleccionadas.length - pendientes.length
      const traenAlgo = new Set(pendientes.map((f) => (f.email || f.usuario || "?").toLowerCase()))

      /* --------------------------------------- plazas de quien no tiene cuenta */
      const sinCuenta = personas.filter(
        (p) => asignacion[p.clave] === CREAR && traenAlgo.has(p.clave),
      )
      if (sinCuenta.length > 0) {
        setProgreso({ etapa: "Creando plazas…", porcentaje: null })
        for (const persona of sinCuenta) {
          const { data, error: err } = await supabase.rpc("crear_plaza_con_horas", {
            p_workspace: espacioId,
            p_nombre: persona.nombre,
            p_email: persona.email || undefined,
          })
          if (err) throw err
          if (!data) throw new Error(`No se ha podido crear la plaza de ${persona.nombre}.`)
          destinos[persona.clave] = data
          creados.plazas++
        }
      }

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
          /* Clockify no exporta el color: cada proyecto nuevo coge el siguiente
             de la paleta, para que no salgan los cien del mismo en las
             gráficas. */
          const { data, error: err } = await supabase
            .from("projects")
            .insert(
              faltante.proyectos.map((p, i) => ({
                workspace_id: espacioId,
                name: p.nombre,
                category_id: p.area ? (areasMapa.get(normalizar(p.area)) ?? null) : null,
                color: COLORES_PROYECTO[(catalogo.proyectos.length + i) % COLORES_PROYECTO.length],
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
            user_id: destinos[(fila.email || fila.usuario || "?").toLowerCase()],
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
          const { data: puestas, error: errTags } = await supabase
            .from("time_entry_tags")
            .insert(relaciones)
            .select("entry_id")
          if (errTags) etiquetasSinAplicar += relaciones.length
          else etiquetasSinAplicar += relaciones.length - (puestas?.length ?? 0)
        }

        setProgreso({
          etapa: "Importando…",
          porcentaje: Math.round(((i + lote.length) / pendientes.length) * 100),
        })
      }

      setYaEstan(new Set([...yaImportado, ...pendientes.map((f) => f.clave)]))
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
            ? ` Se importaron ${numero(insertadas)} apuntes antes del fallo: puedes volver a intentarlo, no se duplicarán.`
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
          CSV. La versión gratuita solo exporta un año cada vez: suelta todos
          los ficheros juntos, uno por tramo. Cada hora se reconoce por persona
          y hora exacta, así que reimportar no duplica nada.
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
          {/* Primero de quién son las horas: lo que se importa depende de eso */}
          <section className="card p-4">
            <h2 className="mb-1 text-sm font-semibold">Personas</h2>
            <p className="mb-3 text-xs text-muted">
              {esAdmin
                ? "Cada persona del informe va a su cuenta si ya la tiene, o a su plaza. Quien no tenga ninguna entra en una plaza nueva con sus horas, que se lleva al unirse con el enlace y elegir su nombre."
                : "Solo puedes importar tus propias horas. Pide a un administrador que importe las del resto."}
            </p>

            <ul className="divide-y divide-line">
              {personas.map((persona) => (
                <li key={persona.clave} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{persona.nombre}</p>
                    <p className="truncate text-xs text-muted">
                      {persona.email || "sin correo"} · {contar(persona.filas, "apunte", "apuntes")}
                    </p>
                  </div>
                  <select
                    className="field w-full py-1 sm:w-60"
                    value={asignacion[persona.clave] ?? OMITIR}
                    onChange={(e) =>
                      setAsignacion({
                        ...asignacion,
                        [persona.clave]: e.target.value,
                      })
                    }
                    aria-label={`A quién van las horas de ${persona.nombre}`}
                  >
                    <option value={OMITIR}>No importar</option>
                    {esAdmin ? (
                      <>
                        <option value={CREAR}>Plaza nueva con sus horas</option>
                        {conCuenta.length > 0 && (
                          <optgroup label="Con cuenta">
                            {conCuenta.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {deUnaPlaza.length > 0 && (
                          <optgroup label="Plazas sin coger">
                            {deUnaPlaza.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.full_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      miembros
                        .filter((m) => m.id === yoId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))
                    )}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Qué se va a importar</h2>

            {yaEstan === null ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Mirando qué hay ya importado…
              </p>
            ) : resumen ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato etiqueta="Apuntes nuevos" valor={numero(resumen.filas)} />
                <Dato etiqueta="Horas" valor={formatDurationShort(resumen.segundos)} />
                <Dato etiqueta="Desde" valor={formatDateShort(resumen.desde)} />
                <Dato etiqueta="Hasta" valor={formatDateShort(resumen.hasta)} />
              </div>
            ) : (
              <p className="text-sm text-muted">
                {seleccionadas.length > 0
                  ? "Nada nuevo: todo lo de estos ficheros ya está importado."
                  : "No hay ninguna persona para importar: elige a quién van sus horas arriba."}
              </p>
            )}

            {yaEstan !== null && yaImportadas > 0 && (
              <p className="mt-3 text-xs text-muted">
                {contar(yaImportadas, "apunte ya estaba", "apuntes ya estaban")} de una
                importación anterior y no se repite{yaImportadas === 1 ? "" : "n"}.
              </p>
            )}

            {(totalDescartadas > 0 || combinado.repetidasEntreFicheros > 0) && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radio-sm)] border border-line bg-surface-2 p-2.5 text-xs text-ink-soft">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                <span>
                  {totalDescartadas > 0 &&
                    `${contar(totalDescartadas, "fila no se puede leer y queda fuera", "filas no se pueden leer y quedan fuera")}. `}
                  {combinado.repetidasEntreFicheros > 0 &&
                    `${contar(combinado.repetidasEntreFicheros, "apunte sale", "apuntes salen")} en dos ficheros y cuenta${combinado.repetidasEntreFicheros === 1 ? "" : "n"} una vez.`}
                </span>
              </p>
            )}

            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={crearFaltantes}
                onChange={(e) => setCrearFaltantes(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Crear las áreas, proyectos, tareas y etiquetas que falten
                <span className="block text-xs text-muted">
                  La columna «Client» de Clockify entra como área, y sus proyectos cuelgan de ella.
                </span>
              </span>
            </label>

            {yaEstan !== null && resumen && aCrear.length > 0 && (
              <p className="mt-3 text-xs text-muted">Se crearán {juntar(aCrear)}.</p>
            )}

            {progreso && (
              <div className="mt-4">
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
              /* Sin color: verde es «se cobra» y naranja «corriendo», y esto
                 no es ninguna de las dos */
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {contar(resultado.insertadas, "apunte importado", "apuntes importados")}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                    {resultado.duplicadas > 0 && (
                      <li>{contar(resultado.duplicadas, "ya estaba", "ya estaban")} de una importación anterior</li>
                    )}
                    {resultado.omitidas > 0 && (
                      <li>{contar(resultado.omitidas, "sin importar", "sin importar")}: su persona está en «No importar»</li>
                    )}
                    {(() => {
                      const c = resultado.creados
                      const hechos = [
                        c.plazas > 0 && contar(c.plazas, "plaza", "plazas"),
                        c.areas > 0 && contar(c.areas, "área", "áreas"),
                        c.proyectos > 0 && contar(c.proyectos, "proyecto", "proyectos"),
                        c.tareas > 0 && contar(c.tareas, "tarea", "tareas"),
                        c.etiquetas > 0 && contar(c.etiquetas, "etiqueta", "etiquetas"),
                      ].filter((t): t is string => Boolean(t))
                      return hechos.length > 0 ? <li>Creado: {juntar(hechos)}</li> : null
                    })()}
                    {resultado.etiquetasSinAplicar > 0 && (
                      <li className="text-danger">
                        {contar(resultado.etiquetasSinAplicar, "etiqueta no se pudo poner", "etiquetas no se pudieron poner")}; las horas sí están
                      </li>
                    )}
                  </ul>
                  <Link href="/informes" className="mt-2 inline-block text-sm font-medium text-accent">
                    Verlas en Informes
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void importar()}
              disabled={progreso !== null || yaEstan === null || nuevas.length === 0}
              className="btn btn-primary mt-4 w-full"
            >
              {progreso !== null && <Loader2 className="h-4 w-4 animate-spin" />}
              {yaEstan !== null && nuevas.length === 0
                ? "Nada nuevo que importar"
                : `Importar ${contar(nuevas.length, "apunte", "apuntes")}`}
            </button>
          </section>
        </>
      )}
    </div>
  )
}

/** «a, b y c» */
function juntar(partes: string[]) {
  return partes.length <= 1
    ? (partes[0] ?? "")
    : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`
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
            {contar(resumen.filas, "apunte", "apuntes")}
            {resumen.descartadas > 0 && `, ${numero(resumen.descartadas)} sin leer`}
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
          aria-label="Formato de las fechas"
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
