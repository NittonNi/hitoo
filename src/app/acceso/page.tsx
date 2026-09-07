import { Suspense } from "react"
import Link from "next/link"

import { FormularioAcceso } from "./formulario-acceso"

export const metadata = { title: "Acceso" }

/** Se ve antes de entrar al panel, así que va en claro como la portada. */
export const viewport = { themeColor: "#f5f5f7" }

export default function PaginaAcceso() {
  return (
    <main className="tema-claro flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center">
          <h1 className="sr-only">hitoo</h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marca, no necesita next/image */}
          <img
            src="/hitoo-logo.svg"
            alt="hitoo"
            className="mx-auto mb-4 h-12 w-auto"
          />
          <p className="mt-1 text-sm text-muted">
            El control de horas de los equipos LEINN
          </p>
        </Link>

        <Suspense
          fallback={<div className="card h-72 animate-pulse bg-surface-2" />}
        >
          <FormularioAcceso />
        </Suspense>

        {/* Se entra por dos puertas -Google y el formulario- y el aviso tiene
            que valer para las dos, asi que vive en la pagina y no dentro del
            <form>. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Al crear una cuenta aceptas las{" "}
          <Link href="/condiciones" className="underline underline-offset-2 transition hover:text-ink">
            condiciones de contratación
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline underline-offset-2 transition hover:text-ink">
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
