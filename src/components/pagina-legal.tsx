import Link from "next/link"

import { FALTAN_DATOS } from "@/lib/empresa"

/**
 * El armazón compartido de las páginas legales: mismo ancho, mismo tono y
 * mismo camino de vuelta que /privacidad, que se llega a las tres desde el
 * pie de la portada.
 *
 * Si los datos fiscales todavía tienen huecos, la propia página lo grita.
 * Publicar un aviso legal sin CIF no es un despiste pequeño.
 */
export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string
  actualizado: string
  children: React.ReactNode
}) {
  return (
    <main className="tema-claro mx-auto w-full max-w-2xl px-5 py-16">
      <Link href="/" className="text-sm text-muted transition hover:text-ink">
        ← Volver a hitoo
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">{titulo}</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: {actualizado}.</p>

      {FALTAN_DATOS && (
        <p className="mt-6 rounded-[var(--radio)] bg-danger-soft p-3 text-sm text-danger">
          Sin publicar: faltan por rellenar los datos fiscales en
          <code className="mx-1">src/lib/empresa.ts</code>.
        </p>
      )}

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink">{children}</div>
    </main>
  )
}

/** Un apartado con su título, para no repetir clases en cada uno. */
export function Apartado({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}
