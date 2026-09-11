---
paths:
  - "src/components/rejilla-calendario.tsx"
  - "src/components/barra-cronometro.tsx"
  - "src/components/tabla-semana.tsx"
  - "src/components/lista-entradas.tsx"
  - "src/components/fila-entrada.tsx"
  - "src/components/dialogo-entrada.tsx"
  - "src/components/propuestas-pendientes.tsx"
  - "src/components/compartir-con.tsx"
  - "src/components/resumen-cronometro.tsx"
  - "src/lib/calendario.ts"
  - "src/lib/cronometro.ts"
  - "src/components/proveedor-cronometro.tsx"
  - "src/components/aviso-olvido.tsx"
  - "src/lib/compartir.ts"
  - "src/app/**/calendario/**"
  - "src/app/**/semana/**"
  - "src/app/**/panel/**"
---

# Calendario, cronómetro y horas

- **Cada bloque tiene dos finales**: el dibujado (recortado a medianoche) y `finReal`. Se escribe siempre desde `finReal`: con el dibujado, un clic sobre un rato de madrugada lo guardaba acabando a las 24:00 y se perdían horas sin avisar. El clic sin arrastre no guarda.
- **Arrastrar para crear, mover y estirar** va con eventos de puntero: en táctil, 350 ms pulsado antes de empezar y 8 px de tolerancia. Radix abre sus menús en `pointerdown` y se queda con el puntero, así que ahí va `preventDefault()` y el menú se abre al soltar si no hubo arrastre. `pointer-events: none` en la fila arrastrada anula la captura del puntero; para saber qué hay debajo, `elementsFromPoint` saltándose la propia fila.
- **Móvil**: un solo día. Se pintan los siete en una tira de siete pantallas que sigue al dedo con `translateX`. El gesto se declara a los 12 px, cambia de día pasado un tercio del ancho (tope 110 px) y lleva `touch-action: pan-y`. Al cambiar de semana, la tira sale medio paso y entra desde el lado contrario. En móvil no hay flechas ni filtros.
- **Horas compartidas**: `entry_invitations` + `responder_invitacion()`. Se proponen, no se imputan. Una propuesta se pinta sin relleno y con borde a rayas, y aceptarla crea una hora propia. Cambiar hora, duración, proyecto, edición, tarea o descripción la separa (`separated_at`); cobrar o etiquetar no. A quien te propuso un rato (`v_entries.venida_de_id`) no se le puede proponer de vuelta: sale marcado y quieto, en el menú y en el diálogo. La regla solo está en la interfaz, sin disparador en la base.
- **Deshacer una hora recién creada** borra también sus `entry_invitations` explícitamente, aunque la FK sea CASCADE.
- **Eventos de Google Calendar**: se pintan como una propuesta, con icono de calendario. Solo salen las reuniones aceptadas y de la semana que se mira. Al aceptar se guardan `source: "google_calendar"` y el id del evento en `external_id`, para no repetirlos.
- **Ratos agrupados** en el cronómetro: mismo día, mismo proyecto/edición y mismas etiquetas (como conjunto) salen en una fila (`claveGrupo`, en `lista-entradas.tsx`). Editarla cambia todos los de dentro, con Deshacer. Si las descripciones no son todas iguales, la fila dice «Añadir descripción». Con alguna hora cerrada no se puede tocar y dice «Varias descripciones» o «Sin descripción».
- **Continuar** crea una entrada nueva. La entrada en marcha se ve una sola vez por pantalla: en `/panel`, en la barra de arriba (la fila repetida encima de la lista se quitó el 10-sep-2026). Si arranca con la barra fuera de la vista, la página sube hasta ella; `scroll-mt` salva la cabecera fija del móvil. La excepción es el aviso de olvido (siguiente punto).
- **Uno en marcha por espacio** (10-sep-2026), con el índice `time_entries_one_running_per_workspace`. El código manda siempre `p_solo_este_espacio: true` a `start_timer` y `p_workspace_id` a `stop_timer`. Sin esos parámetros, las dos hacen lo de antes (cerrar o parar el que haya en cualquier espacio), que es lo que esperaba el código desplegado cuando se cambió la base. `ProveedorCronometro` lleva `key={espacio.id}` en el layout, así que al cambiar de espacio se remonta también el armazón. Pasadas `SEGUNDOS_OLVIDO` (10 h), `aviso-olvido.tsx` lo dice arriba del contenido, también de los de otros espacios. Si ese espacio pide proyecto, desde ahí no se puede parar, y se dice en qué espacio hay que entrar.
- **Pausar** (11-sep-2026) cierra el rato -como parar- y lo deja apuntado para continuar: `timer_pauses` guarda como mucho una pausa por persona y espacio (`workspace_id`+`user_id` como clave), con el `entry_id` de la hora ya cerrada. `pause_timer(p_workspace_id)` para con las mismas comprobaciones que `stop_timer` (incluido «Elige un proyecto antes de parar el cronometro.» si el espacio lo exige) y apunta la pausa en la misma transacción. Un disparador borra la pausa de esa persona y espacio en cuanto se inserta una hora en marcha (`end_at` null): por eso **«Seguir» es literalmente un `start_timer`** con la configuración de la hora pausada (`p_solo_este_espacio: true`), y no hace falta quitar la pausa a mano. La pausa se lee igual que la entrada en marcha -al cargar el layout y en `recargar()`-, así que «Seguir» sale en todos los dispositivos.
- `/panel`, `/calendario` y `/semana` piden solo entradas terminadas (`soloTerminadas` en `cargarEntradas()`): la que está en marcha ya la trae el layout.
- **Relojes**: las horas apuntadas a mano usan la hora del navegador; `start_timer`, la del servidor.
