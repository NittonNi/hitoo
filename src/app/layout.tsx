import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

/**
 * Inter con las cifras tabulares activadas. Es la más cercana a la del sistema
 * de Apple, y en un Mac cae directamente en -apple-system por el fallback.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  // Dominio canónico: hitoo.es redirige aquí con 308. Hace falta para que
  // las URLs de imagen (og:image, twitter:image) salgan absolutas.
  metadataBase: new URL("https://www.hitoo.es"),
  title: {
    default: "hitoo",
    template: "%s · hitoo",
  },
  description: "Cronómetro, hojas de horas e informes para equipos",
  // Sin título ni descripción propios a propósito: los toma del title y la
  // description de arriba (Next los rellena solo si openGraph/twitter no
  // traen los suyos). Una página con su propio openGraph -la portada- lo
  // sustituye entero, no lo mezcla, así que repite estas mismas claves.
  openGraph: {
    siteName: "hitoo",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
}

export const viewport: Viewport = {
  /* Con el teclado abierto, que el contenido se encoja en vez de quedarse
     debajo. Chrome/Android lo respeta; en iOS lo apana `barra-teclado.tsx`
     con `visualViewport`. */
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // El script de abajo pone data-theme antes de hidratar: el servidor no
      // puede saber el tema guardado, y esa diferencia es esperada.
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema guardado antes de pintar, para que no parpadee */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("tema");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
