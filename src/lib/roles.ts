import type { Enums } from "@/lib/database.types"

/**
 * Roles dentro de un espacio de trabajo. Vive aparte de `sesión.ts` a
 * proposito: eso es código de servidor (lee cookies) y esto lo necesitan
 * también los componentes de cliente.
 */
export type Rol = Enums<"user_role">

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  manager: "Responsable",
  member: "Miembro",
  coach: "Coach",
}

/** Admin, responsable o coach: ven las horas de todo el equipo y los importes. */
export function veTodo(rol: Rol) {
  return rol === "admin" || rol === "manager" || rol === "coach"
}

/**
 * Admin o responsable: además de verlo, lo cambian (catálogo, cierres, plazas).
 * El coach ve lo mismo sin tocar nada, y la base lo impide también
 * (`puede_tocar`), no solo la interfaz.
 */
export function puedeGestionar(rol: Rol) {
  return rol === "admin" || rol === "manager"
}

/** El coach mira el equipo sin apuntar horas ni cambiar las de nadie. */
export function soloMira(rol: Rol) {
  return rol === "coach"
}

export function esAdmin(rol: Rol) {
  return rol === "admin"
}
