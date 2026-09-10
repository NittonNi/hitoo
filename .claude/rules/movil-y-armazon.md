---
paths:
  - "src/app/globals.css"
  - "src/app/layout.tsx"
  - "src/components/barra-teclado.tsx"
  - "src/components/armazon.tsx"
  - "src/components/cambio-espacio.ts"
  - "src/components/bienvenida.tsx"
  - "src/components/sub-nav.tsx"
  - "src/components/esqueleto-marco.tsx"
  - "src/components/esqueleto-pagina.tsx"
---

# Móvil, armazón y estilos globales

- **Dos cortes**: la barra lateral pasa a barra inferior en 1023 px, y `useEsMovil` (lo que decide el código, como quitar los filtros) corta en 768 px. Lo que decide el CSS y lo que decide el código no se pueden contradecir.
- **Zoom de iOS**: los campos van a 16 px con una regla **fuera de capas**; dentro de `@layer components`, cualquier `text-sm` de Tailwind la pisaba. El viewport no lleva `maximum-scale` a propósito: bloquear el zoom es peor.
- **Los reset de elementos van en `@layer base`**: fuera de capa ganan a `@layer components`, y `button { color: inherit }` pintaba el texto de los botones del color de su fondo.
- **Con el teclado abierto**, la navegación de abajo se esconde (`.no-teclado`, que activa `data-teclado` en `<html>`), el campo enfocado va al centro y `barra-teclado.tsx` pone flechas encima del teclado. Sus botones actúan en `pointerdown` con `preventDefault`, para no soltar el foco. El viewport lleva `interactiveWidget: "resizes-content"`.
- **Desde estas sesiones no hay teclado virtual ni ancho de ventana real**: el encaje se ve en una maqueta de móvil, y lo del teclado solo se puede probar en un teléfono de verdad.
- `min-h-dvh` en el armazón y `env(safe-area-inset-bottom)` en la barra inferior. `touch-action: manipulation` y sin `-webkit-tap-highlight-color`.
- **Radios**: `--radio` y `--radio-sm` en `globals.css`. Los `rounded-lg`/`rounded-xl` sueltos no se enteran cuando cambian los tokens.
- **El layout de `(app)` tiene su propio Suspense** (`MarcoSesion` con `EsqueletoMarco`): sin él, la navegación se quedaba parada y sin aviso mientras cargaba la sesión.
- **Cambiar de espacio** (`cambio-espacio.ts`): en el mismo clic, el selector enseña el espacio elegido y el contenido pasa al esqueleto del cronómetro. La acción acaba en `redirect`, y en Next 16.3 eso llega como una promesa rechazada. Se reconoce con `unstable_rethrow`; si no, cada cambio que va bien avisaría de un error.
