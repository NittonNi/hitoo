/** Cuentas de la rejilla del calendario: minutos a pixeles y reparto de solapes. */

import { addDays, fromDateKey, toDateKey } from "@/lib/time"
import type { EntradaVista } from "@/lib/tipos"

/** Alto de una hora, en pixeles. Todo lo demas se deriva de aquí. */
export const ALTO_HORA = 52
export const MINUTOS_PASO = 15
export const ALTO_PASO = (ALTO_HORA / 60) * MINUTOS_PASO

export type Bloque = {
  entrada: EntradaVista
  /** minutos desde medianoche */
  desde: number
  hasta: number
  /** reparto horizontal cuando varias entradas se pisan */
  columna: number
  columnas: number
  /**
   * El final de verdad, contado desde la medianoche de ESTE dia: pasa de 1440
   * cuando el rato sigue de madrugada. `hasta` es solo lo que se dibuja, que se
   * para a medianoche; lo que se guarda tiene que salir de aqui o se pierden
   * las horas de la madrugada.
   */
  finReal: number
  /** El rato empezo el dia anterior: este trozo es la continuacion. */
  vieneDeAyer: boolean
  /** El rato sigue despues de medianoche: se pinta un +1. */
  sigueManana: boolean
}

export function minutosDe(iso: string): number {
  const fecha = new Date(iso)
  return fecha.getHours() * 60 + fecha.getMinutes()
}

export function redondear(minutos: number): number {
  return Math.round(minutos / MINUTOS_PASO) * MINUTOS_PASO
}

export function limitar(minutos: number): number {
  return Math.max(0, Math.min(24 * 60, minutos))
}

/** "9:30" a partir de minutos desde medianoche. */
export function comoHora(minutos: number): string {
  const m = limitar(Math.round(minutos))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

/** "09:30", para los <input type="time"> */
export function comoHoraInput(minutos: number): string {
  const m = limitar(Math.round(minutos))
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Cuantos dias de calendario van de una fecha "2026-09-10" a otra. */
function diasEntre(desde: string, hasta: string): number {
  // Las dos a mediodia: un dia de 23 o 25 horas no llega a torcer el redondeo
  return Math.round((fromDateKey(hasta).getTime() - fromDateKey(desde).getTime()) / 86_400_000)
}

/**
 * Los trozos que le tocan a un dia. Un rato de las nueve de la noche a las dos
 * de la madrugada no es un dia: son dos trozos, de 21:00 a 24:00 en el primero
 * y de 00:00 a 02:00 en el siguiente. Asi se ve donde se trabajo de verdad.
 */
function trozosDelDia(entradas: EntradaVista[], dia: string) {
  /* Ojo: `fromDateKey` devuelve ese dia al mediodia -asi no se lia con los
     cambios de hora-, y aqui hacen falta las dos medianoches de verdad. */
  const empiezaElDia = fromDateKey(dia)
  empiezaElDia.setHours(0, 0, 0, 0)
  const empiezaManana = addDays(empiezaElDia, 1)
  empiezaManana.setHours(0, 0, 0, 0)

  return entradas.flatMap((entrada) => {
    if (!entrada.end_at) return []

    const inicio = new Date(entrada.start_at)
    const fin = new Date(entrada.end_at)
    // Fuera del dia: ni empieza, ni sigue, ni termina aqui
    if (fin <= empiezaElDia || inicio >= empiezaManana) return []

    const vieneDeAyer = inicio < empiezaElDia
    // Ojo: terminar justo a medianoche no es seguir al dia siguiente, pero el
    // bloque llega igual hasta abajo del todo.
    const acabaEnMedianoche = fin >= empiezaManana
    const sigueManana = fin > empiezaManana

    /* Minutos de reloj mas los dias enteros que se lleve por delante. De
       reloj, no de cronometro: contando milisegundos desde la medianoche, el
       dia del cambio de hora el fin salia una hora descolocado respecto a
       `desde` -que si es de reloj-, y al cogerlo para moverlo el bloque
       ganaba o perdia una hora sin avisar. */
    const finReal = vieneDeAyer
      ? minutosDe(entrada.end_at)
      : minutosDe(entrada.end_at) + diasEntre(dia, toDateKey(fin)) * 24 * 60

    return [
      {
        entrada,
        desde: vieneDeAyer ? 0 : minutosDe(entrada.start_at),
        hasta: acabaEnMedianoche ? 24 * 60 : minutosDe(entrada.end_at),
        finReal,
        columna: 0,
        columnas: 1,
        vieneDeAyer,
        sigueManana,
      },
    ]
  })
}

/**
 * Reparte en columnas las entradas que se pisan, como hace un calendario: se
 * agrupan las que se solapan entre si y dentro del grupo cada una se queda con
 * la primera columna libre.
 */
export function repartir(entradas: EntradaVista[], dia: string): Bloque[] {
  const bloques = trozosDelDia(entradas, dia).sort(
    (a, b) => a.desde - b.desde || b.hasta - a.hasta,
  )

  let grupo: Bloque[] = []
  let finDelGrupo = -1

  const cerrarGrupo = () => {
    for (const bloque of grupo) bloque.columnas = Math.max(...grupo.map((b) => b.columna + 1))
    grupo = []
  }

  for (const bloque of bloques) {
    if (bloque.desde >= finDelGrupo && grupo.length > 0) {
      cerrarGrupo()
      finDelGrupo = -1
    }

    // primera columna que no choque con nadie del grupo
    let columna = 0
    while (
      grupo.some((otro) => otro.columna === columna && otro.hasta > bloque.desde)
    ) {
      columna += 1
    }
    bloque.columna = columna
    grupo.push(bloque)
    finDelGrupo = Math.max(finDelGrupo, bloque.hasta)
  }
  if (grupo.length > 0) cerrarGrupo()

  return bloques
}

/**
 * La rejilla siempre pinta el dia entero: si se recortara a lo ya apuntado no
 * se podrian añadir horas fuera de esa franja, que es justo lo que hace falta
 * el dia que se empieza antes o se acaba más tarde de lo normal.
 */
export const DIA_ENTERO = { desde: 0, hasta: 24 * 60 }

/**
 * A que hora conviene dejar el scroll al abrir: una hora antes de lo más
 * temprano que haya, y si no hay nada, a las siete.
 */
/**
 * Por donde abrir la semana. Una sola hora apuntada de madrugada no puede
 * mandar a todo el mundo a las 00:00: solo se baja hasta ahi si la mitad de la
 * semana es de madrugada de verdad.
 */
export function horaParaEmpezar(bloques: Bloque[]): number {
  if (bloques.length === 0) return 7 * 60

  const primera = Math.min(...bloques.map((b) => b.desde))
  const unaHoraAntes = Math.max(0, Math.floor((primera - 60) / 60) * 60)
  if (primera >= 6 * 60) return unaHoraAntes

  const madrugadores = bloques.filter((b) => b.desde < 6 * 60).length
  return madrugadores * 2 >= bloques.length ? unaHoraAntes : 6 * 60
}

/** "09:30" -> 570. Devuelve null si el campo esta a medias. */
export function minutosDeHora(valor: string): number | null {
  const trozos = valor.match(/^(\d{1,2}):(\d{2})$/)
  if (!trozos) return null
  const horas = Number(trozos[1])
  const minutos = Number(trozos[2])
  if (horas > 23 || minutos > 59) return null
  return horas * 60 + minutos
}
