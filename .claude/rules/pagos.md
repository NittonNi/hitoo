---
paths:
  - "src/lib/stripe.ts"
  - "src/lib/suscripcion.ts"
  - "src/lib/empresa.ts"
  - "src/app/api/stripe/**"
  - "src/app/**/suscripcion/**"
  - "src/components/gestion-suscripcion.tsx"
  - "src/components/aviso-cuota.tsx"
  - "src/components/pagina-legal.tsx"
  - "src/app/privacidad/**"
  - "src/app/condiciones/**"
  - "src/app/aviso-legal/**"
---

# Pagos, cuota y textos legales

- **Modelo**: `workspace_subscriptions` tiene una fila por espacio, con RLS de solo lectura para el equipo; solo la escribe el webhook, con la `service_role`. Un espacio nuevo nace con 14 días de prueba (disparador). `trial_codes` y la RPC `aplicar_codigo_prueba` (solo admin) alargan la prueba.
- **El candado está en la base**: la política de inserción de `time_entries` lleva `puede_escribir(workspace_id)`. Caducado significa que no entran horas nuevas, pero se lee, se corrige y se exporta. `mensajeError` traduce ese rebote a «se acabó la prueba».
- **Webhook** (`api/stripe/webhook`): la firma se verifica. Cualquier fallo, incluido un `UPDATE` que no encuentra fila, **lanza y devuelve 500** para que Stripe reintente. Contestar 200 con un error dentro pierde el cobro para siempre.
- **IVA**: `tax_behavior: "exclusive"` en el precio no suma el IVA; hay que pasar `tax_rates` en la línea del Checkout. El precio y el tipo de IVA tienen que ser exclusive los dos.
- **Checkout**: `consent_collection` (aceptar las condiciones es obligatorio) y `locale: "es"`. Si falta la URL de las condiciones en el panel de Stripe, falla entero, y para eso hay un mensaje propio en castellano.
- **Portal**: el código guarda `cancel_at_period_end` y trata al espacio como pagando hasta el fin del periodo.
- **Precio y datos fiscales, en un solo sitio**: `PRECIO` (con `PRECIO.conIvaTexto`, que escribe la coma decimal) y `EMPRESA`, en `empresa.ts`. Si un dato fiscal vuelve a quedar «PENDIENTE», las páginas legales se pintan con una franja roja.
- El botón de suscribirse no sale en cortesía ni cuando ya se paga, a propósito.
- `success_url`, `cancel_url` y `return_url` vuelven a `/gestion/suscripcion`: si la pantalla se mueve, hay que cambiar las tres.
- **Privacidad**: cumple el RGPD (base jurídica, derechos, AEPD, transferencias internacionales). Es la página que revisó Google: los bloques de Google Calendar y Limited Use no se tocan.
