"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import { CalendarDays, Loader2, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { desconectarGoogle } from "@/app/(app)/calendario/acciones"

/**
 * Conectar y desconectar. Las reuniones que trae se aceptan directamente en
 * la rejilla del calendario -este dialogo ya no las lista, para no repetir
 * en dos sitios lo mismo.
 */
export function AjustesCalendarioGoogle({
  conectado: conectadoInicial,
  falloGoogle = null,
}: {
  conectado: boolean
  /**
   * Lo que devolvio Google o Supabase si conectar fallo (`?error_google=`, lo
   * pone auth/callback). Con la sesion abierta no se puede volver a /acceso,
   * que te manda al panel y se come el aviso: se cuenta aqui, con el dialogo
   * ya abierto.
   */
  falloGoogle?: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(Boolean(falloGoogle))
  const [conectado, setConectado] = useState(conectadoInicial)
  const [entrando, setEntrando] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState<string | null>(
    falloGoogle ? mensajeError(falloGoogle) : null,
  )

  // Fuera de la URL, para que recargar no repita el aviso
  useEffect(() => {
    if (!falloGoogle) return
    const url = new URL(window.location.href)
    url.searchParams.delete("error_google")
    window.history.replaceState(null, "", url)
  }, [falloGoogle])

  async function conectar() {
    setEntrando(true)
    setError(null)

    const supabase = createClient()

    // Quien entro con correo y contraseña no puede pasar por signInWithOAuth
    // para conectar el calendario: Supabase abriría sesión con el usuario
    // dueño de esa cuenta de Google, que no tiene por qué ser este -así se
    // acababa "cambiado de usuario" sin enterarse-. linkIdentity() añade la
    // identidad de Google a la cuenta ya abierta en vez de iniciar sesión con
    // ella. Si la cuenta ya entró alguna vez con Google (ya tiene esa
    // identidad), se sigue con el camino de siempre, que resuelve al mismo
    // usuario y no hace falta enlazar de nuevo.
    const { data: datosUsuario } = await supabase.auth.getUser()
    const usuario = datosUsuario.user
    if (!usuario) {
      setEntrando(false)
      setError("Hay que iniciar sesión.")
      return
    }
    const identidadGoogle = usuario.identities?.find((i) => i.provider === "google")
    const correoGoogle = (identidadGoogle?.identity_data as { email?: string } | undefined)
      ?.email

    const opciones = {
      scopes: "https://www.googleapis.com/auth/calendar.readonly",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        /* Con una cuenta de Google ya enlazada, esa es la que se propone en
           el selector: elegir otra no puede cambiarte de usuario -lo corta
           auth/callback con `esperado`-, pero mejor no llegar ahi. */
        ...(correoGoogle ? { login_hint: correoGoogle } : {}),
      },
      /* `esperado` es quien pulsa: la vuelta no guarda sesion si Google
         responde con otra cuenta (ver auth/callback/route.ts). */
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/calendario")}&esperado=${usuario.id}`,
    }
    const yaTieneGoogle = Boolean(identidadGoogle)

    const { error: err } = yaTieneGoogle
      ? await supabase.auth.signInWithOAuth({ provider: "google", options: opciones })
      : await supabase.auth.linkIdentity({ provider: "google", options: opciones })

    // Si sale bien, el navegador ya se ha ido a Google y esto no se ejecuta
    if (err) {
      setEntrando(false)
      setError(mensajeError(err))
    }
  }

  async function desconectar() {
    setSaliendo(true)
    setError(null)

    // En el servidor: revoca el token en Google antes de borrar la fila, sin
    // pasarle el refresh_token al navegador para que lo revoque el mismo.
    const { error: err } = await desconectarGoogle()

    setSaliendo(false)
    if (err) {
      setError(err)
      return
    }
    setConectado(false)
    setAbierto(false)
    router.refresh()
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger className={conectado ? "btn" : "btn btn-primary"}>
        <CalendarDays className="h-4 w-4" />
        {conectado ? "Google Calendar" : "Conectar Google Calendar"}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="card fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-0"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Dialog.Title className="text-sm font-semibold">Google Calendar</Dialog.Title>
            <Dialog.Close className="btn btn-ghost p-1" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-3 p-4">
            {!conectado ? (
              <>
                <p className="text-sm text-ink-soft">
                  Las reuniones que ya hayas aceptado en Google Calendar
                  aparecerán en tu semana, listas para apuntarlas con un
                  clic. Solo se lee tu calendario, nunca se modifica.
                </p>
                <button
                  type="button"
                  onClick={() => void conectar()}
                  disabled={entrando}
                  className="btn btn-primary w-full"
                >
                  {entrando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Conectar con Google Calendar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="chip">Conectado</span>
                  <button
                    type="button"
                    onClick={() => void desconectar()}
                    disabled={saliendo}
                    className="text-sm text-danger transition hover:underline disabled:opacity-60"
                  >
                    {saliendo ? "Desconectando…" : "Desconectar"}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Las reuniones aceptadas de esta semana ya salen en el
                  calendario con el borde a rayas, junto a las propuestas del
                  equipo.
                </p>
              </>
            )}

            {error && (
              <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
