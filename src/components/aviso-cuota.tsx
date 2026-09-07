import Link from "next/link"

import type { EstadoSuscripcion } from "@/lib/suscripcion"
import type { Rol } from "@/lib/roles"

/**
 * La tira que avisa de la cuota. Sale solo cuando hay algo que hacer -prueba
 * a punto de acabarse, cobro fallido o prueba acabada-, nunca para decir que
 * todo va bien: un aviso permanente deja de leerse a la semana.
 *
 * A quien no administra no se le manda a una pantalla que no puede usar; se
 * le dice a quien avisar.
 */
export function AvisoCuota({
  suscripcion,
  rol,
}: {
  suscripcion: EstadoSuscripcion
  rol: Rol
}) {
  const { estado, diasRestantes } = suscripcion
  const acabandose = estado === "prueba" && diasRestantes !== null && diasRestantes <= 7

  if (!acabandose && estado !== "caducada" && estado !== "fallo_cobro") return null

  const grave = estado === "caducada" || estado === "fallo_cobro"
  const esAdmin = rol === "admin"

  const texto =
    estado === "caducada"
      ? "Se acabó la prueba: las horas siguen aquí, pero no se pueden apuntar nuevas."
      : estado === "fallo_cobro"
        ? "No se ha podido cobrar la última cuota."
        : diasRestantes === 1
          ? "Queda un día de prueba."
          : `Quedan ${diasRestantes} días de prueba.`

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radio)] p-3 text-sm ${
        grave ? "bg-danger-soft text-danger" : "bg-surface-2"
      }`}
    >
      <span>{texto}</span>
      {esAdmin ? (
        <Link href="/gestion/suscripcion" className="font-medium underline">
          Ver la cuota
        </Link>
      ) : (
        <span className="text-muted">Habla con quien administra el espacio.</span>
      )}
    </div>
  )
}
