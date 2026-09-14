/**
 * Duraciones, fechas y dinero. Todo en formato español: coma decimal,
 * semana que empieza en lunes y horario de Europe/Madrid (el mismo que usa
 * la columna generada `local_date` en Postgres).
 */

export const TIMEZONE = "Europe/Madrid"

/* ---------------------------------------------------------- husos horarios */

/** Los campos de un instante tal y como se leen en el reloj de pared de `timeZone`. */
function wallClockParts(date: Date, timeZone: string) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const num = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
  }
}

/**
 * Un Date cuyos componentes locales (los que leen getFullYear/getMonth/
 * getDate/getDay/...) son la hora de pared en `timeZone` para ese instante,
 * sin importar el huso del proceso que ejecuta el código (el servidor corre
 * en UTC en producción; el navegador, en el huso de quien mira). Solo vale
 * para volver a leer esos componentes en el mismo proceso justo después: su
 * instante real (getTime, toISOString) no significa nada.
 */
function wallClockDate(date: Date, timeZone: string): Date {
  const { year, month, day, hour, minute, second } = wallClockParts(date, timeZone)
  return new Date(year, month - 1, day, hour, minute, second)
}

/** El instante real (UTC) de esa hora de pared en `timeZone`. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const supuesto = Date.UTC(year, month - 1, day, hour, minute, second)
  const en = wallClockParts(new Date(supuesto), timeZone)
  const comoUTC = Date.UTC(en.year, en.month - 1, en.day, en.hour, en.minute, en.second)
  return new Date(supuesto - (comoUTC - supuesto))
}

/**
 * `iso` más `seconds`, contados en el reloj de pared de `timeZone` y no en
 * milisegundos: un día con cambio de hora no son 24 h. Si el resultado pasa
 * de medianoche, Date.UTC lo arrastra solo al día siguiente.
 */
export function addSecondsInZone(iso: string, seconds: number, timeZone: string): string {
  const p = wallClockParts(new Date(iso), timeZone)
  return zonedTimeToUtc(
    p.year,
    p.month,
    p.day,
    p.hour,
    p.minute,
    p.second + seconds,
    timeZone,
  ).toISOString()
}

/* ---------------------------------------------------------------- duracion */

/** 5025 -> "1:23:45" */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** 5025 -> "1:23". Para totales, donde los segundos son ruido. */
/**
 * Las duraciones se leen enteras: horas, minutos y segundos. 7080 -> "01:58:00".
 * Los tramos de reloj -de 9:00 a 10:00- son otra cosa y siguen sin segundos.
 */
export function formatDurationShort(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

/** 5025 -> "1,40". Lo que se factura. */
export function formatHoursDecimal(seconds: number | null | undefined): string {
  return ((seconds ?? 0) / 3600).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function hoursDecimal(seconds: number | null | undefined): number {
  return Math.round(((seconds ?? 0) / 3600) * 10000) / 10000
}

/**
 * Acepta lo que la gente escribe de verdad:
 * "1:30" "1,5" "1.5" "90m" "1h30" "1h 30m" "45" (minutos si no hay unidad ni coma)
 * Devuelve segundos, o null si no hay forma de interpretarlo.
 */
export function parseDurationToSeconds(raw: string): number | null {
  const input = raw.trim().toLowerCase().replace(/\s+/g, "")
  if (!input) return null

  // 1:30 o 1:30:45
  const colon = input.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/)
  if (colon) {
    const [, h, m, s] = colon
    return Number(h) * 3600 + Number(m) * 60 + Number(s ?? 0)
  }

  // 1h30, 1h30m, 1h, 30m, 1h30m20s
  const units = input.match(/^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (units && (units[1] || units[2] || units[3])) {
    const h = units[1] ? Number(units[1].replace(",", ".")) : 0
    const m = units[2] ? Number(units[2]) : 0
    const s = units[3] ? Number(units[3]) : 0
    return Math.round(h * 3600 + m * 60 + s)
  }

  // 1,5 o 1.5 -> horas decimales
  const decimal = input.match(/^(\d+)[.,](\d+)$/)
  if (decimal) {
    return Math.round(Number(`${decimal[1]}.${decimal[2]}`) * 3600)
  }

  /* Un numero pelado son HORAS, igual que en el campo de la hora del reloj:
     "2" es dos horas, como "12" son las doce. Para minutos esta "45m" o
     "0:45", que es como se escribe en Clockify. */
  const bare = input.match(/^(\d+)$/)
  if (bare) return Number(bare[1]) * 3600

  return null
}

/* ------------------------------------------------------------------ dinero */

export function formatMoney(amount: number | null | undefined): string {
  return (amount ?? 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  })
}

/* ------------------------------------------------------------------ fechas */

/** Date -> "2026-08-17" en hora local, sin pasar por UTC (toISOString desplaza). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** "2026-08-17" -> Date a mediodia local, inmune a saltos de huso. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/**
 * Medianoche real (00:00, huso `timeZone`) de "2026-08-17". A diferencia de
 * fromDateKey() -que da mediodía en el huso del proceso, para comparar
 * fechas sin sustos de DST- esto es el límite real de una ventana horaria:
 * p.ej. el `desde` que se le manda a una API externa como Google Calendar.
 */
export function startOfDayInZone(key: string, timeZone: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return zonedTimeToUtc(y, m, d, 0, 0, 0, timeZone)
}

/**
 * "Hoy" en `timeZone` (por defecto Europe/Madrid). Server Components deben
 * pasar la zona horaria del workspace (`espacio.timezone`): sin ella, esta
 * función usaría el reloj del proceso, que en producción corre en UTC y
 * puede ir hasta 2 horas por detrás de "hoy" en hora local.
 */
export function todayKey(timeZone: string = TIMEZONE): string {
  return toDateKey(wallClockDate(new Date(), timeZone))
}

/**
 * Como toDateKey, pero de un instante convertido a `timeZone` en vez del
 * huso del proceso que ejecuta el código. Para timestamptz que llegan en UTC
 * desde Postgres (p.ej. start_at) cuando hace falta el día del workspace.
 */
export function toDateKeyInZone(date: Date, timeZone: string): string {
  return toDateKey(wallClockDate(date, timeZone))
}

/**
 * Lunes de la semana de `date`. Si se da `timeZone`, el día de la semana se
 * lee en esa zona horaria en vez de en la del proceso -hace falta cuando
 * `date` es "ahora mismo" y el proceso no corre en el huso del workspace-;
 * sin ella, se mantiene el comportamiento de siempre (componentes locales
 * del propio `date`, que ya viene fijado -p.ej. por fromDateKey- y no debe
 * reinterpretarse).
 */
export function startOfWeek(date: Date, timeZone?: string): Date {
  const d = timeZone ? wallClockDate(date, timeZone) : new Date(date)
  d.setHours(12, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - day)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function weekDays(anchor: Date): Date[] {
  const monday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })
}

