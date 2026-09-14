import type { MetadataRoute } from "next"

/**
 * Next sirve esto en /robots.txt, que el proxy ya deja pasar sin sesion.
 * Sin este archivo, /robots.txt caia en el 404 generico -mejor ser
 * explicitos: las paginas publicas de verdad se pueden rastrear, el resto
 * de la app exige sesion y no aporta nada indexado. La lista de "allow" es
 * la misma que sitemap.ts: no tiene sentido listar ahi una pagina que aqui
 * se dice que no se rastree.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/acceso", "/privacidad", "/condiciones", "/aviso-legal"],
      // /empezar pide cuenta: sin ella, el proxy manda a /acceso
      disallow: ["/panel", "/auth", "/empezar", "/bienvenida", "/unirse"],
    },
    sitemap: "https://www.hitoo.es/sitemap.xml",
  }
}
