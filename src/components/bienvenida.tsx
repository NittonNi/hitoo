"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Building2, LogOut, Mail, Plus } from "lucide-react"

import { useCambioEspacio } from "@/components/cambio-espacio"
import { EsqueletoMarco } from "@/components/esqueleto-marco"
import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { NOMBRE_ROL } from "@/lib/roles"
import type { Pertenencia, Perfil } from "@/lib/tipos"
import type { Enums } from "@/lib/database.types"

type Disponible = {
  id: string
  name: string
  slug: string
  motivo: string
  role: Enums<"user_role">
}

export function Bienvenida({
  perfil,
  pertenencias,
  disponibles,
}: {
  perfil: Perfil
  pertenencias: Pertenencia[]
  disponibles: Disponible[]
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Aqui no hay avisos abajo a la derecha -ProveedorAvisos vive en el layout
     de (app)-, asi que el fallo va a la linea de error de la propia pagina */
  const { cambiando, cambiar } = useCambioEspacio(() => {
    setOcupado(false)
    setError("No se ha podido entrar en ese espacio. Prueba otra vez.")
  })

  function entrar(id: string) {
    setError(null)
    cambiar(id)
  }

  async function unirse(id: string) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.rpc("join_workspace", { p_workspace: id })
    if (err) {
      setOcupado(false)
      setError(mensajeError(err))
      return
    }
    entrar(id)
  }

  /* Entrar siempre acaba en el panel: mientras llega se ve ya su marco en
     esqueleto, el mismo que pinta el layout de (app) al cargar, asi que el
     relevo no salta. Si falla, la transicion acaba y vuelve la lista con el
     error. */
  if (cambiando) return <EsqueletoMarco />

  return (
    <main className="tema-claro mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marca */}
        <img src="/hitoo-logo.svg" alt="hitoo" className="mx-auto mb-4 h-6 w-auto" />
        <h1 className="text-xl font-semibold tracking-tight">
          Hola, {perfil.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {pertenencias.length > 0
            ? "Elige dónde quieres trabajar."
            : "Monta el espacio de tu equipo para empezar a contar horas."}
        </p>
      </div>

      {pertenencias.length > 0 && (
        <section className="card mb-4 p-2">
          <ul>
            {pertenencias.map(({ espacio, rol }) => (
              <li key={espacio.id}>
                <button
                  type="button"
                  onClick={() => entrar(espacio.id)}
                  className="pulsable flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {espacio.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {NOMBRE_ROL[rol]}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {disponibles.length > 0 && (
        <section className="card mb-4 p-4">
          <h2 className="mb-1 text-sm font-semibold">Te están esperando</h2>
          <p className="mb-3 text-xs text-muted">
            Espacios a los que puedes unirte con tu correo.
          </p>
          <ul className="space-y-2">
            {disponibles.map((espacio) => (
              <li
                key={espacio.id}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
              >
                <Mail className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {espacio.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {espacio.motivo === "invitacion"
                      ? `Invitación como ${NOMBRE_ROL[espacio.role].toLowerCase()}`
                      : "Tu dominio de correo está autorizado"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void unirse(espacio.id)}
                  disabled={ocupado}
                  className="btn btn-primary py-1.5"
                >
                  Unirme
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="mb-4 rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <Link
        href="/empezar"
        className="card flex items-center gap-3 p-4 transition hover:bg-surface-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Plus className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {pertenencias.length > 0 ? "Crear otro espacio" : "Crear un espacio"}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Le pones nombre, escribes quiénes sois y repartes la invitación.
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>

      <form action="/auth/salir" method="post" className="mt-4 text-center">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir de la cuenta {perfil.email}
        </button>
      </form>
    </main>
  )
}
