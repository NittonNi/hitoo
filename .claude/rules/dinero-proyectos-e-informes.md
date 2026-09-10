---
paths:
  - "src/components/resumen-proyecto.tsx"
  - "src/components/resultados-proyecto.tsx"
  - "src/components/tarjetas-edicion.tsx"
  - "src/components/detalle-proyecto.tsx"
  - "src/components/panel-proyectos.tsx"
  - "src/components/grafico-resumen-proyecto.tsx"
  - "src/components/gestion-reparto.tsx"
  - "src/components/gestion-tarifas.tsx"
  - "src/components/objetivo-hora.tsx"
  - "src/components/panel-estadisticas.tsx"
  - "src/components/panel-informes.tsx"
  - "src/components/acciones-informe.tsx"
  - "src/components/filtros-horas.tsx"
  - "src/components/filtro-multiple.tsx"
  - "src/lib/reparto.ts"
  - "src/lib/estadisticas.ts"
  - "src/lib/informes.ts"
  - "src/lib/exportar.ts"
  - "src/app/**/proyectos/**"
  - "src/app/**/estadisticas/**"
  - "src/app/**/informes/**"
  - "src/app/**/tarifas/**"
---

# Proyectos, dinero, informes y estadísticas

- **Regla del €/h**: con menos de una hora facturable no se enseña la cifra, ni en el resumen, ni en las tarjetas de edición, ni en estadísticas.
- **Objetivo de €/h**: `workspaces.target_hourly_rate`, que `projects.target_hourly_rate` pisa (a null, hereda). Solo lo cambia un admin.
- **Qué horas cuenta cada cierre**: lo decide una sola función, `esDeEsteCierre`. Ahí vivía el doble conteo del 21-ago: un cierre general sin edición se estiraba hasta hoy y volvía a contar las horas de las ediciones. No escribir ese criterio en ningún otro sitio.
- `project_results` tiene un índice único `(project_id, edition_id)` y otro parcial para el cierre general (`edition_id IS NULL`). El error 23505 tiene mensaje propio en `errores.ts`.
- **Ediciones**: sin ediciones hay una sola tarjeta a lo ancho, «Todo el proyecto». Con ediciones, las horas sueltas salen como aviso naranja con «moverlas a». La tarjeta «Sin edición» ya no existe.
- **Reparto** (`revenue_splits`/`revenue_split_shares`; gana lo más específico: edición > proyecto > espacio). En el modo «horas», cada persona se lleva el `amount` de sus propias horas, a su tarifa; nunca se prorratean horas en bruto. En porcentajes, no se guarda si no suman 100 (±0,5).
- **Tarifas** (`rates`): gana la más específica y, a igualdad, la más reciente ya vigente. No se editan: se añade otra con su fecha.
- **Ficha de proyecto** por pestañas (`?ver=`: resumen, ediciones, tareas, horas, ajustes), cambiando la URL con `history.replaceState`: pasar por el router hacía ir y volver del servidor en cada clic. El gráfico se carga con `next/dynamic` y `ssr: false`, para no traer recharts de entrada.
- **Filtros**: `filtro-multiple.tsx` no se cierra al marcar y tiene «Marcar todos» con tres estados. Guarda la lista explícita de ids, que es lo que permite «todos menos este». Filtrar cambia también los totales, que se ponen en azul con «filtradas».
- **Estadísticas** (`estadisticas.ts`): la página carga dos años para poder comparar con el periodo anterior. Cruce al clic tipo Power BI, con una sola selección a la vez. `CajaTooltip` lleva `pointer-events-none`: sin eso, la caja tapa los clics. El color de cada área sale de un mapa fijo calculado sobre el catálogo entero, no de la lista filtrada. El mapa de calor reparte cada rato por las horas que ocupa, descarta los de más de 16 h y responde a `onClick` para que funcione en táctil.
- **Informes**: filtran por personas, áreas, proyectos y etiquetas, con «sin proyecto» y «sin área» como una opción más. Desde ahí se corrigen horas en bloque.
