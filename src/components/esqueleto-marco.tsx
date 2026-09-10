import { BloquePulso, EsqueletoPagina } from "@/components/esqueleto-pagina"

/**
 * Lo que se ve nada más navegar a (app) mientras se resuelve la sesión
 * (cookies(), en MarcoSesion de layout.tsx) y la entrada en marcha. Sin Cache
 * Components activado, un layout async sin su propio límite de Suspense
 * bloquea la navegación entera y loading.tsx no llega a mostrar nada -ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * loading.md líneas 88-93 y layout.md líneas 316-345 de esta instalación.
 *
 * Calca solo las medidas de Armazon (ancho de barra lateral, alto de cabecera
 * móvil) para que no salte el layout cuando entra el de verdad.
 *
 * El <main> lleva el esqueleto generico a proposito: el loading.tsx de cada
 * pagina vive POR DENTRO de este Suspense, asi que hasta que no se resuelve
 * la sesion no llega a pintarse. Sin nada aqui, lo que se ve mientras tanto
 * es el menu en gris y el contenido en blanco -que es justo la queja del
 * 20-ago-2026-. Luego lo releva el esqueleto propio de la pagina.
 */
export function EsqueletoMarco({ plegado = false }: { plegado?: boolean }) {
  return (
    <div className="flex min-h-dvh">
      {/* Con el menú plegado, su ancho plegado: si no, al recargar se veía ancha
          un instante y luego se estrechaba */}
      <aside
        className={`no-print sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r border-line bg-surface-2/60 p-2 lg:flex ${plegado ? "w-16" : "w-60"}`}
      >
        <BloquePulso className="h-10 rounded-[var(--radio-sm)]" />
        <div className="flex-1 space-y-1.5 pt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <BloquePulso key={i} className="h-8 rounded-[var(--radio-sm)]" />
          ))}
        </div>
        <BloquePulso className="h-14 rounded-[var(--radio-sm)]" />
        <BloquePulso className="h-10 rounded-[var(--radio-sm)]" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur lg:hidden">
          <BloquePulso className="h-8 w-32 rounded-[var(--radio-sm)]" />
          <BloquePulso className="ml-auto h-8 w-20 rounded-[var(--radio-sm)]" />
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[90rem] flex-1 px-4 py-5 pb-24 lg:px-8 lg:py-7 lg:pb-7">
          <EsqueletoPagina />
        </main>
      </div>
    </div>
  )
}
