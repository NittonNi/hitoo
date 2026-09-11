"use client"

import { useState } from "react"
import Link from "next/link"

import { useAvisos } from "@/components/avisos"
import { COOKIE_SEMANA_OMITIDA } from "@/lib/cookies"
import { conOmitida, sinOmitida } from "@/lib/semana-omitida"

function leerCookie() {
  const par = document.cookie
    .split("; ")
    .find((c) => c.startsWith(COOKIE_SEMANA_OMITIDA + "="))
  return par?.slice(COOKIE_SEMANA_OMITIDA.length + 1)
}

/** Vacía, la borra. Ocho días bastan: la semana siguiente ya no cuenta. */
function guardarCookie(valor: string) {
  const dura = valor ? 60 * 60 * 24 * 8 : 0
  document.cookie = `${COOKIE_SEMANA_OMITIDA}=${valor}; path=/; max-age=${dura}; samesite=lax`
}

/**
 * Los días de esta semana que siguen a cero. Avisar está bien, pero quien ya lo
 * sabe tiene que poder quitarlo: «Omitir» lo esconde hasta la semana que viene,
 * con Deshacer por si se pulsó sin querer.
 */
export function AvisoSemana({
  dias,
  lunes,
  espacioId,
}: {
  /** Ya en frase: "el lunes", "el martes"… */
  dias: string[]
  lunes: string
  espacioId: string
}) {
  const { avisar } = useAvisos()
  const [omitido, setOmitido] = useState(false)

  if (omitido) return null

  function omitir() {
    guardarCookie(conOmitida(leerCookie(), lunes, espacioId))
    setOmitido(true)
    avisar("No volverá a salir esta semana.", async () => {
      guardarCookie(sinOmitida(leerCookie(), lunes, espacioId))
      setOmitido(false)
    })
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 border-live-line bg-live-soft p-3">
      {/* Con base propia y no flex-1: si no, en el móvil el texto se estrujaba en
          una columna al lado de los botones en vez de dejarlos bajar */}
      <p className="min-w-0 grow basis-64 text-sm text-ink-soft">
        <span className="font-medium text-live">Sin apuntar:</span> {dias.join(", ")}
        {dias.length === 1 ? " sigue a cero." : " siguen a cero."}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button type="button" onClick={omitir} className="btn btn-ghost text-muted">
          Omitir
        </button>
        <Link href="/semana" className="btn btn-ghost text-live">
          Rellenar la semana
        </Link>
      </div>
    </div>
  )
}
