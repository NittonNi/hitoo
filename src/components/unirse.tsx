"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, UserPlus } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { cn } from "@/lib/utils"

/**
 * Unirse a un equipo con el enlace en la mano, al estilo de Tricount: quien
 * administra deja escritos los nombres y tu solo dices cual eres. Sin que nadie
 * tenga que saberse los correos.
 */
export function Unirse({
  codigo,
  espacio,
  plazas,
}: {
  codigo: string
  espacio: string
  plazas: { id: string; nombre: string; sugerida: boolean; con_horas: boolean }[]
}) {
  const router = useRouter()
  // Si el correo con el que entras es el de una plaza, ya viene elegida
  const [elegida, setElegida] = useState<string | null>(
    plazas.find((p) => p.sugerida)?.id ?? null,
  )
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar(plaza: string | null) {
    setOcupado(true)
    setError(null)

    const { error: err } = await createClient().rpc("unirse_con_codigo", {
      p_codigo: codigo,
      p_plaza: plaza ?? undefined,
    })

    if (err) {
      setOcupado(false)
      setError(mensajeError(err))
      return
    }

    // El espacio recien creado pasa a ser el activo al entrar
    router.push("/panel")
    router.refresh()
  }

  return (
    <main className="tema-claro mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[var(--radio)] bg-accent text-accent-fg">
          <UserPlus className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">
          Te unes a {espacio}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {plazas.length > 0
            ? "¿Quién eres? Elige tu nombre de la lista del equipo."
            : "Nadie ha dejado nombres apuntados, así que entrarás con el tuyo."}
        </p>
      </div>

      <section className="card p-4">
        {plazas.length > 0 && (
          <ul className="mb-3 space-y-1">
            {plazas.map((plaza) => (
              <li key={plaza.id}>
                <button
                  type="button"
                  onClick={() => setElegida(plaza.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--radio-sm)] border px-3 py-2 text-left text-sm transition",
                    elegida === plaza.id
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{plaza.nombre}</span>
                    {plaza.con_horas && (
                      <span className="block text-xs text-muted">
                        {elegida === plaza.id
                          ? "Sus horas ya apuntadas pasan a tu cuenta"
                          : "Con horas ya apuntadas"}
                      </span>
                    )}
                  </span>
                  {elegida === plaza.id && (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mb-3 rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void entrar(elegida)}
          disabled={ocupado || (plazas.length > 0 && !elegida)}
          className="btn btn-primary w-full"
        >
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
          {elegida ? "Soy yo, entrar" : "Entrar en el equipo"}
        </button>

        {plazas.length > 0 && (
          <button
            type="button"
            onClick={() => void entrar(null)}
            disabled={ocupado}
            className="btn btn-ghost mt-2 w-full text-muted"
          >
            No estoy en la lista
          </button>
        )}
      </section>

      <p className="mt-4 text-center text-xs text-muted">
        Entrarás como miembro del equipo. El nombre se puede cambiar después en
        tu perfil.
      </p>
    </main>
  )
}
