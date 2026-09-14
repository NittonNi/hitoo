/**
 * Supabase corta cada respuesta de PostgREST en 1000 filas (`max_rows`), sin
 * error ni aviso: un `.limit(50000)` también se queda en 1000. Con el histórico
 * de un equipo de verdad (NITTON: unas 11.000 horas al año) las estadísticas
 * salían con una fracción de las horas. Todo lo que pueda pasar de ahí se pide
 * por páginas.
 */
export const FILAS_POR_PAGINA = 1000

/** Páginas que se piden a la vez, pasada la primera. */
const EN_PARALELO = 4

type Pagina<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * Parte [desde, hasta] -claves de día, ambas incluidas- en quincenas (del 1 al
 * 15 y del 16 a fin de mes), de la más reciente a la más antigua.
 *
 * Existe porque paginar `v_entries` con `range()` sobre dos años no aguanta:
 * Postgres une y ordena todas las filas del periodo antes de devolver la
 * primera página, y cada página más adentro calcula también las que se salta.
 * Con NITTON (22.000 horas) saltaba el tiempo máximo de la consulta. Una
 * quincena tira del índice por fecha y cabe casi siempre en una página.
 */
export function quincenas(desde: string, hasta: string): [string, string][] {
  const tramos: [string, string][] = []
  let [anio, mes, dia] = desde.split("-").map(Number)
  const clave = (a: number, m: number, d: number) =>
    `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

  while (clave(anio, mes, dia) <= hasta) {
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const fin = clave(anio, mes, dia <= 15 ? 15 : ultimo)
    tramos.push([clave(anio, mes, dia), fin < hasta ? fin : hasta])
    if (dia <= 15) {
      dia = 16
    } else {
      dia = 1
      mes = mes === 12 ? 1 : mes + 1
      if (mes === 1) anio++
    }
  }
  return tramos.reverse()
}

/** Ejecuta las tareas de `cuantas` en `cuantas`, conservando el orden del resultado. */
export async function porTandas<T>(tareas: (() => Promise<T>)[], cuantas = 5): Promise<T[]> {
  const resultado: T[] = []
  for (let i = 0; i < tareas.length; i += cuantas) {
    resultado.push(...(await Promise.all(tareas.slice(i, i + cuantas).map((t) => t()))))
  }
  return resultado
}

/**
 * Todas las filas de una consulta, página a página. `pedir(desde, hasta)` tiene
 * que devolver la consulta con `.range(desde, hasta)` y un orden que no empate
 * -acabado en el id-, o dos páginas pueden repetir o saltarse filas.
 *
 * La primera página va sola, que casi siempre basta; si viene llena, el resto
 * se pide de cuatro en cuatro hasta que una llegue incompleta.
 */
export async function traerTodo<T>(
  pedir: (desde: number, hasta: number) => Pagina<T>,
): Promise<T[]> {
  const primera = await pedir(0, FILAS_POR_PAGINA - 1)
  if (primera.error) throw primera.error
  const filas = [...(primera.data ?? [])]
  if (filas.length < FILAS_POR_PAGINA) return filas

  for (let desde = FILAS_POR_PAGINA; ; desde += EN_PARALELO * FILAS_POR_PAGINA) {
    const paginas = await Promise.all(
      Array.from({ length: EN_PARALELO }, (_, i) => {
        const inicio = desde + i * FILAS_POR_PAGINA
        return pedir(inicio, inicio + FILAS_POR_PAGINA - 1)
      }),
    )
    for (const pagina of paginas) {
      if (pagina.error) throw pagina.error
      filas.push(...(pagina.data ?? []))
    }
    if (paginas.some((p) => (p.data?.length ?? 0) < FILAS_POR_PAGINA)) return filas
  }
}
