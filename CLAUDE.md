@AGENTS.md

# hitoo

Control de horas para equipos LEINN: cronómetro, calendario, hoja semanal, proyectos con ediciones y cierres, informes, estadísticas y cuota por equipo con Stripe. En producción en https://www.hitoo.es. La carpeta local se llama `nitton-horas`; antes la app fue ClockLEINN y Horas.

## Comandos
- `npm run dev` levanta http://localhost:3000.
- **Antes de dar algo por terminado**: `npx tsc --noEmit`, `npm run lint` y `npm run build`, los tres limpios. Si toca interfaz, además, mirarlo en el navegador.
- **Tras cada migración**, regenerar `src/lib/database.types.ts` (MCP de Supabase, `generate_typescript_types`).
- **No pasar prettier**: el repo no tiene configuración y reformatea cientos de líneas.

## Stack
Next.js 16.3 (App Router, `src/proxy.ts`), React 19, Tailwind v4, Radix sin estilos, Supabase (auth y Postgres con RLS), Stripe, recharts, jspdf, papaparse, write-excel-file y qrcode.

## Mapa
- `src/app/page.tsx` es la portada pública; la app vive bajo `/panel` (`RUTA_APP` en `src/lib/rutas.ts`).
- `src/app/(app)/` es lo que necesita sesión: panel, calendario, semana, informes, estadisticas, proyectos/[id], perfil y gestion (equipo, categorias, tarifas, importar, ajustes, suscripcion).
- Lo público: acceso, auth/*, empezar (alta), bienvenida (elegir espacio), unirse/[codigo], privacidad, condiciones, aviso-legal y api/stripe/webhook. **Una ruta pública nueva hay que añadirla a `PUBLIC_PATHS`** (`src/lib/supabase/session.ts`), o el proxy la manda a `/acceso`. Empareja por prefijo: se abre la ruta exacta, nunca `/api` entero.
- `src/lib/` guarda los datos y la lógica pura (`datos.ts`, `sesion.ts`, `time.ts`, `calendario.ts`, `estadisticas.ts`, `reparto.ts`, `informes.ts`, `exportar.ts`, `errores.ts`, `stripe.ts`, `suscripcion.ts`, `google.ts`, `cifrado.ts`, `empresa.ts`). `src/components/`, una pieza por fichero.
- **La base vive solo en Supabase**: no hay carpeta de migraciones. Tablas principales: `workspaces`, `workspace_members`, `workspace_seats`, `projects`, `project_editions`, `project_results`, `tasks`, `categories`, `tags`, `time_entries`, `entry_invitations`, `rates`, `revenue_splits`, `google_connections`, `workspace_subscriptions` y `trial_codes`, más la vista `v_entries` para los informes.

## Convenciones
- **Código en castellano.** Rutas, carpetas e identificadores **sin tildes** (un `href="/gestión"` da 404); textos de interfaz **con** tildes y eñes.
- **Colores con significado**: azul = se puede pulsar, naranja = corriendo ahora, verde = se cobra, rojo = borra.
- **Nada de `alert` ni `confirm`**: avisos abajo a la derecha (`avisos.tsx`), hasta tres a la vez, 12 s, con Deshacer.
- **Diálogos con `@radix-ui/react-dialog`**, nunca un `div fixed` hecho a mano, que no atrapa el foco ni bloquea el scroll. Si se abre desde un botón que no es `Dialog.Trigger`, guardar el foco y devolverlo en `onCloseAutoFocus`.
- **Horas y duraciones, siempre con `campo-hora.tsx`** («9» → 09:00, «930» → 09:30; en duraciones, un número pelado son horas). Las duraciones se enseñan en hh:mm:ss.
- **Arrastres con eventos de puntero**, no con el `draggable` de HTML, que no existe en táctil.
- **Criterios de interfaz**: nada que aparezca solo al pasar el ratón, menús de selección que no se cierran al elegir, los mínimos modales, no repetir lo que la estructura ya dice y nada a mano si se puede deducir. El detalle está en el skill `house-style`.

## Trampas que ya costaron caro
- **PostgREST devuelve «todo bien» con 0 filas** cuando la RLS no deja escribir, y un `UPDATE` sin filas tampoco es un error para Postgres. Toda escritura lleva `.select()` y avisa si no cambió nada.
- **«Hoy» y «esta semana» se calculan en la zona del espacio** (`espacio.timezone`), nunca con el reloj del servidor, que en producción va en UTC: `todayKey(tz)`, `startOfWeek(tz)`, `startOfDayInZone` y `toDateKeyInZone`, en `src/lib/time.ts`. `local_date` lo pone un disparador con esa misma zona.
- **Cambio de hora**: el fin de un rato se construye con componentes locales, nunca sumando milisegundos al inicio.
- **Una constante exportada desde un módulo `"use client"` no llega al servidor como valor**, sino como referencia. Los nombres de cookies compartidas viven en `src/lib/cookies.ts`.
- **Permisos de funciones**: revocar `EXECUTE` a `anon` o `authenticated` no sirve si está concedido a `PUBLIC`, que es lo que hace Postgres por defecto. `is_admin`, `is_member` y compañía los usan las políticas RLS: no se tocan.
- **`UNIQUE` con NULL**: Postgres trata cada NULL como distinto; para «uno solo sin edición» hace falta un índice parcial.
- **Next 16 cambia APIs**: antes de usar una, mirar `node_modules/next/dist/docs/`.
- **El dev server a veces no recarga un módulo cliente**, aunque se edite y se reinicie. Antes de dar por roto un componente nuevo, comprobar con una sonda que el código nuevo está vivo.
- **Datos reales**: el espacio NITTON es de verdad. Lo que se cree para probar se borra al terminar y se comprueba por SQL. Nunca se contacta a nadie ni se tocan datos de otros sin permiso.

## Dónde está el resto
- **Cada zona** (calendario, dinero e informes, pagos, Google y acceso, alta y equipo, portada, móvil) tiene su regla en `.claude/rules/`, que se carga sola al abrir sus ficheros.
- **El estado, las tareas, las decisiones y las cuentas** están fuera del repo, que es público; los carga `CLAUDE.local.md`.
- Una trampa nueva de código va a su regla o aquí. Nada privado (claves, IDs de cuentas, contraseñas, datos de clientes) entra en este repo.
