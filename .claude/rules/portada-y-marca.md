---
paths:
  - "src/app/page.tsx"
  - "src/app/manifest.ts"
  - "src/app/robots.ts"
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
- **Falta**: `metadataBase` y `openGraph`/`twitter` en `layout.tsx`, un `sitemap.ts`, y el `theme_color` del manifiesto sigue con el azul antiguo.
- **Pulsado suave**: token `--pulsado`, `:active` en `.btn` y la clase `.pulsable`. El tinte va como `box-shadow` inset, para que valga sobre cualquier fondo.
