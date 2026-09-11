/**
 * Lectura de los informes detallados que exporta Clockify en CSV.
 *
 * El fichero cambia de idioma y de formato de fecha según la configuración de
 * la cuenta, así que las cabeceras se reconocen por sinonimos y el formato de
 * fecha se deduce mirando todas las filas antes de convertir ninguna.
 *
 * Las horas del informe vienen en el huso del espacio de trabajo (nunca en el
 * del navegador de quien importa): `analizarCsv` recibe ese huso y convierte
 * cada fecha+hora a partir de sus componentes, no sumando milisegundos -un
 * cambio de hora no son siempre 24h-.
 *
 * Cada fichero se analiza por su lado, con su propio formato de fecha. Lo que
 * se repite entre ficheros -misma persona, mismo inicio, mismo fin- cuenta una
 * vez: `combinarFicheros` se encarga de esa parte.
 */

import Papa from "papaparse"

import { TIMEZONE, toDateKeyInZone } from "@/lib/time"
import type { Catalogo } from "@/lib/tipos"

export type FormatoFecha = "iso" | "dmy" | "mdy"

export type FilaClockify = {
  fila: number
  usuario: string
  email: string
  /** La columna «Client» del informe: en LEINN es la rama del equipo. */
  area: string
  proyecto: string
  tarea: string
  descripcion: string
  etiquetas: string[]
  facturable: boolean
  inicio: string
  fin: string
  segundos: number
  clave: string
}

export type Analisis = {
  filas: FilaClockify[]
  descartadas: { fila: number; motivo: string }[]
  formato: FormatoFecha
  cabecerasFaltan: string[]
}

const CAMPOS = {
  proyecto: ["project", "proyecto"],
  area: ["client", "cliente", "area"],
  descripcion: ["description", "descripcion"],
  tarea: ["task", "tarea"],
  usuario: ["user", "usuario"],
  email: ["email", "correo electronico", "correo"],
  etiquetas: ["tags", "etiquetas"],
  facturable: ["billable", "facturable"],
  fechaInicio: ["start date", "fecha de inicio", "fecha inicio"],
  horaInicio: ["start time", "hora de inicio", "hora inicio"],
  fechaFin: ["end date", "fecha de finalizacion", "fecha de fin", "fecha fin"],
  horaFin: ["end time", "hora de finalizacion", "hora de fin", "hora fin"],
  duracion: ["duration (h)", "duración (h)", "duration", "duracion"],
  duracionDecimal: ["duration (decimal)", "duración (decimal)"],
} as const

type Campo = keyof typeof CAMPOS

/**
 * minusculas, sin acentos y sin espacios de más. Sirve tanto para reconocer
 * cabeceras como para comparar nombres de área/proyecto/tarea/etiqueta con lo
 * que ya hay en el espacio, que puede venir en mayúsculas por el «estilo de
 * texto» de Ajustes.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function mapearCabeceras(cabeceras: string[]): Partial<Record<Campo, string>> {
  const mapa: Partial<Record<Campo, string>> = {}
  for (const cabecera of cabeceras) {
    const limpia = normalizar(cabecera)
    for (const [campo, alias] of Object.entries(CAMPOS) as [
      Campo,
      readonly string[],
    ][]) {
      if (mapa[campo]) continue
      if (alias.includes(limpia)) mapa[campo] = cabecera
    }
  }
  return mapa
}

/* -------------------------------------------------------------------- fechas */

const SEPARADORES = /[/.\-]/

/**
 * Mira todas las fechas del fichero: si alguna tiene un primer número mayor
 * que 12 solo puede ser día/mes; si lo tiene el segundo, mes/día. Sin pistas,
 * día/mes, que es lo que exporta una cuenta configurada en español.
 */
