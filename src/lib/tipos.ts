import type { Enums, Tables } from "@/lib/database.types"
import type { Rol } from "@/lib/roles"

export type Perfil = Tables<"profiles">
export type Espacio = Tables<"workspaces">

/** Un espacio al que pertenezco, con el rol que tengo allí. */
export type Pertenencia = { espacio: Espacio; rol: Rol }

export type Sesion = {
  perfil: Perfil
  espacio: Espacio
  rol: Rol
  /** Todos a los que pertenezco, para el selector de la cabecera. */
  espacios: Pertenencia[]
}

export type Proyecto = Tables<"projects">
export type Tarea = Tables<"tasks">
export type Categoria = Tables<"categories">
export type Edicion = Tables<"project_editions">
export type Etiqueta = Tables<"tags">
export type Entrada = Tables<"time_entries">
export type Tarifa = Tables<"rates">
export type Invitacion = Tables<"invitations">
export type ConexionGoogle = Tables<"google_connections">

/** Como se reparte la facturacion ya calculada entre las personas. */
export type ModoReparto = "horas" | "equitativo" | "porcentajes" | "equipo"
export type Reparto = Omit<Tables<"revenue_splits">, "mode"> & { mode: ModoReparto }
export type RepartoShare = Tables<"revenue_split_shares">

/** Una persona dentro de un espacio concreto: su perfil más su rol allí. */
export type Miembro = {
  id: string
  full_name: string
  email: string
  role: Enums<"user_role">
  active: boolean
}

/** Fila de la vista v_entries, con los campos ya no nulos donde el SQL lo garantiza. */
export type EntradaVista = {
  id: string
  workspace_id: string
  user_id: string
  user_name: string
  /** Quien la toco por ultima vez, si no fue quien la apunto. */
  updated_by: string | null
  updated_by_name: string | null
  project_id: string | null
  project_name: string | null
  project_color: string | null
  category_id: string | null
  category_name: string | null
  subcategory_name: string | null
  edition_id: string | null
  edition_name: string | null
  task_id: string | null
  task_name: string | null
  description: string
  start_at: string
  end_at: string | null
  local_date: string
  duration_seconds: number | null
  hours: number | null
  billable: boolean
  locked: boolean
  tags: string[]
  /** A quien mas le cuentan estas horas, y como lo lleva cada uno. */
  compartida_con: { nombre: string; estado: EstadoPropuesta }[]
  /**
   * De quien vino este rato, si es una propuesta que aceptaste y sigue siendo
   * el mismo: mismo dia, misma hora, mismo proyecto y mismo texto. En cuanto
   * uno de los dos lo cambia deja de ser el mismo rato y esto se queda vacio.
   */
  venida_de: string | null
  /** Su id: a quien te propuso un rato no se le puede proponer de vuelta. */
  venida_de_id: string | null
  amount: number | null
}

/** Una propuesta se manda, y la otra persona la acepta o la rechaza. */
export type EstadoPropuesta = "pendiente" | "aceptada" | "rechazada"

/** Catalogo que necesita el selector de proyecto/tarea/etiqueta. */
export type Catalogo = {
  proyectos: Proyecto[]
  tareas: Tarea[]
  etiquetas: Etiqueta[]
  /** Arbol de dos niveles: las de primer nivel llevan parent_id nulo. */
  categorias: Categoria[]
  /** Ediciones de los proyectos que se repiten (TBCE 1, TBCE 2...). */
  ediciones: Edicion[]
}

/** Una rama de la categorizacion con su camino ya montado, para pintarla. */
export type RamaCategoria = {
  categoria: Categoria
  padre: Categoria | null
  /** "Backoffice" o "Proyectos / Eventos". */
  camino: string
}

export type EntradaEnMarcha = {
  id: string
  workspace_id: string
  project_id: string | null
  edition_id: string | null
  task_id: string | null
  description: string
  start_at: string
  billable: boolean
  proyecto: { id: string; name: string; color: string } | null
  tarea: { id: string; name: string } | null
  tagIds: string[]
}

/**
 * Un rato que se paró con «Pausar»: la hora ya quedó cerrada y guardada, y
 * esto es solo lo que hace falta para que «Seguir» arranque otra igual
 * (mismo proyecto, edición, tarea, descripción, facturable y etiquetas).
 */
export type EntradaPausada = {
  /** El id de la hora ya cerrada, para deshacer «Quitar la pausa». */
  entryId: string
  project_id: string | null
  edition_id: string | null
  task_id: string | null
  description: string
  start_at: string
  end_at: string
  billable: boolean
  proyecto: { id: string; name: string; color: string } | null
  tarea: { id: string; name: string } | null
  tagIds: string[]
}

/** Lo que hace falta para arrancar o guardar una entrada. */
export type BorradorEntrada = {
  project_id: string | null
  edition_id: string | null
  task_id: string | null
  description: string
  billable: boolean
  tagIds: string[]
}

export const BORRADOR_VACIO: BorradorEntrada = {
  project_id: null,
  edition_id: null,
  task_id: null,
  description: "",
  billable: false,
  tagIds: [],
}

/**
 * Colores de proyecto: una rueda completa pero toda a la misma saturacion y
 * luminosidad, para que ninguno grite más que los demas y todos se lean igual
 * de bien sobre papel claro y sobre oscuro. Se evita el naranja de la señal.
 */
export const COLORES_PROYECTO = [
  "#3d6fb4",
  "#2f7fa6",
  "#2e8481",
  "#3f8558",
  "#6d8a34",
  "#9a7b22",
  "#9c5a2c",
  "#b24a3e",
  "#a34468",
  "#7b5aa6",
  "#566b85",
  "#7a6a5d",
] as const

/** Husos con los que trabaja la gente que va a usar esto. */
export const ZONAS_HORARIAS = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "UTC",
] as const
