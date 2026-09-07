"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Loader2, TriangleAlert } from "lucide-react"

import { crearPago, abrirPortal, canjearCodigo } from "@/app/(app)/gestion/suscripcion/acciones"
import type { EstadoSuscripcion } from "@/lib/suscripcion"
import { PRECIO } from "@/lib/empresa"
import { TIMEZONE, formatDateLong, toDateKeyInZone } from "@/lib/time"

/**
 * La fecha en palabras, en minuscula: aqui siempre va dentro de una frase
 * -"hasta el martes, 15 de septiembre"- y formatDateLong viene con la
 * primera en mayuscula porque se hizo para titulares.
 */
function enPalabras(iso: string | null) {
  if (!iso) return null
  const largo = formatDateLong(toDateKeyInZone(new Date(iso), TIMEZONE))
  return largo.charAt(0).toLowerCase() + largo.slice(1)
}

/** Una frase por situación. Nada de tablas de estados: se lee y ya está. */
function comoEsta(s: EstadoSuscripcion) {
  switch (s.estado) {
    case "cortesia":
      return "Este espacio no paga: está de cortesía, sin caducidad."
    case "pagando":
      return s.cancelaAlFinal
        ? `Suscrito, pero cancelado: se acaba el ${enPalabras(s.finPeriodo)}.`
        : `Suscrito. El siguiente cobro es el ${enPalabras(s.finPeriodo)}.`
    case "fallo_cobro":
      return "No se ha podido cobrar la última cuota. Stripe lo reintenta unos días; si la tarjeta ha caducado, cámbiala."
    case "prueba":
      return s.diasRestantes === 1
        ? "Queda un día de prueba."
        : `Quedan ${s.diasRestantes} días de prueba, hasta el ${enPalabras(s.finPrueba)}.`
    case "caducada":
      return "La prueba se ha acabado. Las horas siguen aquí y se pueden exportar, pero no se apuntan nuevas hasta que se suscriba el espacio."
  }
}

export function GestionSuscripcion({ suscripcion }: { suscripcion: EstadoSuscripcion }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [codigo, setCodigo] = useState("")
  const [aviso, setAviso] = useState<string | null>(null)
  const [yendo, empezar] = useTransition()

  const puedeCanjear = suscripcion.estado === "prueba" || suscripcion.estado === "caducada"
  const tienePago = Boolean(suscripcion.clienteStripe)

  function irA(trabajo: () => Promise<{ url: string } | { error: string }>) {
    setError(null)
    empezar(async () => {
      const salida = await trabajo()
      if ("error" in salida) {
        setError(salida.error)
        return
      }
      // Checkout y portal viven en Stripe, no dentro de la app.
      window.location.href = salida.url
    })
  }

  function usarCodigo() {
    setError(null)
    setAviso(null)
    empezar(async () => {
      const salida = await canjearCodigo(codigo)
      if ("error" in salida) {
        setError(salida.error)
        return
      }
      setCodigo("")
      setAviso(`Prueba ampliada hasta el ${enPalabras(salida.finPrueba)}.`)
      router.refresh()
    })
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">La cuota</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted">{comoEsta(suscripcion)}</p>

      {suscripcion.estado === "caducada" && (
        <p className="mb-3 flex items-start gap-2 rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Ahora mismo el equipo no puede apuntar horas.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {aviso && (
        <p className="mb-3 rounded-[var(--radio-sm)] bg-surface-2 p-2.5 text-sm">{aviso}</p>
      )}

      <div className="rounded-[var(--radio)] border border-line p-3">
        <p className="text-sm">
          <span className="cifra text-base font-medium">{PRECIO.euros} €</span> al mes más
          IVA, por equipo. Hasta {PRECIO.personas} personas, entren cinco o veinte.
        </p>
        <p className="mt-1 text-sm text-muted">
          Se cancela cuando quieras desde aquí mismo, y al cancelar no se borra
          nada: las horas se siguen viendo y exportando.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suscripcion.estado !== "pagando" && suscripcion.estado !== "cortesia" && (
          <button
            type="button"
            onClick={() => irA(crearPago)}
            disabled={yendo}
            className="btn btn-primary"
          >
            {yendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Suscribir el espacio
          </button>
        )}

        {tienePago && (
          <button
            type="button"
            onClick={() => irA(abrirPortal)}
            disabled={yendo}
            className="btn btn-ghost"
          >
            Tarjeta, facturas y baja
          </button>
        )}
      </div>

      {puedeCanjear && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            usarCodigo()
          }}
          className="mt-4 border-t border-line pt-4"
        >
          <span className="label">¿Tienes un código?</span>
          <div className="flex gap-2">
            <input
              className="field"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="LEINNHITOO"
              aria-label="Código para alargar la prueba"
            />
            <button
              type="submit"
              disabled={yendo || !codigo.trim()}
              className="btn btn-ghost shrink-0"
            >
              Usarlo
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
