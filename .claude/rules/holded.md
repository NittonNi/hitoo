---
paths:
  - "src/lib/holded*.ts"
  - "src/components/cierre-holded.tsx"
  - "src/components/gestion-holded.tsx"
  - "src/app/(app)/gestion/holded/**"
  - "src/app/api/holded/**"
---

# Holded

- **Solo vale la API v2**: `https://api.holded.com/api/v2` con `Authorization: Bearer <clave>`. La v1 (cabecera `key`) rechaza las claves nuevas con 400 «Invalid key».
- **Los importes de las facturas llegan como texto con coma decimal** («1453,83»); los del resumen de un proyecto, como número. Siempre por `importeHolded()`.
- **Fechas**: la de inicio de un proyecto viene en dd/mm/aaaa (`fechaProyectoHolded()`); la de una factura, en aaaa-mm-dd.
- **El `project_id` va en cada línea de factura**, no en el documento.
- **El resumen de un proyecto (`/projects/{id}/summary`) cuenta las facturas anuladas** y además incluye gastos que la API no enseña en `/purchases`. Por eso los totales salen del resumen (cuadran con la pantalla de Holded) y las anuladas se buscan aparte en `/invoices` para proponer restarlas con un ajuste.
- `archived` viene siempre a `false` en los proyectos: no sirve para filtrar.
- **Cupo mensual pequeño** en los planes baratos (500 llamadas en Plus). Nada llama a Holded al abrir una pantalla: se trae con «Actualizar» o con el cron, y se guarda. `GET /usage` también gasta una llamada. Enlazar varios de golpe va por `enlazarVarios`, que actualiza una sola vez.
- **La clave** vive en `holded_credentials`, cifrada con `cifrado.ts`, sin ninguna política RLS: solo la lee `holded-servidor.ts` con la clave de servicio. Nunca se importa ese fichero desde un componente de cliente.
- **Las cifras de Holded solo las escribe el servidor**: el disparador `project_results_holded` ignora cualquier cambio de `holded_*` que no venga de la clave de servicio, y en un cierre enlazado recalcula `income` y `expenses` como Holded + `result_adjustments`. Por eso Estadísticas, Informes y el €/h no saben nada de Holded y siguen funcionando.
- **El cron** (`/api/holded/cron`, en `vercel.json`) es público para el proxy y exige `Authorization: Bearer <CRON_SECRET>`. Sin la variable no hace nada.