export function detectarFormato(valores: string[]): FormatoFecha {
  let vistoDiaPrimero = false
  let vistoMesPrimero = false

  for (const valor of valores) {
    const limpio = valor?.trim()
    if (!limpio) continue
    if (/^\d{4}-\d{2}-\d{2}/.test(limpio)) return "iso"
    const partes = limpio.split(SEPARADORES)
    if (partes.length < 3) continue
    const a = Number(partes[0])
    const b = Number(partes[1])
    if (a > 12) vistoDiaPrimero = true
    if (b > 12) vistoMesPrimero = true
  }

  if (vistoDiaPrimero && !vistoMesPrimero) return "dmy"
  if (vistoMesPrimero && !vistoDiaPrimero) return "mdy"
  return "dmy"
}

function parsearFecha(
  valor: string,
  formato: FormatoFecha,
): [number, number, number] | null {
  const limpio = valor?.trim()
  if (!limpio) return null

  const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3])]

  const partes = limpio.split(SEPARADORES).map((p) => p.trim())
  if (partes.length < 3) return null

  const [p1, p2, p3] = partes.map(Number)
  if ([p1, p2, p3].some((n) => !Number.isFinite(n))) return null

  const anio = p3 < 100 ? 2000 + p3 : p3
  const [dia, mes] = formato === "mdy" ? [p2, p1] : [p1, p2]
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null

  return [anio, mes, dia]
}

/** "09:30", "09:30:15", "9:30 AM", "09:30 p. m." */
function parsearHora(valor: string): [number, number, number] | null {
  const limpio = normalizar(valor ?? "").replace(/\./g, "")
  if (!limpio) return null

  const trozos = limpio.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!trozos) return null

  let horas = Number(trozos[1])
  const minutos = Number(trozos[2])
  const segundos = Number(trozos[3] ?? 0)
  const sufijo = trozos[4]

  if (sufijo === "pm" && horas < 12) horas += 12
  if (sufijo === "am" && horas === 12) horas = 0
  if (horas > 23 || minutos > 59 || segundos > 59) return null

  return [horas, minutos, segundos]
}

/** "01:23:45" o "1,5" -> segundos */
export function parsearDuracion(texto: string): number | null {
  const limpio = (texto ?? "").trim()
  if (!limpio) return null

  const reloj = limpio.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/)
  if (reloj) {
    return (
      Number(reloj[1]) * 3600 + Number(reloj[2]) * 60 + Number(reloj[3] ?? 0)
    )
  }

  const decimal = Number(limpio.replace(",", "."))
  if (Number.isFinite(decimal)) return Math.round(decimal * 3600)

  return null
}

/**
 * Un formateador por huso, reutilizado entre filas: crear uno nuevo por fila
 * (10.494 filas x 2 fechas) cuesta segundos enteros; cacheado, unos cientos
 * de milisegundos.
 */
const formateadoresZona = new Map<string, Intl.DateTimeFormat>()

function formateadorZona(timeZone: string): Intl.DateTimeFormat {
  let formateador = formateadoresZona.get(timeZone)
  if (!formateador) {
    formateador = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formateadoresZona.set(timeZone, formateador)
  }
  return formateador
}

/**
 * El instante real (UTC) de una fecha+hora de pared en `timeZone`, a partir de
 * sus componentes. Mismo método que `zonedTimeToUtc` de `time.ts` -que no se
 * puede importar de ahí porque ese fichero es de solo lectura para esta
 * tarea-: se prueba el instante, se lee qué hora marcaría el reloj de esa zona
 * en ese instante y se corrige por la diferencia. Nunca suma milisegundos a
 * otro instante, que un día con cambio de hora no son siempre 86 400 000 ms.
 */
function aIso(
  fecha: [number, number, number],
  hora: [number, number, number],
  timeZone: string,
): string {
  const [y, m, d] = fecha
  const [hh, mm, ss] = hora
  const supuesto = Date.UTC(y, m - 1, d, hh, mm, ss)
  const partes = formateadorZona(timeZone).formatToParts(new Date(supuesto))
  const num = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  const comoUtc = Date.UTC(
    num("year"),
    num("month") - 1,
    num("day"),
    num("hour"),
    num("minute"),
    num("second"),
  )
  return new Date(supuesto - (comoUtc - supuesto)).toISOString()
}

