---
paths:
  - "src/lib/holded*.ts"
  - "src/components/cierre-holded.tsx"
  - "src/components/conexion-holded.tsx"
  - "src/components/editor-holded.tsx"
  - "src/components/detalle-sitio-holded.tsx"
  - "src/lib/editor-holded.ts"
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
- **Los enlaces viven en `holded_enlaces`** (espacio + proyecto de Holded → cierre, con sus cifras). Un proyecto de Holded va a un solo sitio; un cierre junta varios. `result_id` a null es «por decidir»: se aparca con sus cifras, y quitar o deshacer no gasta cupo. Mover un enlace conserva sus cifras.
- **Las cifras de Holded solo las escribe el servidor**, en el enlace (`holded_enlaces_cifras` ignora lo que no venga de la clave de servicio). `project_results.holded_*` es la suma de sus enlaces y `holded_project_id` el menor, y en un cierre enlazado `income` y `expenses` son Holded + `ajustes_del_cierre`. Por eso Estadísticas, Informes y el €/h no saben nada de Holded y siguen funcionando.
- **Un ajuste con `holded_document`** (restar una anulada) solo cuenta mientras ese proyecto de Holded siga en el cierre. Al perder el último enlace, el cierre se queda sin el dinero de Holded (solo ajustes a mano), no «con la última cifra»: si no, mover un enlace contaría dos veces. Mover un ajuste recalcula los dos cierres.
- **Compatibilidad**: si algo escribe `project_results.holded_project_id` a mano (el código de antes), `project_results_enlace_antiguo` lo pasa a `holded_enlaces`. El código nuevo no escribe esa columna.
- **Meter un proyecto o una edición en otro sitio** lo hace la base de una vez: `meter_en` (horas, tareas emparejadas por nombre, propuestas pendientes, enlaces, ajustes y cifras a mano; archiva lo vacío) y `deshacer_meter(id)`, que lo devuelve todo con los mismos id. Lo guardado para deshacer (`deshacer_meter`, sin políticas) dura dos días.
- **Enlazar uno suelto no busca anuladas** (`soloHolded`): recorrer `/invoices` son decenas de llamadas. Llegan con la vuelta diaria o con «Actualizar».
- **Gestión → Holded es el editor** (`editor-holded.tsx`): el modelo se monta en el servidor (`lib/editor-holded.ts`) con `horas_por_sitio`, un JSON por proyecto y edición. Las líneas se miden del DOM y se dibujan a mano en el SVG; el arrastre va con eventos de puntero y cada acción tiene su botón, que en el móvil es la única forma.
- **El cron** (`/api/holded/cron`, en `vercel.json`) es público para el proxy y exige `Authorization: Bearer <CRON_SECRET>`. Sin la variable no hace nada.
