import type { MetadataRoute } from "next"

/** Next sirve esto en /manifest.webmanifest, que el proxy ya deja pasar sin sesion. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hitoo",
    short_name: "hitoo",
    description: "Cronómetro, hojas de horas e informes para equipos",
    start_url: "/panel",
    display: "standalone",
    // El manifiesto no admite variables CSS: los dos son --paper de globals.css,
    // tema claro. El color de tema, igual que el `viewport.themeColor` de
    // layout.tsx: con el acento, la app instalada abría con la barra azul y
    // cambiaba al cargar la página.
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // Android recorta el icono a su gusto: este lleva aire de sobra
        src: "/icons/icon-512-recortable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