/* ------------------------------------------------------------------ análisis */

function esSi(valor: string): boolean {
  const limpio = normalizar(valor ?? "")
  return ["yes", "si", "true", "1", "y"].includes(limpio)
}

/**
 * Identificador estable de cada entrada para poder reimportar el mismo informe
 * sin duplicar: Clockify no exporta el id de la entrada, así que se construye
 * con la persona y el intervalo exacto.
 *
 * Ese intervalo casi siempre es único, pero no del todo: una misma persona
 * puede tener dos filas con el mismo inicio y el mismo fin -dos huecos
 * copiados, o dos actividades distintas anotadas a mano en el mismo rato-.
 * La primera aparición de una clave dentro de un fichero se queda con el
 * formato de siempre (`persona|inicio|fin`), para no romper lo ya importado;
 * las siguientes llevan el número de aparición detrás (`|2`, `|3`...), para
 * que Clockify y hitoo cuenten las mismas horas.
 */
export function claveExterna(
  quien: string,
  inicio: string,
  fin: string,
  aparicion: number = 1,
): string {
  const base = `${quien.toLowerCase()}|${inicio}|${fin}`
  return aparicion > 1 ? `${base}|${aparicion}` : base
}

export function analizarCsv(
  texto: string,
  timeZone: string = TIMEZONE,
  forzarFormato?: FormatoFecha,
): Analisis {
  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  })

  const registros = resultado.data ?? []
  const cabeceras = resultado.meta?.fields ?? []
  const mapa = mapearCabeceras(cabeceras)

  const obligatorias: Campo[] = ["fechaInicio", "horaInicio"]
  const cabecerasFaltan = obligatorias
    .filter((c) => !mapa[c])
    .map((c) => CAMPOS[c][0])

  if (cabecerasFaltan.length > 0) {
    return { filas: [], descartadas: [], formato: "dmy", cabecerasFaltan }
  }

  const valor = (registro: Record<string, string>, campo: Campo) => {
    const clave = mapa[campo]
    return clave ? (registro[clave] ?? "").trim() : ""
  }

  const formato =
    forzarFormato ??
    detectarFormato(registros.map((r) => valor(r, "fechaInicio")))

  const filas: FilaClockify[] = []
  const descartadas: { fila: number; motivo: string }[] = []
  // Cuenta las apariciones de cada persona+inicio+fin dentro de este fichero,
  // para numerar la clave cuando se repite (ver claveExterna).
  const apariciones = new Map<string, number>()

  registros.forEach((registro, indice) => {
    const numero = indice + 2 // +1 por la cabecera, +1 para contar desde uno

    const fechaInicio = parsearFecha(valor(registro, "fechaInicio"), formato)
    const horaInicio = parsearHora(valor(registro, "horaInicio"))
    if (!fechaInicio || !horaInicio) {
      descartadas.push({ fila: numero, motivo: "Fecha u hora de inicio ilegible" })
      return
    }

    const inicio = aIso(fechaInicio, horaInicio, timeZone)

    // El fin puede venir en columnas propias o deducirse de la duración
    const fechaFin = parsearFecha(valor(registro, "fechaFin"), formato)
    const horaFin = parsearHora(valor(registro, "horaFin"))
    const duracion =
      parsearDuracion(valor(registro, "duracion")) ??
      parsearDuracion(valor(registro, "duracionDecimal"))

    let fin: string
    if (fechaFin && horaFin) {
      // Con fecha y hora propias no hace falta adivinar nada: ya vienen con
      // el día real de fin, cruce de medianoche incluido.
      fin = aIso(fechaFin, horaFin, timeZone)
    } else if (duracion !== null && duracion > 0) {
      // Sumar segundos a un instante siempre es correcto, cambie o no la hora
      // ese día: es aritmética de reloj real, no de reloj de pared.
      fin = new Date(new Date(inicio).getTime() + duracion * 1000).toISOString()
    } else {
      descartadas.push({ fila: numero, motivo: "Sin hora de fin ni duración" })
      return
    }

    const segundos = Math.round(
      (new Date(fin).getTime() - new Date(inicio).getTime()) / 1000,
    )

    if (segundos < 0) {
      descartadas.push({ fila: numero, motivo: "El fin es anterior al inicio" })
      return
    }
    if (segundos === 0) {
      descartadas.push({ fila: numero, motivo: "Duración cero" })
      return
    }

    const email = valor(registro, "email").toLowerCase()
    const usuario = valor(registro, "usuario")
    const persona = email || usuario || "?"

    const base = claveExterna(persona, inicio, fin)
    const veces = (apariciones.get(base) ?? 0) + 1
    apariciones.set(base, veces)

    filas.push({
      fila: numero,
      usuario,
      email,
      area: valor(registro, "area"),
      proyecto: valor(registro, "proyecto"),
      tarea: valor(registro, "tarea"),
      descripcion: valor(registro, "descripcion"),
      etiquetas: valor(registro, "etiquetas")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      facturable: esSi(valor(registro, "facturable")),
      inicio,
      fin,
      segundos,
      clave: veces > 1 ? claveExterna(persona, inicio, fin, veces) : base,
    })
  })

  return { filas, descartadas, formato, cabecerasFaltan: [] }
}

