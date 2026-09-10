---
paths:
  - "src/components/rejilla-calendario.tsx"
  - "src/components/barra-cronometro.tsx"
  - "src/components/tabla-semana.tsx"
  - "src/components/lista-entradas.tsx"
  - "src/components/fila-entrada.tsx"
  - "src/components/fila-en-marcha.tsx"
  - "src/components/dialogo-entrada.tsx"
  - "src/components/propuestas-pendientes.tsx"
  - "src/components/compartir-con.tsx"
  - "src/components/resumen-cronometro.tsx"
  - "src/lib/calendario.ts"
  - "src/lib/cronometro.ts"
  - "src/lib/compartir.ts"
  - "src/app/**/calendario/**"
  - "src/app/**/semana/**"
  - "src/app/**/panel/**"
---

# Calendario, cronómetro y horas

- **Cada bloque tiene dos finales**: el dibujado (recortado a medianoche) y `finReal`. Se escribe siempre desde `finReal`: con el dibujado, un clic sobre un rato de madrugada lo guardaba acabando a las 24:00 y se perdían horas sin avisar. El clic sin arrastre no guarda.
- **Arrastrar para crear, mover y estirar** va con eventos de puntero: en táctil, 350 ms pulsado antes de empezar y 8 px de tolerancia. Radix abre sus menús en `pointerdown` y se queda con el puntero, así que ahí va `preventDefault()` y el menú se abre al soltar si no hubo arrastre. `pointer-events: none` en la fila arrastrada anula la captura del puntero; para saber qué hay debajo, `elementsFromPoint` saltándose la propia fila.
- **Móvil**: un solo día. Se pintan los siete en una tira de siete pantallas que sigue al dedo con `translateX`. El gesto se declara a los 12 px, cambia de día pasado un tercio del ancho (tope 110 px) y lleva `touch-action: pan-y`. Al cambiar de semana, la tira sale medio paso y entra desde el lado contrario. En móvil no hay flechas ni filtros.
- **Horas compartidas**: `entry_invitations` + `responder_invitacion()`. Se proponen, no se imputan. Una propuesta se pinta sin relleno y con borde a rayas, y aceptarla crea una hora propia. Cambiar hora, duración, proyecto, edición, tarea o descripción la separa (`separated_at`); cobrar o etiquetar no.
- **Deshacer una hora recién creada** borra también sus `entry_invitations` explícitamente, aunque la FK sea CASCADE.
- **Eventos de Google Calendar**: se pintan como una propuesta, con icono de calendario. Solo salen las reuniones aceptadas y de la semana que se mira. Al aceptar se guardan `source: "google_calendar"` y el id del evento en `external_id`, para no repetirlos.
- **Ratos agrupados** en el cronómetro: mismo día y mismo proyecto/edición salen en una fila. Editarla cambia todos los de dentro, con Deshacer.
- **Continuar** crea una entrada nueva. La entrada en marcha se ve como una fila naranja encima de la lista (`FilaEnMarcha`).
- `/panel`, `/calendario` y `/semana` piden solo entradas terminadas (`soloTerminadas` en `cargarEntradas()`): la que está en marcha ya la trae el layout.
- **Relojes**: las horas apuntadas a mano usan la hora del navegador; `start_timer`, la del servidor.
