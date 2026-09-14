import type { MetadataRoute } from "next"

/**
 * Next sirve esto en /sitemap.xml, que el proxy ya deja pasar sin sesion
 * (ver el matcher de proxy.ts). Solo las paginas publicas de verdad: nada
 * que pida sesion, ni /unirse, /bienvenida o /auth, que no aportan nada
 * indexado. /empezar tampoco: el alta pide cuenta, y sin ella el proxy manda
 * a /acceso.
 */
const BASE_URL = "https://www.hitoo.es"

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date()

  return [
    { url: BASE_URL, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/acceso`, lastModified: ahora, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/privacidad`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/condiciones`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/aviso-legal`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
  ]
}