/** Las personas distintas que aparecen en el informe, con su email si lo trae. */
export function personasDe(filas: FilaClockify[]) {
  const mapa = new Map<string, { clave: string; nombre: string; email: string; filas: number }>()
  for (const fila of filas) {
    const clave = (fila.email || fila.usuario || "?").toLowerCase()
    const previo = mapa.get(clave)
    if (previo) previo.filas += 1
    else
      mapa.set(clave, {
        clave,
        nombre: fila.usuario || fila.email || "Sin nombre",
        email: fila.email,
        filas: 1,
      })
  }
  return [...mapa.values()].sort((a, b) => b.filas - a.filas)
}

/* ------------------------------------------------------------- varios ficheros */

export type FicheroAnalizado = {
  nombre: string
  analisis: Analisis
}

export type ResumenFichero = {
  nombre: string
  filas: number
  descartadas: number
  /** null si el fichero no trae ninguna fila valida. */
  desde: string | null
  hasta: string | null
}

/**
 * "Nombre, filas, primera y última fecha, descartadas" de un fichero ya
 * analizado. La fecha es la del huso del espacio -recortar el ISO se queda
 * en UTC y desplaza un día los ratos de madrugada-.
 */
export function resumenDeFichero(
  fichero: FicheroAnalizado,
  timeZone: string = TIMEZONE,
): ResumenFichero {
  const fechas = fichero.analisis.filas
    .map((f) => toDateKeyInZone(new Date(f.inicio), timeZone))
    .sort()
  return {
    nombre: fichero.nombre,
    filas: fichero.analisis.filas.length,
    descartadas: fichero.analisis.descartadas.length,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
  }
}

/**
 * Junta las filas válidas de varios ficheros -uno por tramo de un año, que es
 * lo máximo que exporta Clockify gratis de una vez-. Lo que se repite entre
 * ficheros -misma clave: misma persona, mismo inicio, mismo fin- cuenta una
 * vez, gana el primer fichero que la trae. El día de corte entre dos
 * exportaciones sale en las dos, así que esto es lo que evita contarlo doble.
 */
export function combinarFicheros(ficheros: FicheroAnalizado[]): {
  filas: FilaClockify[]
  repetidasEntreFicheros: number
} {
  const vistas = new Set<string>()
  const filas: FilaClockify[] = []
  let repetidasEntreFicheros = 0

  for (const fichero of ficheros) {
    for (const fila of fichero.analisis.filas) {
      if (vistas.has(fila.clave)) {
        repetidasEntreFicheros++
        continue
      }
      vistas.add(fila.clave)
      filas.push(fila)
    }
  }

  return { filas, repetidasEntreFicheros }
}

