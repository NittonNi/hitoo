---
paths:
  - "src/app/layout.tsx"
  - "src/app/page.tsx"
  - "src/app/manifest.ts"
  - "src/app/robots.ts"
  - "src/app/sitemap.ts"
  - "src/app/opengraph-image.tsx"
  - "src/components/al-entrar.tsx"
  - "src/components/entrar-directo.tsx"
  - "src/components/cronometro-demo.tsx"
  - "src/lib/cookies.ts"
  - "public/**"
---

# Portada, marca y cara pública

- **Lo público va siempre en claro** con la clase `.tema-claro` (portada, `/empezar`, `/privacidad`, `/acceso`, `/auth/nueva-contrasena`, `/unirse`, `/bienvenida`), cada una con su `viewport.themeColor` claro. El fondo se pinta con un `::before` fijo a pantalla completa, no en la caja del elemento: si no, sale una tira blanca con negro a los lados.
- **La portada** alterna secciones a dos columnas (`Cara`) con maquetas dibujadas con los tokens de la app: nada de capturas con datos de nadie. Tiene secciones de Google Calendar (la mira Google al revisar), El dinero y El precio (`#precio`).
- **Por la verificación de Google**, la portada tiene que seguir mostrando «hitoo» como texto, en minúscula igual que la ficha de OAuth, además del logo y del enlace a Privacidad en el pie.
- **`al-entrar.tsx`**: sin JavaScript no esconde nada, y lo que ya se ve al cargar no se anima. Con `prefers-reduced-motion` no hay animación.
- **«Llévame directo»**: va en una cookie (`cookies.ts`) para que el servidor redirija antes de pintar. `/?portada` enseña la portada igualmente.
- **Una sola marca, la «h»**: `src/app/apple-icon.png` y `src/app/favicon.ico` salen de `public/icons/icon-512.png`. El apple-icon va cuadrado a sangre, porque iOS pone su propia máscara; el favicon conserva la transparencia.
- **Color de tema**: el `theme_color` del manifiesto es el mismo `#f5f5f7` que el `viewport.themeColor` claro de `layout.tsx`. Con el acento, la app instalada abría con la barra azul y cambiaba al cargar.
- **Lo que se comparte**: `metadataBase` (`https://www.hitoo.es`, el dominio de `www`) y `openGraph`/`twitter` viven en `layout.tsx`; la portada los sustituye enteros -Next no los mezcla- con el mismo texto que su título y descripción. `sitemap.ts` lista las páginas públicas de verdad, y `robots.ts` apunta a él con la misma lista en `allow`.
- **Pulsado suave**: token `--pulsado`, `:active` en `.btn` y la clase `.pulsable`. El tinte va como `box-shadow` inset, para que valga sobre cualquier fondo.