export function formatDateLong(key: string): string {
  const date = fromDateKey(key)
  const label = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDateShort(key: string): string {
  return fromDateKey(key).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** "17:30" a partir de un timestamptz ISO. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "--:--"
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Combina "2026-08-17" + "09:30" en un ISO con el huso del navegador. */
export function combineDateAndTime(dateKey: string, clock: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const [hh, mm] = clock.split(":").map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}

/** "09:30" para rellenar un <input type="time"> */
export function toClockInput(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function relativeDayLabel(key: string): string {
  const today = todayKey()
  if (key === today) return "Hoy"
  if (key === toDateKey(addDays(new Date(), -1))) return "Ayer"
  return formatDateLong(key)
}

/** "mié, 12 jun" — corto, para la cabecera de cada día. */
export function formatDayAbbrev(key: string): string {
  return fromDateKey(key).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** "Hoy", "Ayer" o "mié, 12 jun". */
export function dayLabel(key: string): string {
  const today = todayKey()
  if (key === today) return "Hoy"
  if (key === toDateKey(addDays(new Date(), -1))) return "Ayer"
  return formatDayAbbrev(key)
}

/** El lunes de la semana de una fecha, en clave. */
export function weekKey(key: string): string {
  return toDateKey(startOfWeek(fromDateKey(key)))
}

/** "Esta semana", "Semana pasada" o "9 – 15 de junio". */
export function weekLabel(mondayKey: string): string {
  const estaSemana = toDateKey(startOfWeek(new Date()))
  if (mondayKey === estaSemana) return "Esta semana"

  const anterior = toDateKey(addDays(startOfWeek(new Date()), -7))
  if (mondayKey === anterior) return "Semana pasada"

  const lunes = fromDateKey(mondayKey)
  const domingo = addDays(lunes, 6)
  const mismoMes = lunes.getMonth() === domingo.getMonth()

  const dia = (d: Date) => d.getDate()
  const mes = (d: Date) => d.toLocaleDateString("es-ES", { month: "long" })

  return mismoMes
    ? `${dia(lunes)} – ${dia(domingo)} de ${mes(domingo)}`
    : `${dia(lunes)} de ${mes(lunes)} – ${dia(domingo)} de ${mes(domingo)}`
}

/** Un objetivo en minutos, escrito como el resto de duraciones: "08:00:00". */
export function formatObjetivoCorto(minutos: number): string {
  return formatDurationShort(minutos * 60)
}

/**
 * Lo que se teclee, entendido como una hora del reloj y devuelto en "HH:MM".
 * Es la manera de Clockify: "9" son las nueve, "930" las nueve y media, "21"
 * las nueve de la noche y "9pm" tambien. Devuelve null si no hay forma de
 * entenderlo, y entonces el campo se queda como estaba.
 *
 *   9      -> 09:00        930    -> 09:30
 *   21     -> 21:00        0930   -> 09:30
 *   9:3    -> 09:30        9.30   -> 09:30
 *   9pm    -> 21:00        12am   -> 00:00
 */
export function interpretarHora(bruto: string): string | null {
  const limpio = bruto.trim().toLowerCase().replace(/\s/g, "")
  if (!limpio) return null

  // La tarde y la mañana a la inglesa, por si se copia de otro sitio
  const tarde = /(p\.?m\.?)$/.test(limpio)
  const manana = /(a\.?m\.?)$/.test(limpio)
  const sinSufijo = limpio.replace(/(a|p)\.?m\.?$/, "")

  // Los separadores dan igual: dos puntos, punto, coma o la hache
  const trozos = sinSufijo.split(/[:.,h]/).filter((t) => t !== "")
  if (trozos.some((t) => !/^\d+$/.test(t))) return null

  let horas: number
  let minutos = 0

  if (trozos.length >= 2) {
    horas = Number(trozos[0])
    // "9:3" son y media, no y tres: se lee como decenas
    minutos = trozos[1].length === 1 ? Number(trozos[1]) * 10 : Number(trozos[1])
  } else if (trozos.length === 1) {
    const digitos = trozos[0]
    if (digitos.length <= 2) {
      horas = Number(digitos)
    } else if (digitos.length === 3) {
      horas = Number(digitos.slice(0, 1))
      minutos = Number(digitos.slice(1))
    } else if (digitos.length === 4) {
      horas = Number(digitos.slice(0, 2))
      minutos = Number(digitos.slice(2))
    } else {
      return null
    }
  } else {
    return null
  }

  if (tarde && horas < 12) horas += 12
  if (manana && horas === 12) horas = 0

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null
  if (horas > 23 || minutos > 59) return null

  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`
}
