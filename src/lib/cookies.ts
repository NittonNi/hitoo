/**
 * Nombres de cookies que leen a la vez el servidor y el navegador.
 *
 * Viven aquí y no junto al componente que las escribe por un motivo que costó
 * un rato: una constante exportada desde un módulo `"use client"` no llega al
 * servidor como su valor, sino como una referencia de cliente, así que
 * `cookies().get(...)` no encontraba nada aunque la cookie sí estuviera.
 */

/** "Llévame directo a mi espacio en vez de a la portada." */
export const COOKIE_DIRECTO = "directo"

/**
 * "El menú de la izquierda, plegado en iconos." La lee el layout de (app) para
 * que la barra salga del servidor ya estrecha y no se vea ancha un instante.
 */
export const COOKIE_MENU_PLEGADO = "menu-plegado"

/**
 * "El aviso de días sin apuntar, omitido esta semana en estos espacios." La lee
 * la página del cronómetro para no pintarlo; el formato está en semana-omitida.ts.
 */
export const COOKIE_SEMANA_OMITIDA = "semana-omitida"
