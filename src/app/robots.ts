import type { MetadataRoute } from "next"

/**
 * Next sirve esto en /robots.txt, que el proxy ya deja pasar sin sesion.
 * Sin este archivo, /robots.txt caia en el 404 generico -mejor ser
 * explicitos: la portada y la politica de privacidad son publicas, el
 * resto de la app exige sesion y no aporta nada indexado.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacidad", "/condiciones", "/aviso-legal"],
      disallow: ["/panel", "/acceso", "/auth", "/empezar", "/bienvenida", "/unirse"],
    },
  }
}