/* -------------------------------------------------------------------- catalogo */

export type NuevoProyecto = { nombre: string; area: string | null }
export type NuevaTarea = { nombre: string; proyecto: string }

export type CatalogoFaltante = {
  areas: string[]
  proyectos: NuevoProyecto[]
  tareas: NuevaTarea[]
  etiquetas: string[]
}

/**
 * Qué áreas, proyectos, tareas y etiquetas hacen falta crear para estas filas,
 * de lo que no está ya en el catálogo del espacio. La usan tanto el resumen de
 * antes de importar como la propia importación, para que el número prometido
 * y lo que de verdad se crea sea siempre el mismo.
 *
 * Compara sin mayúsculas ni tildes -el «estilo de texto» de Ajustes puede
 * haber pasado lo que ya había a mayúsculas- y, si el mismo nombre aparece con
 * grafías distintas dentro del propio informe (« Área», «area», «ÁREA»), se
 * crea una sola vez, con la primera grafía que aparece.
 *
 * Las tareas se comparan por nombre de proyecto, no por su id: un proyecto
 * nuevo en esta misma importación todavía no tiene id.
 */
export function catalogoFaltante(
  filas: FilaClockify[],
  catalogo: Pick<Catalogo, "categorias" | "proyectos" | "tareas" | "etiquetas">,
): CatalogoFaltante {
  const areasExistentes = new Set(
    catalogo.categorias.filter((c) => !c.parent_id).map((c) => normalizar(c.name)),
  )
  const proyectosExistentes = new Set(catalogo.proyectos.map((p) => normalizar(p.name)))
  const etiquetasExistentes = new Set(catalogo.etiquetas.map((t) => normalizar(t.name)))
  const proyectoPorId = new Map(catalogo.proyectos.map((p) => [p.id, p.name]))
  const tareasExistentes = new Set(
    catalogo.tareas.map((t) => {
      const proyecto = proyectoPorId.get(t.project_id)
      return `${proyecto ? normalizar(proyecto) : t.project_id}|${normalizar(t.name)}`
    }),
  )

  const areas = new Map<string, string>()
  const proyectos = new Map<string, NuevoProyecto>()
  const tareas = new Map<string, NuevaTarea>()
  const etiquetas = new Map<string, string>()

  for (const fila of filas) {
    const area = fila.area.trim()
    if (area) {
      const n = normalizar(area)
      if (!areasExistentes.has(n) && !areas.has(n)) areas.set(n, area)
    }
    for (const etiqueta of fila.etiquetas) {
      const t = etiqueta.trim()
      if (!t) continue
      const n = normalizar(t)
      if (!etiquetasExistentes.has(n) && !etiquetas.has(n)) etiquetas.set(n, t)
    }
  }

  for (const fila of filas) {
    const proyecto = fila.proyecto.trim()
    if (!proyecto) continue
    const n = normalizar(proyecto)
    if (!proyectosExistentes.has(n) && !proyectos.has(n)) {
      proyectos.set(n, { nombre: proyecto, area: fila.area.trim() || null })
    }
  }

  for (const fila of filas) {
    const proyecto = fila.proyecto.trim()
    const tarea = fila.tarea.trim()
    if (!proyecto || !tarea) continue
    const clave = `${normalizar(proyecto)}|${normalizar(tarea)}`
    if (!tareasExistentes.has(clave) && !tareas.has(clave)) {
      tareas.set(clave, { nombre: tarea, proyecto })
    }
  }

  return {
    areas: [...areas.values()],
    proyectos: [...proyectos.values()],
    tareas: [...tareas.values()],
    etiquetas: [...etiquetas.values()],
  }
}
