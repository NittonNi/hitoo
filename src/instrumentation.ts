import { TIMEZONE } from "@/lib/time"

/**
 * El servidor de Vercel corre en UTC y el equipo mira desde Madrid. Lo que un
 * componente pinta con la hora local del proceso (el horario de una hora, el
 * sitio de un bloque en el calendario) salía dos horas distinto en el servidor
 * y en el navegador, y React tiraba el HTML y volvía a pintar la página entera
 * (error 418). Con el proceso en la misma zona que los espacios, coinciden.
 * Es la red de abajo: lo que depende del espacio sigue pasando `espacio.timezone`.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = TIMEZONE
}
