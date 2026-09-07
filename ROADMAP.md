# Roadmap

Lo que falta, en el orden en que tiene sentido hacerlo. Se va moviendo a
"Hecho" segun entra en `main`.

## Por arreglar

### Conectar el calendario te cambia de usuario si entraste con correo (29-ago-2026)

Visto al escribir las instrucciones para la revision de Google.
`conectar()` en `ajustes-calendario-google.tsx` llama a
`supabase.auth.signInWithOAuth({ provider: "google", scopes: calendar.readonly })`:
no es "anadir un permiso a la sesion que ya tengo", es **entrar otra vez**,
ahora con Google. La vuelta pasa por `/auth/callback`, que hace
`exchangeCodeForSession` y guarda la conexion contra `data.user.id`, es decir,
contra el usuario que salga de esa entrada.

Para quien entro con Google desde el principio no se nota: es el mismo
usuario. Pero quien se dio de alta con **correo y contrasena** y pulsa
"Conectar Google Calendar" acaba dentro como el usuario de Google que elija
-otra cuenta, sin espacio, con el onboarding delante-, y su cuenta original
se queda sin conexion. En silencio, ademas: no falla nada, simplemente eres
otro.

No ha molestado nunca porque en la practica todo el mundo entra con Google.
El arreglo es `supabase.auth.linkIdentity()` en vez de `signInWithOAuth()`
cuando ya hay sesion -vincula la identidad de Google al usuario actual sin
cambiarlo-, y hay que habilitar el enlazado manual de identidades en el panel
de Supabase (Authentication > Providers). No se toca ahora para no mover el
flujo justo en mitad de la revision de Google.


### Escribir en el movil es incomodo (apuntado el 22-ago-2026)

Contado por Nicolas despues de probarlo en su telefono. **Sin diagnosticar
todavia: esto es lo que dijo, no lo que se ha comprobado.**

1. **Al tocar cualquier campo, hace zoom.** Ojo: el 20-ago ya se subio a 16px
   la letra de `input`, `select` y `textarea` para evitar el zoom de iOS
   Safari -esta en la seccion de la auditoria de movil-, asi que o quedan
   campos por debajo de 16px, o el que usa no es iOS, o el zoom viene de otra
   cosa. Primero medir de verdad: en que pantalla, en que campo y en que
   navegador.
2. **La barra de abajo tapa lo que se escribe.** Con el teclado abierto no
   puede ni seleccionar ni bajar la pagina: tiene que cerrar el teclado,
   seleccionar, y si el campo cae por debajo de la barra no ve ni lo que esta
   apuntando.

**Atacado el 22-ago-2026, a falta de que Nicolas lo pruebe:**

1. **El zoom**: la regla de los 16px existia desde el 20-ago pero **no
   servia de nada**, y por un motivo que merece la pena recordar: estaba
   dentro de `@layer components`, y las utilidades de Tailwind son una capa
   posterior, asi que cualquier `text-sm` o `text-xs` escrito en el propio
   campo la pisaba -y hay siete-. Sacada de la capa, ahora gana a todas.
2. **La barra de abajo tapando**: mientras hay un campo con el foco y el
   teclado abierto, la navegacion inferior se esconde -clase `.no-teclado`,
   que activa el atributo `data-teclado` del `<html>`-, y el campo enfocado se
   lleva al centro de la pantalla.
3. **Saltar de campo**: barra nueva (`barra-teclado.tsx`) flotando encima del
   teclado, con flecha arriba, flecha abajo, "N de M" y un "Listo". Los
   botones actuan en `pointerdown` con `preventDefault` para no soltar el
   foco: si el navegador cierra el teclado, el salto no vale de nada.
4. `interactiveWidget: "resizes-content"` en el viewport, que en
   Chrome/Android hace que el contenido se encoja solo con el teclado.

**No verificado con los ojos**: sin teclado virtual no hay nada que ver, y el
JavaScript que se puede inyectar en estas sesiones corre en un mundo aislado
-falsear `visualViewport` desde ahi no llega a la pagina-. Lo que si se
comprobo es que el efecto se monta y que la medida da ~0 cuando no hay
teclado, que es lo correcto en escritorio. Mientras no haya teclado el
componente no pinta nada, asi que en el peor caso no aparece.

Por donde mirar si no funciona:

- Que barra es la que tapa -la del cronometro del layout de `(app)`, la
  navegacion inferior, o las dos-, y si esta con `position: fixed`. Con el
  teclado abierto, en Android el viewport encoge y lo fijo se queda encima de
  todo; en iOS el teclado ni siquiera cambia `100vh`.
- `100dvh` / `svh` en vez de `vh` donde haga falta, y probar la
  `VirtualKeyboard API` -solo Chrome/Android- o `env(keyboard-inset-height)`.
- `scroll-margin-bottom` en los campos y llevar el foco a la vista al
  enfocarlos (`scrollIntoView({ block: "center" })`), que es lo que arregla el
  "no veo lo que escribo".
- Que la barra inferior se aparte -o se esconda- mientras hay un campo con el
  foco, en vez de pelearse con el teclado.

**Hace falta probarlo en el telefono de Nicolas**: el navegador de estas
sesiones no cambia el ancho de verdad ni levanta un teclado virtual, asi que
esto no se puede ni reproducir ni dar por arreglado desde aqui.

### El calendario en el movil, y los bordes (22-ago-2026)

Nicolas, con el telefono delante: *"esta demasiado cargado, los filtros creo
que sobran"*, el texto de la cabecera *"casi que lo quitaria"*, y **la vista de
un dia** -"que es lo que tienen en Clockify"-. Ademas, los bordes **un pelo
mas redondos, todo**.

- **Un solo dia en el movil, de serie.** Ya existia -tocando un dia se abria
  ese solo- pero habia que descubrirlo, y de entrada se veian siete columnas.
  Ahora en movil se entra directo al dia: hoy si cae en la semana que se mira,
  y si no el lunes. La tira de la semana se queda arriba para saltar de dia, y
  las flechas ‹ › **van de dia en dia**, saltando de semana solas cuando hace
  falta. El titulo dice el dia -"sabado, 22 de agosto"- y el total de al lado
  cuenta **ese dia**, que mirando un dia el total de la semana no dice nada.
  "Esta semana" pasa a ser "Hoy". En escritorio no cambia nada.
- **Los filtros no salen en el movil.** Tres desplegables ocupaban mas que el
  propio calendario; para acotar estan Informes. Se ocultan en el mismo corte
  que usa `useEsMovil` -768px-, para que lo que decide el CSS y lo que decide
  el codigo no se contradigan.
- **El subtitulo tampoco.** El titulo ya dice donde estas.
- **Bordes**: `--radio` 8 -> 12 y `--radio-sm` 6 -> 8, mas los `rounded-[4px]`
  sueltos a 6. Ojo para el futuro: lo que no usa los tokens no se entera de
  estos cambios, y en el codigo hay unos cuantos `rounded-lg`/`rounded-xl` de
  Tailwind por su cuenta.

**Segunda vuelta, el mismo dia, probandolo el en el telefono:**

- **Se pasa de dia deslizando de lado**, como el calendario del movil. Primer
  intento: el desliz saltaba de dia de golpe, y Nicolas lo llamo
  *"hiperbrusco"* -queria que **el calendario se moviera** con el dedo-. Asi
  que en movil se pintan **los siete dias** en una tira que mide siete
  pantallas y se desplaza con `translateX`: el dedo la mueve en vivo -asoma el
  dia de al lado- y al soltar cae en su sitio con una transicion de 0,28 s. No
  cuesta datos: las horas de la semana ya estaban cargadas.
  - El gesto se declara por donde tira mas -12 px de margen- y hasta entonces
    no mueve nada, que si no rodar la pagina desplazaba el calendario un pelin
    en cada roce. `touch-action: pan-y` deja el gesto vertical al navegador.
  - Cambia de dia si el desliz pasa de un tercio del ancho -tope de 110 px-;
    si no, vuelve a su sitio.
  - Con un bloque en la mano no hay desliz: arrastrar un rato empieza
    manteniendo el dedo, asi que los dos gestos no se pisan.
  - **El cambio de semana tambien se suaviza.** Es el unico salto que quedaba
    -el dia siguiente al domingo vive en otra semana y hay que ir a buscarla
    al servidor-. Ahora la tira **sale** medio paso hacia donde ibas y se
    apaga un poco, y cuando llegan los dias nuevos **entra** desde el lado
    contrario: se coloca fuera sin transicion y solo despues se anima, que si
    no se veria volver hacia atras. Ni datos de mas ni semanas precargadas:
    solo el movimiento estirado mientras carga.
- **Fuera las flechas en movil**: con el desliz y la tira de arriba, un tercer
  mando para lo mismo solo ocupaba sitio.
- **El circulo naranja va con el dia que estas mirando**, no con hoy. Antes se
  quedaba clavado en hoy y no acompañaba al desliz. Hoy, cuando no es el dia
  que se mira, se queda con el numero en naranja sin circulo: se siguen
  distinguiendo las dos cosas.
- **El selector de fecha ya no se pisa consigo mismo**: en movil llevaba
  encima nuestro icono de calendario y debajo el del sistema, y desde que los
  campos van a 16px el texto ensancho y se montaban. En movil se quita el
  nuestro, y de paso ese campo salta **al dia** en vez de a la semana.

Probado en vivo forzando el corte de `useEsMovil` para ver la version de movil
en el escritorio -incluido el desliz, con eventos tactiles sinteticos-. Aviso
para la proxima: al cambiar ese corte a mano, el componente no se entera hasta
que algo dispara un `change` del media query; con un `resize_window` se
despierta.

### Mover categorias arrastrando (hecho el 22-ago-2026)

Pedido por Nicolas: en **Categorizacion**, poder coger una categoria y
soltarla en otra area. Antes, si creabas algo dentro de Proyectos y luego lo
querias en Backoffice, habia que borrarlo y volver a escribirlo -y con ello se
perdia lo que colgara de esa categoria-.

**Primer intento, rechazado por Nicolas el mismo dia**: arrastre con el
`draggable` de HTML mas un `<select>` con el area en cada fila. Sus dos
palabras: *"con el movil no puedo cogerlo"* y *"te da informacion repetida,
es una manera cutre"*. Tenia razon en las dos: el arrastre de HTML **no
existe en tactil**, y el selector enseñaba en cada fila el area en la que ya
estaba -decirle a alguien que Care team esta en Backoffice, dentro del bloque
de Backoffice, es exactamente lo que el pidio no hacer nunca-.

**Como quedo**: un **asa** por categoria, con dos gestos y ningun texto de
mas.

- **Arrastrarla** la lleva a otra area, con **eventos de puntero** en vez del
  `draggable` de HTML: eso es lo que hace que funcione con el dedo. El area
  entera es la zona de soltado -apuntar a una linea de un pixel es un castigo,
  y con el dedo mas-, se ilumina con un aro al pasar por encima, y quien esta
  debajo se busca con `elementsFromPoint` saltandose la propia fila.
- **Tocarla** sin arrastrar abre un menu con **las areas a las que puede ir**,
  sin la suya.

Mover es un `update` de `parent_id` y `position`, sin migracion. Los proyectos
que cuelgan se van con ella y **el aviso lo dice** -"Financial team ahora esta
en Conocimiento"-, con Deshacer.

Dos trampas que costaron un rato, las dos del mismo sitio:

- Radix abre el menu en `pointerdown` y entonces **se queda con el puntero**:
  no llegaban ni el `move` ni el `up`, y la fila se quedaba levantada. Se
  corrige con `preventDefault()` en `pointerdown` y abriendo el menu nosotros
  al soltar, solo si no hubo arrastre.
- La fila arrastrada llevaba `pointer-events: none` -para que no estorbara al
  mirar que hay debajo- y eso **anula la captura del puntero**, con el mismo
  resultado. Fuera: para saber sobre que area va, se mira la pila de debajo
  del dedo ignorando la propia fila.

Probado en vivo, y esta vez **el arrastre tambien**: con eventos de puntero si
se puede disparar desde estas sesiones, al contrario que el `draggable` de
HTML. Financial team arrastrada de Conocimiento a Backoffice, aviso, y
devuelta con el menu.

Queda: **reordenar dentro de un area**, que es la misma `position` pero pide
zonas de soltado entre filas.

### Un `<form>` dentro de otro en Gestion > Ajustes (arreglado el 22-ago-2026)

Salio solo, mirando la consola mientras se probaba otra cosa: `ObjetivoHora`
pintaba su propio `<form>` **dentro** del formulario de `AjustesEspacio`. Un
`<form>` anidado es HTML invalido: el navegador se come el de dentro, el HTML
que llega del servidor no cuadra con el que arma el navegador y React
**rehacia el arbol entero de esa pagina** en cada carga -tres errores en
consola, uno de ellos de hidratacion-.

Arreglado: ese bloque es un `div`, el boton guarda con `onClick` y el Enter
sigue guardando desde el campo. El otro formulario del mismo archivo -el
objetivo por proyecto- no esta anidado y se queda como estaba. Comprobado en
vivo: la consola de `/gestion/ajustes` ya no da ningun error.

### Formularios con el tacto de Revolut (22-ago-2026)

**De donde sale la idea**: de un video de Instagram de **zanderwhitehurst**,
que Nicolas tiene guardado. Si se retoma esto, mirarlo antes -el video manda
sobre lo que este escrito aqui-.

Son dos cosas distintas:

1. **El pulsado, suave.** Al apretar, el elemento crece un pelin y se tine un
   poco -mas oscuro en claro, mas claro en oscuro-. **Hecho el 22-ago-2026**:
   token `--pulsado` en los tres temas y `:active` en `.btn`, mas una clase
   `.pulsable` para lo que se pulsa y no es un boton -las tarjetas de elegir
   del alta, las filas de espacios de `/bienvenida`-. El tinte va como capa
   (`box-shadow: inset ... 999px`), no como fondo, para que valga igual sobre
   el blanco de una tarjeta que sobre el azul de un boton primario. De paso,
   `touch-action: manipulation` y `-webkit-tap-highlight-color: transparent`:
   sin el retardo de 300 ms del navegador ni el destello gris de Android, que
   se pisaba con lo nuestro.

   Extendido el mismo dia a las **filas y tarjetas de proyecto**. Los chips y
   las filas de horas siguen sin pulsado propio: llevan botones dentro y
   escalar la fila entera al tocarlos se veria raro.

2. **La barra sobre el teclado, pendiente.** Flotando justo encima del teclado
   cuando se abre, con una flecha arriba y otra abajo para saltar al campo
   anterior o al siguiente. Es lo que arregla de verdad la queja de
   "Escribir en el movil es incomodo" de aqui arriba: hoy hay que cerrar el
   teclado para poder moverse por el formulario.

   Por donde va: `env(keyboard-inset-height)` y la `VirtualKeyboard API`
   -Chrome/Android- para saber donde acaba el teclado; en iOS, `visualViewport`
   y sus eventos `resize`/`scroll`. La barra se pinta con la lista de campos
   del formulario y mueve el foco al de al lado, llevandolo a la vista.
   **Hace falta el telefono de Nicolas**: desde estas sesiones no hay teclado
   virtual que levantar, asi que no se puede ni probar ni dar por bueno.

### Revision a fondo del 21-ago-2026

Nicolas pidio repasar la aplicacion entera sin esperar respuesta -codigo,
usabilidad, backend, seguridad, movil y escritorio- y arreglar lo que
hiciera falta. Encontrado y arreglado por el camino:

- **Doble consulta de sesion y catalogo en la ficha de proyecto**:
  `generateMetadata` y la propia pagina de `proyectos/[id]` pedian cada una
  por su cuenta `getSesion()` y `cargarCatalogo()`, asi que cada carga de
  esa pagina eran cuatro consultas en vez de dos. `getPerfil`,
  `getPertenencias`, `getSesion` (en `src/lib/sesion.ts`) y `cargarCatalogo`
  (en `src/lib/datos.ts`) van ahora envueltas en `cache()` de React, que
  comparte el resultado entre quien las pida dentro del mismo request. De
  paso beneficia a `layout.tsx` de `(app)`, que tambien pide `getSesion()`
  en cada pagina.
- **Se contaban dos veces las horas de un proyecto con ediciones y un cierre
  general a la vez**: `resumenDeResultados` (en
  `src/components/resultados-proyecto.tsx`) sumaba las horas de un cierre
  sin edicion por rango de fechas, sin excluir las horas que ya pertenecian
  a una edicion con su propio cierre. Si ese cierre general se reguardaba
  despues de crear ediciones, su periodo se estiraba hasta hoy y las horas
  de cada edicion contaban dos veces: una por su `edition_id`, otra por caer
  dentro del rango del cierre general. Corregido ahi y en
  `tarjetas-edicion.tsx` -mismo criterio en la tarjeta individual, no solo
  en el resumen agregado-. Verificado con datos reales: el proyecto CLOCKIFY
  DUPLICADO tenia exactamente este caso, y las horas facturables pasaron de
  contar 18s (el doble) a los 9s reales.
- **No habia paginas propias de error ni de "no encontrado"**: un
  `notFound()` -por ejemplo, entrar a la ficha de un proyecto borrado- o
  cualquier excepcion sin capturar caian en las paginas genericas de
  Next.js, sin marca. Ahora hay `not-found.tsx` y `error.tsx` dentro de
  `(app)` -mantienen la barra lateral visible, porque el limite de error no
  envuelve el layout de su propio segmento- y en la raiz, para
  acceso/auth/bienvenida y para cualquier URL que no case con ninguna ruta;
  mas `global-error.tsx` por si se rompe el layout raiz -con su propio
  html/body y el mismo script de tema que el layout real, porque ese
  archivo no hereda estilos globales de forma automatica-. Los `error.tsx`
  usan `retry()` en vez de `reset()` -estable desde Next 16.3, vuelve a
  pedir los datos ademas de limpiar el estado-. Probado en vivo: id de
  proyecto inexistente, URL fuera de toda ruta, y una excepcion forzada
  temporalmente para comprobar que el limite la capturaba bien.
- **Cinco funciones de base de datos expuestas por RPC sin necesidad**:
  el asesor de seguridad de Supabase marcaba unas 20 funciones como
  ejecutables por `anon`/`authenticated` via `/rest/v1/rpc/...`. La mayoria
  son intencionadas -`create_workspace`, `join_workspace`,
  `responder_invitacion` y similares, que el cliente llama de verdad, o
  predicados como `is_admin`/`is_member` que ademas se usan por dentro de
  varias politicas RLS y **no se pueden tocar sin arriesgarse a romperlas**-,
  asi que se dejaron como estaban. Pero cinco no tenian ningun motivo para
  estar expuestas: `aplicar_estilo_descripcion`, `aplicar_estilo_nombre`,
  `separar_si_cambia` y `set_local_date` son disparadores puros -viven de
  `new`/`old`, fallan solas si se llaman fuera de un disparador, y el codigo
  no las llama nunca a mano-, y `normalizar_texto_existente` la llama el
  cliente pero solo para un administrador ya autenticado (la propia funcion
  ya rechaza a quien no lo sea). Revocado el `EXECUTE` de las cuatro
  primeras para `anon` y `authenticated`, y el de la quinta solo para
  `anon`. **Ojo con el detalle que costo un intento en falso**: revocar de
  esos dos roles con nombre no sirvio de nada la primera vez porque las
  funciones tenian `EXECUTE` concedido a PUBLIC desde que se crearon -el
  comportamiento por defecto de Postgres-, y PUBLIC se aplica pase lo que
  pase con los roles concretos; hubo que revocarlo de PUBLIC. Comprobado
  con `has_function_privilege` antes y despues de cada intento, y en vivo
  arrancando y parando el cronometro de verdad -`set_local_date` sigue
  poniendo bien el dia de cada hora nueva-.
- **RPC `espacio_por_codigo` se podia llamar sin sesion**: a diferencia de sus
  funciones hermanas del mismo modulo (`unirse_con_codigo`, `create_workspace`,
  `join_workspace`...), no comprobaba `auth.uid()` -un
  `POST /rest/v1/rpc/espacio_por_codigo` con solo la apikey publica, sin
  sesion, devolvia 200 con el nombre del espacio y la lista de nombres de
  plazas libres de cualquier `join_code` valido, saltandose la RLS que
  protege esa misma tabla (`workspace_seats`) para todo lo demas. Convertida
  de `sql` puro a `plpgsql` -el `sql` puro no admite `if`- para poder añadir
  la misma comprobacion `if auth.uid() is null then raise exception...` que
  ya tenian sus hermanas, sin tocar columnas devueltas ni el filtro por
  `join_code`. Comprobado en vivo: sin sesion (curl con la apikey publica y
  sin cookie) ahora responde 401 con `{"code":"42501",...}` en vez de datos;
  y `/unirse/[codigo]` sigue cargando bien con una sesion real -navegador,
  workspace NITTON, sin llegar a enviar el formulario de unirse-.
- **`refresh_token` de Google Calendar, legible en teoria desde el
  navegador**: la RLS de `google_connections` deja `SELECT` a
  `user_id = auth.uid()`, y el rol `authenticated` tenia privilegio de
  columna sobre `refresh_token` -el comentario de la tabla dice que nunca
  sale al navegador, pero nada en la base lo impedia-.
  - **Arreglado**: `desconectar()` en `ajustes-calendario-google.tsx`
    borraba la fila desde el cliente sin revocar nada en Google. Ahora hay
    una accion de servidor (`desconectarGoogle`, en
    `src/app/(app)/calendario/acciones.ts`) que llama a
    `https://oauth2.googleapis.com/revoke` con el token antes de borrar la
    fila -sin bloquear el borrado local si la llamada a Google falla, solo
    lo deja registrado-.
  - **Bloqueado, sin tocar**: el
    `REVOKE SELECT (refresh_token) ON google_connections FROM authenticated`
    no se ha aplicado. `src/lib/google.ts` y `calendario/acciones.ts` leen
    hoy ese token con el cliente normal de servidor (rol `authenticated`, la
    clave publica + cookies de sesion), no con un cliente de service role, asi
    que revocar el privilegio ahora mismo rompia esa lectura legitima. No
    existe `SUPABASE_SERVICE_ROLE_KEY` en el proyecto -ni en `.env.local` ni
    en el codigo, y no hay forma de generarla ni leerla desde aqui-.
    Documentado en `.env.example` lo que hace falta: añadirla desde el panel
    de Supabase (Project Settings > API > service_role secret key), montar un
    cliente de servidor con ella para leer/escribir `refresh_token`, y
    entonces si aplicar el `REVOKE` y comprobarlo con
    `has_column_privilege`.
- **El alta contaba si un correo ya tenia cuenta**: `mensajeError` traducia
  el error de Supabase "User already registered" a un mensaje que confirmaba
  la cuenta existente -inconsistente con recuperar contraseña, que responde
  igual exista o no la cuenta-. Cambiado a un mensaje neutro ("Revisa tu
  correo para continuar.") en `src/lib/errores.ts`, sin tocar el resto del
  flujo de `/acceso`.
- **`join_code` generado con `Math.random()`**: la funcion que genera el
  codigo de union estaba duplicada en `asistente-inicio.tsx` y
  `gestion-plazas.tsx`. Sacada a una sola (`nuevoCodigo`, en
  `src/lib/utils.ts`) que usa `crypto.getRandomValues` sobre el mismo
  alfabeto de 32 caracteres -sin sesgo de modulo, `2**32` es multiplo de
  32- y la misma longitud de 10.
- **`todayKey()` y `startOfWeek()` de servidor usaban el reloj del proceso,
  no el huso del workspace**: panel, informes, estadisticas, la ficha de
  proyecto, perfil y gestion/categorias calculaban "hoy" con `todayKey()`
  sin argumento -en produccion, UTC-, mientras `local_date` la calcula un
  disparador de Postgres en el huso de cada workspace (`workspaces.timezone`,
  hay 12 disponibles). Entre las 00:00 y la 1-2 de la madrugada en hora
  local, una hora recien fichada quedaba fuera del panel y de los informes
  porque el servidor todavia creia que era ayer. `todayKey()` y
  `startOfWeek()` (en `src/lib/time.ts`) aceptan ahora la zona horaria como
  parametro -con `Intl.DateTimeFormat`, sin libreria nueva- y las seis
  paginas le pasan `espacio.timezone` (mas `calendario` y `semana`, mismo
  fallo al calcular la semana en curso cuando no hay `?semana=` en la URL).
  Sin zona horaria caen a Europe/Madrid, para el codigo de cliente que no
  tiene el workspace a mano. Verificado con un script Node: 21-ago 22:30 UTC
  da "22-ago" en Europe/Madrid y "21-ago" en UTC; probado tambien con
  Pacific/Auckland para un huso muy distinto del servidor.
- **Crear una entrada a mano que cruza un cambio de horario guardaba un fin
  equivocado**: el dialogo "Nueva entrada" del calendario
  (`rejilla-calendario.tsx`) y "Añadir a mano" del cronometro
  (`barra-cronometro.tsx`) calculaban el fin sumando milisegundos de
  duracion al epoch del inicio, en vez de construirlo con componentes
  locales como ya hacia `confirmar()` (arrastrar/mover/estirar) en el mismo
  `rejilla-calendario.tsx`. Si por medio habia un cambio de hora, el fin
  guardado quedaba desplazado una hora. Corregido en los dos sitios;
  verificado con un script Node que replica el codigo real: 29-mar-2026
  (cambio a verano) 01:30-03:15 guardaba antes las 04:15 y ahora las 03:15;
  25-oct-2026 (vuelta a invierno) 01:30-03:30 guardaba antes las 02:30 y
  ahora las 03:30.
- **"Horas que han apuntado contigo" podia mostrar el dia UTC en vez del
  local**: `propuestas-pendientes.tsx` sacaba la fecha con `.slice(0, 10)`
  de un `start_at` en UTC -para propuestas de madrugada, el dia UTC y el
  local no siempre coinciden-. Cambiado a `toDateKeyInZone` (nueva funcion
  en `src/lib/time.ts`, misma idea que ya usaba bien `calendario/page.tsx`
  con `toDateKey(new Date(...))`) con `espacio.timezone` via `useSesion()`.
- **El calendario no pedia a Google los eventos del lunes por la manana**:
  `calendario/page.tsx` construia el `timeMin` con `fromDateKey(lunes)`, que
  da mediodia local, no medianoche -para la semana del 17-23 ago 2026 el
  limite real quedaba en las 12:00 CEST del lunes, asi que cualquier
  reunion que terminara antes no se pedia nunca-. Nueva funcion
  `startOfDayInZone` en `src/lib/time.ts` (medianoche real en el huso del
  workspace) para los dos limites de `eventosDeGoogle`. Verificado con un
  script Node: medianoche del 17-ago-2026 en Europe/Madrid cae en
  `2026-08-16T22:00:00.000Z`, no en el `T10:00:00Z` que daba `fromDateKey`.
- **El reparto por defecto no daba a cada uno lo que generaron sus propias
  horas, sino una proporcion de horas en bruto**: `calcularAtribucion` (en
  `src/lib/reparto.ts`) repartia el `total` de cada ambito proporcional a
  `duration_seconds`, lo que solo coincide con "cada uno se lleva lo suyo"
  si todos cobran la misma tarifa -en cuanto hay tarifas distintas por
  persona (`rates.user_id`), transferia dinero de quien cobra mas caro a
  quien cobra mas barato-. `total` ya es la suma de los `amount` de ese
  ambito (cada `amount`, calculado en la vista `v_entries`, viene a la
  tarifa propia de quien apunto la hora), asi que ahora se atribuye
  directamente el `amount` de cada persona, sin prorratear. Verificado con
  un script Node que replica la funcion real: A a 50€/h y B a 30€/h, 1h cada
  uno en el mismo proyecto -antes daba 40€/40€ a los dos, ahora 50€/30€, los
  reales-; y un caso con 3 personas y tarifas distintas (80€/75€/30€) donde
  la suma repartida sigue cuadrando exacto con el `total` del grupo (185€).
  Los modos "equitativo", "porcentajes" y "equipo" no cambian.
- **El reparto por porcentajes se podia guardar sin sumar 100%, perdiendo
  dinero en silencio**: `gestion-reparto.tsx` solo avisaba con un texto
  ("se guarda igual, pero revisalo") si la suma no daba 100%, y si todos los
  porcentajes eran ≤0 se filtraban antes del insert y el 100% desaparecia
  sin repartirse a nadie. Ahora se bloquea el guardado -boton deshabilitado
  y error explicito con la suma actual y cuanto falta o sobra- cuando la
  suma de los porcentajes validos (>0) no esta a ±0.5% de 100, incluido el
  caso de suma efectiva 0. Probado en el navegador sobre el espacio NITTON,
  ambito KONSULTEK: 60%+40%(otra persona)=60% no dejaba guardar (con error
  visible y sin crear fila en `revenue_splits`), y al añadir hasta sumar
  100% exacto si guardo con normalidad; reparto de prueba borrado despues.
- **Faltaba una restriccion que evitara reintroducir el doble conteo de
  `project_results` por carrera de escritura**: `Tarjeta.guardar()` (en
  `tarjetas-edicion.tsx`) hace "buscar y luego insertar", asi que dos
  guardados casi simultaneos para el mismo ambito podian crear dos filas
  con el mismo `(project_id, edition_id)` -o dos "cierres generales" con
  `edition_id` nulo, que una `UNIQUE` normal no pilla porque Postgres trata
  cada NULL como distinto-. Comprobado antes por SQL que no habia
  duplicados reales -solo 2 filas en `project_results`, ambitos distintos-,
  asi que se aplicaron dos indices unicos: `project_results_scope_unique`
  (`project_id, edition_id`) y `project_results_general_unique`, parcial,
  sobre `project_id` `WHERE edition_id IS NULL`. Probado con un insert de
  prueba dentro de una transaccion que se revierte sola: choca con
  `project_results_general_unique` como se esperaba. Añadido tambien el
  mensaje en `src/lib/errores.ts` para el error `23505` de estos dos
  constraints -"Alguien mas acaba de guardar este resultado, recarga y
  vuelve a intentarlo"-, mismo patron que ya tenia `one_running_per_user`.

Segunda pasada el mismo dia, esta vez accesibilidad y movil:

- **Los 4 modales caseros de la app no atrapaban el foco, ni bloqueaban el
  scroll de fondo, ni devolvian el foco al cerrar**: `dialogo-entrada.tsx`,
  el "Editar proyecto" de `gestion-proyectos.tsx`, "Horas que han apuntado
  contigo" (`DialogoInvitacion`, dentro de `rejilla-calendario.tsx`) y
  `guia-inicial.tsx` eran un `<div className="fixed inset-0 ...">` a mano
  -como mucho con un `useEffect` para Escape, `guia-inicial.tsx` ni eso-,
  mientras el resto de la app (`nuevo-proyecto.tsx`,
  `ajustes-calendario-google.tsx`, y los otros dos dialogos que ya conviven
  en `rejilla-calendario.tsx`) usa `@radix-ui/react-dialog`. Con Tab el foco
  se escapaba a la fila de debajo, oculta bajo el overlay. Migrados los 4 a
  Radix, con las mismas clases del patron ya existente en el mismo archivo
  -tarjeta centrada en escritorio, hoja inferior en movil, mismo overlay y
  sombra-. **Detalle no obvio**: Radix solo devuelve el foco al cerrar
  cuando quien abre es un `Dialog.Trigger`; estos 4 se abren desde botones
  sueltos en otros componentes (una fila de hora, el lapiz de un proyecto,
  un bloque del calendario, "Ver la guia otra vez" en el perfil), asi que
  hizo falta guardar a mano el elemento con foco justo antes de montarse
  -`useRef` con inicializador perezoso en los que se montan de nuevo cada
  vez que se abren, y una variable de modulo en `guia-inicial.tsx`, que
  ademas se abre sola sin ningun boton la primera vez que alguien entra- y
  devolverselo en `onCloseAutoFocus`. Se reviso tambien si
  `dialogo-entrada.tsx` se abre distinto en movil y escritorio: no lo hace
  -mismo componente en sus 4 llamadas (`fila-entrada.tsx`,
  `detalle-proyecto.tsx`, `panel-informes.tsx`, `rejilla-calendario.tsx`),
  solo cambia por CSS responsivo entre hoja inferior y tarjeta centrada-,
  aunque en `fila-entrada.tsx` en concreto de escritorio ni se abre desde la
  fila -ahi la descripcion y la duracion se editan en linea, y el dialogo
  entero solo hace falta en movil o desde Informes y la ficha de proyecto-.
  Probado en el navegador, sesion real de NITTON: Tab atrapado dentro del
  dialogo en `dialogo-entrada.tsx` (via Informes), "Editar proyecto",
  `guia-inicial.tsx` (reabierta desde el perfil) y el dialogo de editar hora
  del calendario; Escape cierra los 4; `body { overflow: hidden }` mientras
  cualquiera esta abierto; y el foco vuelve exactamente al boton que lo
  abrio en los tres que se pudieron abrir con un elemento enfocable de
  verdad. "Horas que han apuntado contigo" no se pudo probar en vivo -no
  habia ninguna invitacion pendiente real en el espacio, y no parecia buena
  idea fabricar una entre las dos personas reales del workspace solo para
  probar un dialogo-, pero usa exactamente el mismo patron que
  `DialogoAceptarGoogle` y `DialogoNuevaEntrada`, ya con Radix, en el mismo
  archivo.
- **El mapa de calor de Estadisticas no respondia al tacto**: `MapaDeCalor`
  en `panel-estadisticas.tsx` solo llevaba `onMouseEnter`/`onMouseMove`/
  `onMouseLeave` para su propio tooltip -sin `title` nativo desde el
  20-ago-, asi que tocar una celda en movil no hacia nada. Es el hueco que
  quedaba apuntado mas abajo, en Estadisticas ("en tactil no hay hover de
  verdad, conviene ver como se siente tocarlas"): el resto de graficas de la
  pagina usan el `Tooltip` de `recharts`, que ya responde solo al tacto,
  pero el mapa de calor es una rejilla de `<span>` a mano, sin ese
  mecanismo. Añadido `onClick` a cada celda: toca una y el tooltip se queda
  fijo -tocar la misma celda otra vez lo cierra, tocar otra celda cambia a
  esa, tocar fuera de la rejilla tambien cierra-. Probado en el navegador
  con clics reales sobre las celdas (mismo `onClick` que dispara un toque):
  abre, alterna entre celdas y cierra al tocar fuera, los tres casos.
- **Contraste insuficiente del naranja "corriendo ahora" en modo claro**:
  `--live` en `globals.css` (`#d1720a`) daba ~3.2-3.4:1 sobre blanco y sobre
  `--live-soft`, por debajo del minimo AA de 4.5:1 para texto normal -se usa
  de verdad, no solo decorativo, en `compartir-con.tsx`,
  `tarjetas-edicion.tsx` y `barra-cronometro.tsx`. Oscurecido a `#a75b08`:
  mismo tono y casi la misma saturacion que el original (H~31°, S~91% los
  dos), solo baja la luminosidad de 43% a 34% -calculado con la formula de
  luminancia relativa WCAG-, lo que da ~5,1:1 sobre blanco y ~4,7:1 sobre
  `--live-soft`. Modo oscuro sin tocar, ya estaba bien. Comprobado en el
  navegador en modo claro: el numero del dia de hoy en el calendario, el
  chip de "con quien mas cuenta" (`compartir-con.tsx`) y el cronometro en
  marcha (`barra-cronometro.tsx`, arrancado y descartado de nuevo para no
  dejar rastro) se siguen leyendo bien como naranja.

Verificado ademas `npm run lint` y `npm run build` limpios tras los 4
arreglos de arriba.

Tercera pasada el mismo dia, esta vez rendimiento:

- **El layout de `(app)` no tenia ningun fallback visual mientras carga**:
  `layout.tsx` hacia `await getSesion()` (usa `cookies()`, dato "runtime") y
  la consulta de la entrada en marcha sin ningun `<Suspense>` propio. Sin
  Cache Components activado (no lo esta, `next.config.ts` no lo declara), un
  `loading.tsx` de pagina no cubre el fetch del layout de un segmento
  superior -confirmado contra
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`
  (lineas 88-93) y `layout.md` (lineas 316-345, patron "Interaction with
  loading.js") de esta instalacion de Next 16.3.1-: la navegacion se
  bloqueaba sin ningun aviso hasta que el layout entero terminaba. Movido lo
  que depende de la sesion/entrada en marcha a un componente de servidor
  dedicado (`MarcoSesion`, dentro del propio `layout.tsx`) envuelto en su
  propio `<Suspense fallback={<EsqueletoMarco />}>` -`ProveedorAvisos`, que no
  depende de ningun dato, se queda fuera para que ni el espere-. Nuevo
  `src/components/esqueleto-marco.tsx`, que solo calca las medidas de
  `Armazon` (ancho de la barra lateral, alto de la cabecera movil), sin tocar
  los esqueletos de pagina que ya arreglo la pasada de accesibilidad.
  Verificado con datos concretos, no solo por lectura del codigo: con un
  `await new Promise(r => setTimeout(r, 1500))` temporal dentro de
  `MarcoSesion` y un `fetch` con lector de stream desde la propia pagina
  (`response.body.getReader()`), el primer chunk -con el esqueleto
  `animate-pulse`- llego a los 266ms, y el contenido real
  (`LALCANTARA`, un proyecto real) no aparecio hasta pasados los ~1,9s del
  delay; sin el delay, el chunk con el esqueleto sigue llegando primero
  (213ms) y el resto del contenido detras. Delay retirado despues de medir.
- **`eventosDeGoogle` duplicaba la validacion de auth, fuera del `cache()`
  del propio 21-ago**: creaba su propio cliente de Supabase y llamaba a
  `supabase.auth.getUser()` directamente, en vez de recibir el usuario ya
  resuelto por `getSesion()`/`getPerfil()` (`src/lib/sesion.ts`, envueltas en
  `cache()` de React) que `calendario/page.tsx` ya tiene a mano -un
  round-trip real y evitable contra el servidor de Auth de Supabase en cada
  carga de `/calendario`. Ahora `eventosDeGoogle` (en
  `src/app/(app)/calendario/acciones.ts`) recibe `userId` por parametro.
  Verificado con datos concretos: como esta llamada es servidor-a-Supabase
  -invisible en el Network tab del navegador, que solo ve navegador-a-Next-,
  se instrumento temporalmente `getPerfil()` para contar llamadas a
  `auth.getUser()` por request (log en un fichero) y se simulo tambien
  temporalmente la llamada duplicada que tenia `eventosDeGoogle` antes del
  arreglo: con la duplicada, 2 llamadas por carga de `/calendario`, la
  segunda 292ms despues de la primera; sin ella (el codigo real, ya
  arreglado), 1 sola. Instrumentacion retirada despues de medir.
- **La entrada en marcha se pedia dos veces**: `layout.tsx` ya la trae via
  `time_entries` para la barra del cronometro, y por separado
  `cargarEntradas()` (`src/lib/datos.ts`) la volvia a traer sin querer al
  consultar `v_entries` para `/panel`, `/calendario` y `/semana` -las tres la
  descartan despues en cliente (`lista-entradas.tsx`, `src/lib/calendario.ts`
  y `tabla-semana.tsx` ya ignoraban explicitamente las filas sin `end_at`).
  Nuevo parametro opcional `soloTerminadas` en `cargarEntradas()` que añade
  `.not("end_at", "is", null)` a la consulta, activado solo en esas tres
  paginas -informes, estadisticas, la ficha de proyecto, perfil y
  gestion/categorias siguen trayendola igual que antes, sin cambios de
  comportamiento. Confirmado por codigo que `duration_seconds` es `null` para
  una entrada sin `end_at` (todo el codigo existente ya la trata como `?? 0`,
  y `trozosDelDia`/`tabla-semana.tsx` ya la descartaban antes de este
  cambio), asi que quitarla de la consulta no cambia ninguna cifra, solo deja
  de viajar por la red de mas.
- **`recharts` sin carga diferida**: `resumen-proyecto.tsx` (la ficha de
  proyecto) importaba `recharts` -varios cientos de KB- de forma sincrona
  para un unico grafico de barras, aunque de todas formas necesita medir su
  contenedor en el navegador antes de pintar nada. Sacado el grafico a
  `src/components/grafico-resumen-proyecto.tsx` y cargado con
  `next/dynamic(..., { ssr: false })` desde `resumen-proyecto.tsx`, con un
  bloque `animate-pulse` como `loading`. Verificado comparando el build de
  produccion antes/despues: antes, el `page_client-reference-manifest.js` de
  `/proyectos/[id]` referenciaba dos chunks de recharts (~38KB + ~377KB);
  despues del cambio, ninguno de los chunks de recharts del build aparece ya
  en ese manifest -se comprobo tambien que `/estadisticas` y `/informes`
  (sin tocar, siguen usando recharts sin diferir) los siguen referenciando
  con normalidad-. Probado ademas en el navegador: la ficha de LALCANTARA
  sigue pintando el grafico de barras con normalidad tras el cambio.
  `panel-informes.tsx` (un solo grafico, similar de sencillo) y sobre todo
  `panel-estadisticas.tsx` (cuatro graficos distintos en un archivo de mas de
  1400 lineas, bastante mas riesgo de romper algo) tambien importan recharts
  sin diferir; no se tocaron en esta pasada -se prioriza lo pedido
  explicitamente- y quedan pendientes si compensa el esfuerzo.
- **`router.refresh()` en 74 sitios de 31 archivos** -cada arranque/parada de
  cronometro, cada edicion de una hora, cada cambio de proyecto...-: cada
  llamada abre un ambito de request nuevo, asi que el ahorro del `cache()` de
  sesion (getPerfil/getPertenencias/getSesion/cargarCatalogo, del primer
  arreglo del 21-ago) se dedupe dentro de un request pero se paga entero de
  nuevo en cada accion del usuario. **No arreglado, solo documentado**:
  arreglarlo de verdad significa rediseñar hacia invalidacion mas granular
  -`revalidateTag`, actualizacion optimista de estado en cliente-, un cambio
  de arquitectura demasiado grande para esta pasada.

Verificado `npm run lint` y `npm run build` limpios tras los arreglos de
rendimiento de arriba.

Cuarta pasada el mismo dia, esta vez un bug de "Deshacer" al compartir horas:

- **"Deshacer" al crear+compartir una hora no retiraba las invitaciones ya
  enviadas**: el aviso de "Deshacer" que sigue a crear una hora -calendario
  "Nueva entrada", aceptar un evento de Google Calendar, y "Añadir a mano"
  desde la barra del cronometro- solo borraba la `time_entries` recien
  creada: `DialogoNuevaEntrada.guardar` y `DialogoAceptarGoogle.aceptar` en
  `rejilla-calendario.tsx`, y `EntradaManual.guardar` en
  `barra-cronometro.tsx`. Si esa hora se habia propuesto a algun compañero
  (checkbox "Tambien cuenta para"), las filas de `entry_invitations` ya
  insertadas -con proyecto, descripcion y horas ya copiados- se quedaban
  vivas: el compañero podia seguir aceptando una propuesta que quien la creo
  ya habia retirado. Comprobado antes de tocar nada que
  `entry_invitations.origin_entry_id` SI tiene `ON DELETE CASCADE` hacia
  `time_entries(id)` -consultado `pg_constraint` via MCP de Supabase, solo
  lectura-, asi que en teoria el borrado de la entrada ya arrastraba las
  invitaciones sin ayuda del codigo. Pero el arreglo no se apoya en ese
  detalle de esquema: los 3 sitios borran ahora `entry_invitations` por
  `origin_entry_id` explicitamente, antes del borrado de `time_entries`,
  mismo estilo `.from(...).delete().eq(...)` que ya usaba el resto de cada
  archivo -mejor un borrado explicito de mas que un silencio implicito que
  dependa de que nadie quite el cascade en una migracion futura-. Probado en
  vivo, sesion real de NITTON: hora de 2h propuesta a ANE ETXEBARRIA desde
  "Nueva entrada" del calendario, "Deshacer" pulsado desde el aviso -que
  cambia a "Quitada." solo si las dos operaciones terminan sin error, justo
  lo que hace el codigo nuevo-, y confirmado por SQL (solo lectura) que no
  queda ninguna fila ni en `time_entries` ni en `entry_invitations` para esa
  entrada. Sin rastro de la prueba en el espacio real al terminar.

Verificado `npm run lint` y `npm run build` limpios tras el arreglo de
arriba.

Con este ultimo bug se cierran los 6 grupos de la revision a fondo del
21-ago-2026: seguridad, zona horaria/DST, financiero, accesibilidad/movil,
rendimiento y este bug de "Deshacer" al compartir horas.

### Google OAuth y correo de produccion

Configurado el 20-ago-2026: cuenta `hitooclock@gmail.com` con proyecto propio
en Google Cloud, pantalla de consentimiento publicada, credenciales pegadas
en Supabase. Pendiente de probar el flujo completo una vez despliegue el
arreglo del boton de cerrar sesion (necesario para probarlo mas de una vez
seguida). Sigue pendiente el SMTP propio: los correos van con el servicio por
defecto de Supabase, con limite bajo -no vale para que lo use otro equipo-.

**Pendiente: pedir la verificacion de Google.** La pantalla de consentimiento
esta publicada pero sin verificar, y el scope de Calendar (`calendar.readonly`,
pedido aparte del login en `ajustes-calendario-google.tsx`) es de los que
Google considera sensibles: mientras no este verificada, a cualquiera que
conecte el calendario le sale el aviso de "app no verificada", y Google corta
en seco a partir de ~100 personas que lo hayan aceptado. El login normal con
Google (sin calendario) no se ve afectado.

**Enviada el 23-ago-2026, y Google ya ha contestado.** Proyecto
`hitoo-506113` (numero 917208882470). El correo que llego a
`hitooclock@gmail.com` el 23-ago -asunto "[Action Needed] OAuth Verification
Request Acknowledgement", del Third-Party Data Safety Team- no es un rechazo:
es la ronda normal de "nos falta esto". Pedian cuatro cosas.

Estado a 29-ago-2026:

1. **Politica: con quien se comparten los datos de usuario de Google.**
   HECHO (commit "el token de Google se guarda cifrado..."). Apartado nuevo
   "Con quien se comparten" en `/privacidad`, con los cuatro destinatarios
   reales: el resto del espacio de trabajo, Supabase, Vercel y Google. El que
   faltaba de verdad y que Google habria acabado encontrando: **al convertir
   un evento en hora fichada, su titulo pasa a ser la descripcion de la hora y
   la ve todo el espacio**.

2. **Politica: que mecanismos protegen los datos sensibles.** HECHO, mismo
   commit. Apartado "Como se protegen": TLS y HSTS, cifrado en reposo, cifrado
   propio del token, RLS en la base, minimo privilegio con Google, revocacion
   al desconectar y cabeceras del navegador.

   Al escribirlo aparecio el problema de fondo: **la politica ya afirmaba que
   el token se guardaba cifrado, y era mentira**. `refresh_token` era `text`
   en claro y `has_column_privilege('authenticated', ..., 'refresh_token',
   'SELECT')` daba `true`. Arreglado de verdad con `src/lib/cifrado.ts`
   (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), no reescribiendo la frase. Esto
   cierra tambien el punto que la revision del 21-ago dejo como "bloqueado,
   sin tocar" -ya no hace falta la `service_role` key para el `REVOKE`: el
   privilegio sigue ahi, pero devuelve texto cifrado-.

   **Ojo, falta una mano**: `TOKEN_ENCRYPTION_KEY` esta puesta en `.env.local`
   pero **no en Vercel**. Hasta que este en Production y Preview y se
   redespliegue, conectar un calendario nuevo en produccion no guarda la
   conexion -se registra el error y sale como no conectado-. Las tres
   conexiones que ya existian siguen funcionando y se cifraran solas la
   primera vez que se abra el calendario con la clave puesta.

3. **Video de demostracion**, con un detalle que no estaba en el guion de
   abajo: la pantalla de consentimiento tiene que verse **con todos los
   permisos desplegados y legibles** -si Google los agrupa, hay que pulsar
   "Mostrar todos los servicios"/"Show all services"-. PENDIENTE, solo lo
   puede grabar Nicolas.

4. **Credenciales de una cuenta de prueba** para que el equipo de Google entre
   en la app, sin verificacion por telefono ni nada que les frene, mas
   instrucciones paso a paso. HECHO el 29-ago-2026: cuenta
   `hitooclock+google@gmail.com` con el correo ya confirmado -comprobado que
   entra-, espacio "Equipo de demostracion" con 4 ramas, 5 proyectos y 36
   horas de las tres ultimas semanas, y enlace de invitacion con tres plazas
   libres, `https://www.hitoo.es/unirse/4thp5yhrn2`. La contrasena no se
   escribe en el repo -es publico-: va directa en el correo a Google.

   Al preparar las instrucciones aparecio el detalle de `signInWithOAuth`
   -ver "Por arreglar"-, asi que el camino que se les indica es entrar con
   Google desde el primer paso y unirse con el enlace, no con la cuenta de
   correo. Todo el guion esta en `VERIFICACION-GOOGLE.md`.

Los puntos 1 y 2 se envian **reenviando la ficha desde Cloud Console**; los 3
y 4, **respondiendo a ese mismo correo**. Hay que hacer las dos cosas.

Guia paso a paso -lo que ya esta hecho, lo que se comprobo en vivo el
21-ago-2026 y el texto exacto para copiar y pegar en cada paso que solo puede
hacer Nicolas (necesita sus propias cuentas de Google Cloud/Search Console y
el panel de Vercel: ninguna herramienta de este entorno tiene acceso a esas
tres cosas)-:

1. ✅ **Hecho el 21-ago-2026**: pagina publica de politica de privacidad en
   `/privacidad` (`src/app/privacidad/page.tsx`), enlazada desde el pie de la
   portada, con la clausula obligatoria de la Google API Services User Data
   Policy. Tuvo que añadirse a `PUBLIC_PATHS` en `src/lib/supabase/session.ts`
   -si no, el proxy la redirigia a `/acceso`-. Probada en vivo: responde 200
   sin sesion.

2. ✅ **Hecho, `hitoo.es` resuelve** (comprobado en vivo el 21-ago-2026:
   `hitoo.es` y `www.hitoo.es` ya salen en los dominios del proyecto en
   Vercel, y ambos responden). ✅ **Variables de entorno confirmadas por
   Nicolas**: puestas tanto en Preview como en Production
   -[vercel.com/nittonnis-projects/hitoo/settings/environment-variables](https://vercel.com/nittonnis-projects/hitoo/settings/environment-variables)-.

   **Detalle importante**: Vercel dejo `www.hitoo.es` como canonico -el apex
   `hitoo.es` hace un 308 permanente hacia `https://www.hitoo.es/`,
   comprobado con curl-. No es un fallo, es como quedo configurado el
   dominio, pero significa que **el enlace "de verdad" a usar en todos los
   sitios (formulario de Google, politica de privacidad, etc.) es
   `https://www.hitoo.es`, no `https://hitoo.es` a secas** -si se usa el
   apex funciona igual porque redirige, pero es un salto de mas-.
   Panel del proyecto en Vercel, por si hace falta revisar algo mas:
   [vercel.com/nittonnis-projects/hitoo](https://vercel.com/nittonnis-projects/hitoo).

   **HECHO el 22-ago-2026** en
   [supabase.com/dashboard/project/zyjtymxkkfpecpfqqvpn/auth/url-configuration](https://supabase.com/dashboard/project/zyjtymxkkfpecpfqqvpn/auth/url-configuration)
   (proyecto `nitton-horas`, Authentication -> URL Configuration):
   - **Site URL**: `https://hitoo.vercel.app` -> `https://www.hitoo.es`.
   - **Redirect URLs añadidas**: `https://www.hitoo.es/auth/callback**`,
     `https://www.hitoo.es/auth/confirmar` y
     `https://www.hitoo.es/auth/confirmar**`. Se dejaron las de
     `hitoo.vercel.app` y `localhost:3000` para no romper el preview ni el
     desarrollo local.

   Ojo con el comodín: ya estaba `https://www.hitoo.es/auth/callback` **sin
   `**`**, y no servía de nada. Supabase compara el `redirect_to` entero,
   query incluida, y `boton-google.tsx` siempre manda `?next=...`, así que la
   URL exacta no encajaba y GoTrue caía callado al Site URL: entrar con Google
   desde www.hitoo.es te sacaba a hitoo.vercel.app. Es el mismo fallo que ya se
   arregló el 20-ago-2026 para vercel.app y localhost (por eso esos llevan
   `**`); al añadir el dominio nuevo se volvió a colar.

   Para comprobarlo sin efectos secundarios, en cualquier proyecto Supabase:
   `GET /auth/v1/verify?token=bogus&type=signup&redirect_to=<url>` y mirar la
   cabecera `Location` -si la URL está permitida redirige a ella; si no, al
   Site URL-. No manda correos ni crea sesiones. `/authorize` no vale para
   esto: acepta cualquier `redirect_to` sin quejarse.

3. ✅ **Hecho** (comprobado el 29-ago-2026: `hitoo.es` responde con el TXT
   `google-site-verification=JPgZdgAL...` y a `hitooclock@gmail.com` le llegan
   ya avisos de Search Console del sitio). **Verificar la propiedad de
   `hitoo.es` en Google Search Console**, con la cuenta `hitooclock@gmail.com`:
   - Entrar en [search.google.com/search-console](https://search.google.com/search-console/welcome)
     -pagina principal de Search Console; si pide iniciar sesion, usar
     `hitooclock@gmail.com`-.
   - Boton **Añadir propiedad** (o el selector de propiedades arriba a la
     izquierda -> Añadir propiedad).
   - Elegir el tipo **"Dominio"** (no "Prefijo de URL") y escribir `hitoo.es`
     -verifica el dominio entero de una vez, `hitoo.es` y `www.hitoo.es`
     incluidos, mejor que verificar solo uno de los dos-.
   - Search Console genera un registro **TXT** en ese momento -copiarlo tal
     cual-. Añadirlo en Hostinger: entrar en
     [hpanel.hostinger.com](https://hpanel.hostinger.com/) -> **Dominios** ->
     `hitoo.es` -> **DNS / Nameservers** -> añadir registro TXT con el valor
     que dio Search Console.
   - Esperar a que propague (puede tardar) y volver a Search Console a pulsar
     **Verificar**.
   - Necesario para poder marcar `hitoo.es` como **dominio autorizado** en la
     pantalla de consentimiento de OAuth (paso 6).

4. **Justificacion del scope `calendar.readonly`** -texto ya redactado,
   listo para copiar y pegar tal cual en el formulario de verificacion de
   Google (en ingles, que es lo que revisa el equipo de Google, y mas corto
   de lo que suelen pedir -~120 palabras-)-:

   > hitoo is a time-tracking app for small teams. Team members can
   > optionally connect their Google Calendar to see their upcoming meetings
   > inside hitoo and log them as tracked work hours with one click, instead
   > of typing the same information twice. We request calendar.readonly
   > because we only need to read the user's event list (title, start/end
   > time, attendees) to display it inside the app — hitoo never creates,
   > edits, or deletes any calendar event. The access token is stored
   > encrypted and is only ever read server-side; it is never sent to the
   > browser. Users can disconnect Google Calendar at any time from Settings,
   > which immediately revokes the grant with Google as well as deleting the
   > stored token.

5. **Video de demostracion** -vale no listado en YouTube, no hace falta
   publico-. Guion de ~1-2 minutos, en este orden exacto (es lo que Google
   quiere ver: la pantalla de consentimiento real y el uso real del scope):
   1. Entrar en hitoo con una cuenta real (no hace falta que sea admin).
   2. Ir a **Ajustes -> Calendario** y pulsar **Conectar Google Calendar**.
   3. Dejar que se vea entera la pantalla de consentimiento de Google -el
      nombre de la app, el logo y el permiso pedido tienen que leerse bien-.
   4. Aceptar, volver a hitoo, y enseñar que ahora pone "Conectado".
   5. Ir a **Calendario** o a **Semana** y enseñar una reunion aceptada de
      Google apareciendo como invitacion -borde a rayas- en la rejilla.
   6. Hacer clic para aceptarla y enseñar que se convierte en una hora
      fichada de verdad.
   7. Opcional pero recomendable: volver a Ajustes y pulsar **Desconectar**,
      para que quede grabado que tambien se puede revocar.

   Para grabar la pantalla en Windows: `Win + G` (Xbox Game Bar, viene de
   serie) -> grabar -> el video queda en `Videos\Captures`. Subirlo a YouTube
   como **"Oculto"/"No listado"** y usar ese enlace en el formulario.

6. **Repasar el resto de la ficha.** Entrar en
   [console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
   -pagina directa a la Pantalla de consentimiento de OAuth-. **Importante**:
   arriba a la izquierda, junto al logo de Google Cloud, comprobar que el
   selector de proyecto muestra el proyecto de `hitoo` -el creado el
   20-ago-2026 con la cuenta `hitooclock@gmail.com`-, no otro proyecto de
   Google Cloud si la cuenta tiene varios. Boton **Editar aplicacion**:
   - **Nombre de la aplicacion**: `hitoo` -tal cual, SIN el `.es`-. Esto se
     nos quedo fuera de esta guia la primera vez y causo dos avisos reales
     el 21-ago-2026 al pasar la verificacion automatica con `hitoo.es`
     puesto ahi: "el nombre de la app no coincide con el de la pagina
     principal" y, en cascada, "en la pagina principal no se explica el
     proposito de la app" -la pagina principal (`https://www.hitoo.es/`)
     dice "hitoo" en todas partes, nunca "hitoo.es", asi que el
     comprobador automatico de Google no conseguia relacionar el nombre
     configurado con el contenido de la pagina y fallaba los dos avisos a
     la vez, aunque el titulo y la meta-descripcion de la portada
     -"Control de horas para equipos LEINN: cronometro, calendario, hoja
     semanal, proyectos e informes"- ya explican bien el proposito.
     Cambiando el nombre a `hitoo` deberian desaparecer los dos avisos
     juntos; si el de "proposito no explicado" sigue apareciendo despues de
     corregir el nombre y de que Google vuelva a comprobarlo, avisar para
     ampliar el texto visible de la portada con una frase mas literal.
   - Son dos campos separados en el formulario de Google, no uno solo:
     - **Pagina principal de la aplicacion** (App home page):
       `https://www.hitoo.es/` -la portada de verdad, la que explica que es
       hitoo-.
     - **Enlace a la politica de privacidad** (App privacy policy link):
       `https://www.hitoo.es/privacidad` -esta si es la de privacidad-.
     Los dos con `www`, que es el dominio canonico en Vercel (ver nota del
     paso 2); el apex `hitoo.es` tambien vale porque redirige, pero mejor
     poner el bueno directamente. **Comprobado el 21-ago-2026**: al primer
     intento la pagina principal se habia escrito sin la barra final
     (`https://www.hitoo.es` en vez de `https://www.hitoo.es/`) y el aviso
     de "proposito no explicado" seguia saliendo -aunque el servidor
     responde 200 exactamente igual con o sin barra, comprobado con curl-;
     al añadir la barra el aviso se resolvio. El comprobador de Google
     parece exigir la URL exacta, barra incluida: escribirla tal cual esta
     aqui arriba, no de memoria.
     poner el bueno directamente.
   - Dominios autorizados: añadir `hitoo.es` (tras verificarlo en el paso 3;
     Google cubre `www.hitoo.es` solo con el dominio raiz, no hace falta
     añadir el subdominio aparte).
   - Correo de asistencia y correo de contacto del desarrollador:
     `hitooclock@gmail.com`.
   - Logo: usar `public/icons/icon-512.png` directamente -ya es PNG y ya es
     cuadrado (512x512, el icono de la app, no el wordmark de
     `hitoo-logo.svg`, que es rectangular y no sirve para este campo tal
     cual-. Comprobado visualmente: fondo oscuro redondeado con la "h"
     blanca, se ve bien como logo pequeño.
   - Enlace a terminos de servicio: opcional, se puede dejar en blanco si no
     existen todavia.

7. ✅ **Hecho el 23-ago-2026** (y contestado por Google el mismo dia: ver el
   estado de arriba). **Enviar a revision**: en la misma pagina del paso 6
   -[console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)-,
   boton **Enviar para verificacion** (o "Publicar aplicacion" primero, si
   sigue en modo Prueba, y luego enviar a verificacion). La revision de
   scopes sensibles (no restringidos, `calendar.readonly` no pide auditoria
   CASA) suele tardar dias, no semanas. Google puede escribir por correo
   pidiendo aclaraciones -revisar `hitooclock@gmail.com`-.

Resumen de quien hace que, a 29-ago-2026: los pasos 1 a 7 estan todos hechos
-la ficha se envio el 23-ago-. Lo unico que queda es la ronda de respuesta:
pegar `TOKEN_ENCRYPTION_KEY` en Vercel, crear la cuenta de prueba, grabar el
video con los permisos desplegados, reenviar la ficha desde Cloud Console y
contestar al correo. El texto de la respuesta esta en `VERIFICACION-GOOGLE.md`.
Las cuatro cosas exigen la sesion de Nicolas en Google, Vercel o el telefono:
no hay atajo desde aqui.

### Faltan estados de carga: la pantalla se queda parada y de golpe aparece todo

Apuntado por Nicolas el 20-ago-2026. En varios sitios de la app, mientras se
espera la respuesta de Supabase no hay ningun aviso -ni esqueleto, ni
spinner-, asi que da la sensacion de que se ha quedado colgado. Luego aparece
todo de golpe. Confunde bastante, sobre todo en conexiones lentas o con listas
largas.

**Arreglado el 20-ago-2026** para las paginas principales: `loading.tsx` de
Next.js (panel, calendario, informes, semana, estadisticas, proyectos
-incluida la ficha, que cae en el mismo- y gestion -incluidas todas sus
subpaginas: equipo, categorias, tarifas, importar, ajustes-), con un esqueleto
generico y reutilizable (`EsqueletoPagina`, el mismo patron de bloques grises
`animate-pulse` que ya usaba el formulario de `/acceso`). Se nota tanto al
navegar entre paginas como al recargar, mientras se resuelve la consulta a
Supabase de esa pagina.

**Cerrado el 20-ago-2026**: el tramo de la sesion del layout (`getSesion` +
el cronometro en marcha), que ningun `loading.tsx` de seccion cubria, ahora
tiene el suyo en `src/app/loading.tsx` -un spinner centrado, sin ligar a
ningun layout a proposito, porque tambien cubre las paginas publicas antes
del propio `(app)`-. Probado en vivo: la portada publica sigue cargando
igual que antes.

**Cerrado el 21-ago-2026**: los tres esqueletos que mas se notaban seguian
siendo bloques genericos sin relacion con su pagina -`panel/loading.tsx` un
solo bloque de 160px para una pagina con cronometro, resumen y una lista
larga; `estadisticas/loading.tsx` tres bloques de 112px para mandos, 4
cifras, un grafico de 256px, mapa de calor y tablas; `calendario/loading.tsx`
sin la cabecera de dos columnas (titulo+subtitulo a la izquierda, ajustes de
Google a la derecha)-. Los tres ahora calcan la estructura real -misma
disposicion en tarjetas/rejilla, mismo orden, alturas del mismo orden de
magnitud-, compuestos a mano con un nuevo `BloquePulso` (`esqueleto-pagina.tsx`,
el rectangulo suelto que ya usaba por dentro `EsqueletoPagina`, ahora
exportado para poder combinarlo en grid/flex en vez de solo apilado). El resto
de `loading.tsx` que ya usaban `EsqueletoPagina` tal cual (semana, gestion,
informes, perfil, proyectos) siguen igual, sin tocar. Comparado contra las
paginas reales en el navegador (sesion NITTON) para calibrar los tamaños;
capturar el propio parpadeo del esqueleto en las capturas no salio -el
servidor local responde demasiado rapido para que la captura de pantalla lo
alcance a tiempo-, asi que quedo verificado por estructura y altura, no visto
en el momento exacto de la carga.

### Filtro "marcar todos" se queda atras si se crea algo nuevo mientras esta activo

Visto el 20-ago-2026 en revision de codigo, en
`src/components/filtro-multiple.tsx`. No es un fallo del "Marcar todos" del
19-ago -al reves, el diseño es a proposito: guarda la lista explicita de ids
para poder luego ir quitando uno ("todos menos este"), que es todo el sentido
del boton-.

El roce es otro: si mientras ese filtro sigue activo se crea un proyecto, una
rama o una etiqueta nueva, la casilla de cabecera se da cuenta sola -pasa de
marcada a "5/6"-, pero **el informe o la estadistica que esta mirando esa
persona en ese momento no avisa**, solo deja de contar la entrada nueva. Pasa
igual en cualquier filtro de la app que se deje a medias sin querer, no es
exclusivo de este boton.

Que hacer, a decidir: o bien un aviso visible cuando el filtro activo ya no
cubre todo lo que hay ("hay 1 proyecto nuevo fuera del filtro"), o bien
aceptar que es el precio de tener el boton de "todos menos este" y dejarlo
documentado. No toco el codigo hasta decidir cual.

### Continuar arranca, pero no se nota

Diagnosticado el 19-ago-2026. **Si funciona**: al pulsarlo se crea una entrada
nueva que empieza en ese momento, con el mismo proyecto, tarea, etiquetas,
descripcion y si se cobra. Se comprobo en el navegador y quedo el rastro en
los datos de Nicolas: una entrada de **2 segundos** a las 02:42, que es
exactamente el patron de arrancar y parar enseguida al no ver nada.

El problema era que **no se veia**: el cronometro se ponia en marcha en la
barra de arriba y en la lateral, pero la lista de horas -que es donde estas
mirando cuando pulsas- no cambiaba nada. Parecia que el boton no habia hecho
nada.

**Arreglado el 20-ago-2026**: la entrada en marcha sale ahora como una fila
propia, teñida de naranja, encima de toda la lista -`FilaEnMarcha`, en
`src/components/lista-entradas.tsx`-, contando en vivo con el mismo reloj de
la barra y con un boton de parar directo ahi. Se edita desde la barra, igual
que antes; aqui solo se ve y se para. Al pulsar Continuar en cualquier hora de
abajo, la fila aparece al instante en el sitio donde se estaba mirando.

Ojo tambien: las dos entradas iguales de LALALA a las 09:00 no son de
continuar, son del boton de duplicar. Conviene mirar si duplicar deberia
avisar de algo, porque deja dos filas identicas sin mas.

### Las horas compartidas no se ven

Revisado el 20-ago-2026: la mayoria de esto ya estaba hecho, y esta nota se
habia quedado desactualizada.

Ya resuelto: se proponen desde el cronometro, el calendario y el dialogo de
apuntar a mano (informes y ficha de proyecto); si estas solo en el espacio,
la barra lo explica en vez de esconder el selector ("Trae a tu equipo..."); y
cada entrada enseña con quien mas cuenta y en que estado -pendiente, aceptada,
rechazada- con su propio boton (`CompartirCon`, en `fila-entrada.tsx`).

Sigue sin poder proponerse **desde la hoja semanal**, que es el mismo punto 5
de la lista de pendientes de mas abajo.

## Enfoque LEINN

Todo esto sale de la sesion del 18-ago-2026, al girar el producto de "horas
para un equipo" a "horas para cualquier equipo de LEINN".

### Estado a 19-ago-2026

Hecha toda la lista de la sesion. Por encima: nombre ClockLEINN; portada
publica de producto en `/` -con lo que hace, la categorizacion, las ediciones,
los tres pasos y las preguntas de siempre- y aplicacion en `/panel`;
categorizacion de dos niveles con objetivo por rama, visible en el listado de
proyectos y con una columna por nivel en informes y Excel; ediciones de
proyecto en las cuatro pantallas donde se apuntan horas; objetivos de dia,
semana y rama con lo que falta a la vista; horas compartidas desde el
cronometro, con el selector siempre visible y con quien mas cuenta cada hora
en su propia fila; etiquetas que se crean desde el selector; ninguna hora
suelta -ni al parar, ni a mano, ni en el calendario- si el espacio lo exige;
resumen del cronometro con tres huecos a gusto de cada uno; informes con
filtro y desgloses por categoria y por edicion y descarga completa; tildes y
enes; menu lateral con la gestion desplegada.

Repasada tambien la seguridad el 19-ago: cerrado el redirect abierto de
`?volver=` y `?next=`, contestar una propuesta se queda en manos de quien la
recibe, revocado el permiso de ejecutar las funciones a quien no ha entrado y
los disparadores a todo el mundo, y cabeceras puestas -nosniff, marcos
denegados, HSTS y politica de contenido en produccion-. Icono propio en su
sitio.

Y en la ultima tanda: deshacer lo ultimo que se hizo en bloque -incluido el
borrado, que devuelve la fila entera con su origen-, apartado de
**Estadisticas** (doce meses, reparto por rama, presupuestos), aviso de los
dias laborables sin apuntar, filtro de abiertas y cerradas, guia de despliegue
e icono propio.

Y el 19-ago por la noche: los informes dejan de ser de solo mirar -se corrige
una hora pulsandola, o varias a la vez: moverlas de proyecto, marcarlas como
facturables, ponerles etiqueta, cerrarlas o borrarlas-, la bienvenida pregunta
por fin si se quiere la plantilla de LEINN, hay guia rapida la primera vez
(y un boton en el perfil para volver a verla) y buscador en proyectos.

Y la tanda del 20-ago: **cualquiera del espacio corrige las horas de
cualquiera** -el dinero sigue siendo de quien gestiona, y lo cerrado sigue
cerrado-, con rastro de quien toco cada hora; **proyecto y edicion se eligen a
la vez** en el mismo desplegable; las duraciones se leen en `hh:mm:ss` y las
descargas llevan la duracion legible y el decimal para sumar; los **clientes**
se crean desde el proyecto y el catalogo pasa a ser su resumen; y el importador
pregunta si el campo *Cliente* del CSV es un cliente o la rama del equipo.

Repaso de UX del 20-ago: apuntar a mano ya deja elegir el dia, el calendario
abre por donde se trabaja, deshacer sale abajo al borrar una hora -y duplicar y
borrar viven detras de los tres puntos-, y el alta del equipo se hace **al
estilo Tricount**: quien administra escribe los nombres, reparte un enlace y
cada uno dice cual es el suyo.

**Pendiente**:

0. **Repaso de UX en movil**. Apuntado por Nicolas el 20-ago-2026, y pedido
   sin esperar respuesta el mismo dia: no solo la distribucion, tambien que
   pasa al deslizar, si el teclado tapa algo, si se puede deslizar bien.

   **Auditoria hecha por codigo el 20-ago-2026** -aviso honesto: el
   navegador de esta sesion no deja cambiar el ancho de la ventana de
   verdad (`resize_window` no cambia lo que de verdad se renderiza), asi
   que nada de esto se ha visto con los ojos a un ancho de movil real.
   Falta que Nicolas lo mire desde su telefono, que es justo lo que ya
   tenia pendiente hacer el mismo-.

   Arreglado, con bastante confianza porque son bugs claros leyendo el
   codigo:
   - **Zoom automatico de iOS al tocar un campo**: cualquier `input`,
     `select` o `textarea` con letra menor de 16px hace que iOS Safari
     amplie toda la pagina al enfocarlo -pasaba en todos los formularios,
     `.field` estaba en 14px-. Con un `@media` que solo toca movil/tablet
     (hasta 1023px, el mismo corte que ya usa el resto de la app para
     barra lateral/inferior) se sube a 16px ahi sin tocar el tamaño en
     escritorio.
   - **El dialogo de editar una hora podia quedarse sin sitio para
     Guardar**: `dialogo-entrada.tsx` -el que se abre en movil al tocar
     cualquier hora, y tambien desde informes y la ficha de proyecto- no
     tenia limite de alto ni scroll propio. Con el teclado ocupando media
     pantalla, un formulario largo (descripcion, proyecto, fecha, horas,
     etiquetas, compartir) se podia salir por abajo sin forma de llegar al
     boton de guardar. Ahora tiene el mismo patron que ya usaba el dialogo
     de aceptar reuniones de Google -alto maximo 90vh, cabecera y pie
     fijos, y el cuerpo con scroll propio-. Comprobado que los
     desplegables de dentro (proyecto, etiquetas, compartir) no se cortan,
     porque son de Radix y se pintan fuera del dialogo (`Popover.Portal`).

   Revisado y **ya estaba bien hecho**, sin tocar nada:
   - El arrastre del calendario para crear/mover horas ya usa Pointer
     Events (raton y dedo con el mismo codigo), con mantener pulsado 350ms
     en tactil antes de empezar a arrastrar -para no confundirlo con hacer
     scroll de la pantalla-, tolerancia de 8px de movimiento y vibracion al
     empezar. Nivel de detalle ya muy por delante de lo tipico.
   - Las tablas anchas (informes) ya ruedan por dentro de su propio
     contenedor (`overflow-x-auto`) en vez de estirar toda la pagina.
   - Las filas de filtros (informes, estadisticas) ya usan `flex-wrap`, y
     alguna ya cambia a rejilla de 2 columnas en movil a proposito.
   - Los desplegables de proyecto/etiquetas ya limitan su ancho a
     `100vw - 2rem` para no salirse en pantallas estrechas.
   - `min-h-dvh` en el armazon general -la unidad correcta para que la
     barra del navegador movil no monte encima del contenido-, y la barra
     inferior ya respeta `env(safe-area-inset-bottom)` del iPhone.

   Queda por mirar con el telefono de verdad, no solo leyendo el codigo:
   - Si el zoom de iOS queda bien arreglado de verdad en un iPhone real
     -el `viewport` no lleva `maximum-scale` a proposito: bloquear el zoom
     del todo es peor, hay quien lo necesita para leer-.
   - Estadisticas tiene ahora bastantes graficas interactivas (clic para
     cruzar, hover con desglose): en tactil no hay "hover" de verdad, asi
     que conviene ver como se siente tocarlas -el primer toque puede que
     solo enseñe el aviso en vez de filtrar, hay que probarlo-.
   - Los dialogos cortos (nuevo proyecto, ajustes de Google Calendar) se
     quedaron sin el mismo tratamiento de alto maximo/scroll -su contenido
     es corto, pero conviene confirmarlo con el teclado abierto de verdad-.
   - Tamaño de los botones pequeños (borrar, cerrar) para el dedo: no se
     ha medido ninguno a proposito.


1. **Desplegar**: `DESPLIEGUE.md` lleva los pasos en orden -Vercel, las URLs de
   Supabase, las credenciales de Google, el dominio- con lo que hay que
   comprobar despues de cada uno. Es lo unico que separa esto de que lo use
   otro equipo de LEINN, y necesita las cuentas de Nicolas.
2. **En el panel de Supabase, a mano**: activar la proteccion de contrasenas
   filtradas y subir el minimo a 8 caracteres. Dos interruptores.
3. ~~Aprobar horas~~ **descartado el 20-ago-2026**: dentro de un equipo LEINN
   nadie tiene que aprobar las horas de otro -cerrar ya vale, y con eso basta-.
   Solo tendria sentido si esto se usa para empresas de fuera de LEINN, y ese
   caso no esta decidido todavia. No implementar mientras siga sin decidir.
4. **La hoja semanal solo deja editar las tuyas**. Para un administrador
   tendria sentido tambien ahi; en el calendario y en los informes ya se puede.
5. **Horas compartidas, tercera vuelta**: proponerlas desde la hoja semanal, y
   avisar a quien ya acepto si luego cambia la hora o se borra.
6. **Rendimiento, cuando crezca**: casi todas las paginas cargan el catalogo
   entero y los informes traen el rango completo. Con cien proyectos y dos anos
   de horas habra que paginar.
7. **Ojo con las tildes**: rutas e identificadores SIN tilde -son URLs y
   carpetas- y textos CON ella. Un `href="/gestión"` da 404; ya paso.

## Siguiente

### 1. Estadisticas

Un apartado propio, mas alla de los informes: en que se va el tiempo, como
evoluciona mes a mes, cuanto se factura de lo que se trabaja, que proyectos se
comen el presupuesto. Los informes de ahora responden "que horas hay"; esto
tiene que responder "como vamos".

**Reconstruccion a fondo el 20-ago-2026**, pedida por Nicolas explicitamente
("bien bien hecha"). Plan completo en la sesion; por encima:

- **Granularidad explicita**: boton Dia/Semana/Mes/Año junto al periodo,
  independiente del rango -antes solo lo decidia el tamaño del rango-.
  `unidadPara`/`serie` en `src/lib/estadisticas.ts` ganan la unidad "ano".
- **Objetivos**: seccion nueva, siempre de hoy/esta semana al margen del
  periodo que se mire arriba -objetivo diario y semanal del espacio, y una
  fila por cada rama con objetivo semanal puesto (`categories.goal_weekly_minutes`,
  que ya existia pero no se enseñaba en ningun sitio fuera de Gestion).
- **Reparto de facturacion**: hasta ahora cada uno se llevaba el dinero de sus
  propias horas por su propia tarifa, sin mas. Nicolas explico que en NITTON
  el dinero de un proyecto se reparte de formas distintas segun el caso -por
  horas metidas, a partes iguales entre quien participo, por un % fijo puesto
  a mano, o entre todo el equipo aunque no haya metido horas-. Nuevo, en
  Gestion → Tarifas: tablas `revenue_splits`/`revenue_split_shares` (mismo
  patron de "mas especifico gana" que `rates`: edicion > proyecto > espacio,
  sin historico -un modo activo por ambito-), logica pura en
  `src/lib/reparto.ts` (`resolverReparto`/`calcularAtribucion`), UI en
  `src/components/gestion-reparto.tsx`. Con eso, Estadisticas trae una seccion
  **Coste por hora, por persona** con el €/h real de cada uno segun como se
  reparte de verdad, no solo sus propias horas.
- **Cruce al clic, tipo Power BI**: una sola seleccion activa a la vez -clic
  en un area del donut, un proyecto, o una persona, y el resto de la pagina
  se acota a eso al instante: cifras, "como va el ritmo", mapa de calor,
  todos los desgloses-. Segundo clic en lo mismo lo quita; hay un chip junto
  a los mandos para quitarlo tambien desde ahi. Probado en vivo: se cruza
  desde el donut, desde "quien lo pone" y desde "los proyectos que mas
  pesan", y cascada a todo lo demas correctamente.
- **El donut ya cuenta algo al pasar el raton**: antes solo enseñaba las
  horas totales del area. Ahora el tooltip trae el desglose por proyecto y
  por persona dentro de esa area -queja concreta de Nicolas-.
- Aprovechado de paso: `database.types.ts` se regenero entero desde el
  esquema real -cerraba una tarea pendiente del roadmap, los tipos de
  `entry_invitations`/`resumen_proyectos` ya no estan puestos a mano-.

Verificado con `npx tsc --noEmit`, `eslint` y `npm run build` limpios, y en
el navegador: reparto por porcentajes creado y borrado de verdad en Tarifas,
granularidad forzada probada en un rango de 12 meses, tooltip del donut con
desglose real, y el cruce al clic probado en las tres direcciones con
capturas de pantalla en cada paso.

**Rematado el 20-ago-2026**: faltaba clic y atenuado en "A cuánto sale la
hora" -era la unica grafica de la dimension proyecto que no cruzaba con el
foco-, ya arreglado; y el ultimo hueco de las paginas de carga, la sesion
del propio layout de `(app)` -quien eres, si tienes el cronometro en
marcha-, que ningun `loading.tsx` de seccion llegaba a cubrir. Nuevo
`src/app/loading.tsx`, sin ligar a ningun layout a proposito -tambien cubre
las paginas publicas, con un spinner centrado que no da por hecho ningun
armazon-. Probado en vivo: `A cuánto sale la hora` cruza con las demas
graficas de proyecto -para eso hizo falta un tramo con una tarifa y un
reparto de prueba puestos y quitados a mano en Tarifas-, y la portada
publica carga igual que antes con el `loading.tsx` nuevo de por medio.

Queda pendiente si hace falta: decidir si vale la pena paginar el reparto en
Tarifas si algun dia hay muchos proyectos con reparto propio.

**Mismo estilo de hover en todas partes, el 20-ago-2026**: a Nicolas le
gustaba el hover del donut -titulo, desglose por proyecto y por persona- y
pidio que fuera el mismo en el resto de graficas con tooltip. Sacado a un
componente compartido (`CajaTooltip`, en `panel-estadisticas.tsx`) y puesto
tambien en "Como va el ritmo" (desglose por proyecto/persona de ese punto
del tiempo), "Quien lo pone" (por proyecto de esa persona) y "A cuanto sale
la hora" (por persona de ese proyecto). El donut se reescribio para usar el
mismo componente en vez de tener su version aparte.

De paso, arreglado un bug que encontro Nicolas mirando esto: el color de
cada area del donut salia de su posicion en la lista -al filtrar y quedar
una sola area visible, esa area pasaba a ser la primera y "robaba" siempre
el azul, aunque su color de siempre fuera otro-. Ahora el color de cada area
sale de un mapa fijo calculado sobre el catalogo entero
(`categoriasRaiz(catalogo.categorias)`), no de la lista filtrada: cada area
mantiene su color se mire como se mire.

Probado en vivo: hover en las cuatro graficas con datos reales, y
comprobado que "PROYECTOS" se queda verde al filtrar aunque quede sola,
en vez de pasar a azul.

**Mapa de calor sin aviso feo del navegador, el 20-ago-2026**: "Cuándo se
trabaja" avisaba con el `title` nativo del HTML al pasar el ratón por una
casilla -el globo gris cutre del navegador-. Ahora sigue al cursor con la
misma caja (`CajaTooltip`) que el resto de graficas, con `position: fixed`
para no cortarse contra el scroll horizontal del propio mapa. Mismo dato de
siempre, solo mejor puesto.

**Hover del donut arreglado del todo, el 20-ago-2026**: Nicolas vio que el
tooltip del donut se plantaba a veces en medio y tapaba otras porciones, sin
dejar clicar. Primer intento -seguir el cursor a mano con estado de React en
cada `mouseenter`, igual que el mapa de calor- **no funciono**: cada entrada
en una porcion volvia a montar esa porcion entera, y el clic que venia justo
detras se perdia por el camino -confirmado en vivo: el clic en la leyenda
seguia funcionando siempre, el clic directo en el donut fallaba a menudo-.
Revertido a como estaba, con dos cambios de verdad:

- `CajaTooltip` (el componente que ya usan las cuatro graficas) lleva ahora
  `pointer-events-none`: la caja del hover nunca puede tapar un clic,
  aunque se dibuje encima de otra porcion.
- El `<Tooltip>` del donut lleva `offset={28}` en vez del valor por defecto,
  para que se separe mas del anillo y no se pegue a la porcion de al lado.

Probado en vivo repetidas veces: clic en una porcion filtra correctamente
-cifras, listas y mapa de calor se acotan-, el hover ya no se ve pegado al
centro, y no hay perdida de clics.

### 2. Integracion con Google Calendar

Traer los eventos del calendario y convertirlos en horas con un clic, sin
teclear.

**Hecho el 20-ago-2026, version completa**: conectar (boton visible "Conectar
Google Calendar" arriba del calendario, ya no un icono pequeño) pide el
permiso de calendario aparte del login normal -no se le pide a quien nunca
vaya a usarlo-, y guarda el token de refresco en su propia tabla
(`google_connections`, RLS por persona, nunca llega al navegador).

La primera version enseñaba los eventos dentro del dialogo de ajustes; se
corrigio el mismo dia porque no era eso lo que hacia falta. Ahora, igual que
"Clockify": **las reuniones aparecen directamente en la rejilla del
calendario**, con el mismo aspecto que una hora que ha apuntado otra persona
del equipo -borde a rayas del color del proyecto (aqui sin color, gris), sin
sumar al total hasta que se acepta-, y solo el icono de la esquina cambia
(calendario en vez de personas). Un clic abre un dialogo pequeño para elegir
proyecto -obligatorio si el espacio no deja horas sueltas- y aceptar: crea la
hora de verdad, con `source: "google_calendar"` y el id del evento en
`external_id`, mismo criterio que Clockify para no repetir si se vuelve a
abrir la semana.

Solo se traen reuniones **ya aceptadas en el propio Google Calendar** -si
tiene invitados, hace falta `responseStatus: "accepted"`; si es un evento
propio sin invitados, cuenta directo-, y solo las de la semana que se esta
mirando en ese momento, nunca en el cronometro. Probado de principio a fin en
local con un evento sintetico: aparece en su sitio, aceptar crea la hora con
el color y el proyecto correctos, e "Ignorar" la descarta sin guardar nada.

Encontrado y arreglado de paso: las Redirect URLs de Supabase no llevaban
comodin, asi que el `?next=...` que se añade en cada vuelta no encajaba con
la URL exacta guardada y la sesion caia al Site URL de produccion en vez de
volver a donde se estaba -afectaba a todo login con Google, no solo a esto-.

Arreglado el 20-ago-2026: al aceptar un evento, el desplegable del selector
de proyecto tapaba el resto de la tarjeta -etiquetas, facturable,
compartir-, asi que el clic fuera para cerrar solo el desplegable sacaba sin
querer del dialogo entero. Ahora el primer clic fuera cierra solo el
selector; hace falta un segundo clic para salir de la tarjeta. Mismo arreglo
aplicado a "Nueva entrada", que usa el mismo selector y tenia el mismo roce.

**Decisiones que quedan abiertas**:

- "Ignorar" no se guarda en ningun sitio: si se cierra el dialogo sin
  aceptar, la reunion vuelve a aparecer la proxima vez que se cargue la
  semana. Si molesta, hace falta una tabla de "descartados" -no se ha hecho
  porque no esta claro que compense la complejidad para algo que se ve una
  vez por semana.
- que hacer cuando el evento cambia de hora en Google despues de haberlo
  aceptado en hitoo: hoy no se entera, cada uno vive su vida.

### 3. Proyectos: buscar y ficha mas completa

**Hecho el 22-ago-2026.** Lo de "buscar por cliente" se cae solo: no hay
clientes desde el 19-ago. Buscar por nombre y por categorizacion, y el filtro
de activos/archivados, ya estaban; lo que faltaba de verdad era ordenar, el
presupuesto y el dinero que aun no se ha cerrado.

En el listado (`panel-proyectos.tsx`):

- **Orden**: por nombre -como venian del catalogo-, mas horas, mas reciente,
  presupuesto apurado y, solo para quien ve importes, mas facturado. Los que
  no tienen horas o presupuesto caen al final, no al principio.
- **Filtro de presupuesto**: le queda margen / se ha pasado / sin presupuesto.
  El mando solo aparece si algun proyecto tiene presupuesto puesto: un filtro
  que no puede cambiar nada es ruido.
- **Cuanto suma lo que se esta mirando**, en un chip junto al titulo -cuantos
  proyectos, cuantas horas y cuanto importe-, en azul en cuanto hay filtros
  puestos, misma convencion que el total de la semana en el calendario.
- El boton de crear va con `ml-auto`: con los filtros puestos la barra se
  parte en dos y no puede quedarse suelto debajo del primer desplegable.
- De paso, un fallo pequeño: `hayFiltros` no contaba el filtro de categoria,
  asi que filtrando solo por ahi y sin resultados el hueco decia "Aun no hay
  proyectos" en vez de "Nada encaja con eso".

En la ficha (`resumen-proyecto.tsx`):

- **Cuanto queda por facturar**: las horas que llevan el euro y todavia no
  cuenta ningun cierre, con la estimacion al objetivo €/h. Sale como una
  cifra mas en la tarjeta del dinero y, cuando el proyecto no tiene ni un
  cierre apuntado -que es cuando mas falta hace, porque entonces no hay
  tarjeta de dinero-, como una fila propia arriba del todo.
- **Las etiquetas que mas aparecen**: cuarto reparto, con los porcentajes
  contra las horas etiquetadas y no contra el total -una hora puede llevar
  varias etiquetas y sumarian mas de 100-, y una linea al pie con lo que
  queda sin etiquetar. Solo sale si hay alguna hora etiquetada.
- "Como va mes a mes" y "quien ha tocado que" ya los cubrian la grafica de
  ritmo -que elige dia/semana/mes segun lo que dure el proyecto- y los
  repartos por tarea y por persona, de la reconstruccion del 19-ago.

Y una incoherencia que salio al probarlo: **el presupuesto de horas solo se
podia poner desde Catalogo**, aunque es lo que dibuja la barra del listado y
ahora tambien el filtro. Añadido a los Ajustes del propio proyecto
(`detalle-proyecto.tsx`), con la coma valiendo como decimal, igual que en
Catalogo.

De paso, el criterio de "que horas son de cada cierre" estaba escrito dos
veces -es justo donde vivia el bug de doble conteo del 21-ago-; ahora hay una
sola funcion, `esDeEsteCierre`, de la que tiran el resumen de resultados y lo
que queda por cerrar.

Verificado con `tsc`, `eslint` y `npm run build` limpios, y en vivo en el
espacio NITTON: los tres ordenes nuevos con las horas reales de cada proyecto,
los tres estados del filtro de presupuesto -con un presupuesto de 2 h puesto
a mano en LALCANTARA y quitado despues-, el chip de totales poniendose azul
al filtrar, el aviso de "01:15:00 sin cerrar - ≈ 12,50 €" en LALCANTARA, y el
reparto por etiqueta con dos etiquetas de prueba creadas y borradas al
terminar (el espacio no tenia ninguna). Comprobado por SQL al acabar que no
queda rastro: 0 etiquetas, 0 horas etiquetadas y ningun presupuesto.

### 3 bis. La portada y el alta (22-ago-2026)

Nicolas: lo que menos le gustaba a la vista era la portada y el alta. De la
portada, que estaba "demasiado centrada" -todo dentro de una columna de 1024
px con doscientos y pico pixeles de negro a cada lado- y que no tenia nada
visual: una sola pieza -el cronometro- en toda la pagina. Del alta, que no
preguntaba nada: queria un formulario de los de "cuantos sois", corto y con
diseno.

**Antes de tocarla se comprobo la duda que traia**: rehacer la portada no
complica la verificacion de Google. Lo que revisan de la pagina principal es
que el dominio sea el de la ficha OAuth, que el nombre y el logo coincidan
con los de la pantalla de consentimiento, que el enlace a la politica de
privacidad este visible y en el mismo dominio, que se entienda que hace la
aplicacion, y que no se usen marcas de Google como si fuera un producto suyo.
El aspecto no entra. Se conservaron los cuatro: nombre, logo, pie con
Privacidad y dominio; y se **anadio una seccion propia de Google Calendar**
-solo lectura, no crea ni borra, se desconecta cuando quieras- porque eso es
justo lo que revisan del scope y juega a favor.

**El alta** (`asistente-inicio.tsx`, reescrito):

- Dos columnas: a la izquierda la marca, los pasos con su estado y un resumen
  vivo de lo que se lleva decidido -zona, estructura, cuantos sois-; a la
  derecha el paso. En movil, la raya de puntos de siempre.
- **Paso nuevo, "Como sois"**, con dos preguntas que se usan de verdad:
  **cuantos sois** -contador grande con atajos, que deja preparados esos
  huecos de nombres en el paso siguiente- y **de donde venis** -Clockify,
  otra herramienta o de cero-, que decide donde acaba el asistente en vez de
  preguntarlo otra vez al final. Se descartaron las preguntas de objetivo
  semanal y de €/h: alargaban el alta y ya viven en Gestion > Ajustes.
- **Si vas solo, los pasos de nombres y de repartir el enlace no existen**: la
  lista de pasos se acorta en el momento de decir "solo yo".
- El paso del equipo pasa de chips a **filas numeradas** (2, 3, 4...), con
  pegar la lista repartiendola por los huecos.
- La estructura de LEINN deja de ser una casilla y son **dos tarjetas**.
- La marca: `/bienvenida` y el alta usaban el icono generico de cronometro;
  ahora llevan el wordmark de hitoo.

**La portada** (`page.tsx`, rehecha):

- De `max-w-5xl` a `max-w-6xl`, hero y cierre **a sangre** con un resplandor
  del color de marca detras, y el titular sin `<br>` a mano -a ese tamano
  partia en cuatro lineas en cuanto la columna se estrechaba-.
- **Secciones en dos columnas que alternan lado** (`Cara`), cada una con un
  trozo de la aplicacion al lado del texto, en vez de una columna de bloques
  centrados uno debajo de otro.
- **Maquetas nuevas**: la semana del hero -rejilla de lunes a viernes con los
  ratos apareciendo escalonados, el de "ahora" latiendo y la barra del
  objetivo creciendo-, la del dinero -la aguja del €/h dibujandose, con
  ingresos y gastos- y la de Google Calendar -la invitacion a rayas-. Todas
  dibujadas con los mismos tokens que la app: no se desactualizan, no pesan
  y no ensenan datos de nadie.
- **Aparecer al llegar** (`al-entrar.tsx`): dos cuidados a proposito -sin
  JavaScript no esconde nada, porque la clase que oculta la pone el propio
  efecto al montar; y lo que ya se ve al cargar no se anima, que eso es un
  parpadeo y no una entrada-. Con `prefers-reduced-motion` no hay nada de
  esto: la hoja de estilos ya apagaba las animaciones.
- Seccion nueva de **El dinero** en el menu y en la pagina: era lo que
  diferencia a hitoo de otro cronometro y no salia por ningun lado.
- Corregido de paso el vocabulario: quedaban "Categoria / Subcategoria" en el
  Excel y en los textos, cuando desde el 19-ago se llaman **Area y
  Categoria**.

Verificado con `tsc`, `eslint` y `npm run build` limpios; el alta entera
recorrida en el navegador -espacio de prueba creado, los cuatro pasos, el
QR, el final en el importador- y **borrado despues** (comprobado por SQL que
no quedan plazas huerfanas); y la portada mirada entera, ademas de comprobar
sin sesion -con curl, sin cookies- que salen los botones de crear cuenta y
el enlace a la politica de privacidad.

**La cara publica, siempre en claro (22-ago-2026)**: Nicolas lo pidio despues
de verlo -"que tanto la landing como el formulario de onboarding sean en
blanco"-. Hecho con una clase, `.tema-claro`, en vez de tocar el tema de
nadie: el bloque de tokens claros pasa a valer para `:root` **y** para esa
clase, y como las variables se heredan, las de la clase pisan a las de `:root`
-esten en el `@media` oscuro o en `[data-theme="dark"]`- para todo lo que
cuelgue de ese elemento. No toca `localStorage`, no toca el `<html>` y no
parpadea. La llevan la portada, `/empezar` y `/privacidad` -esta ultima porque
se llega desde el pie de la portada y saltar de blanco a negro al pulsar no
tenia sentido-, cada una con su `viewport.themeColor` claro para la barra del
navegador en el movil.

Detalle que costo un intento: el fondo claro **no puede pintarse en la caja
del elemento**. La politica de privacidad es una columna de `max-w-2xl`
centrada, asi que salia como una tira blanca con el negro del body a los
lados. Se pinta con un `::before` fijo a pantalla completa por detras del
contenido.

Y en la **guia inicial** hay ahora un sexto paso, "Y con la cara que
prefieras", con el selector de tema dentro: se elige ahi mismo y se ve al
momento, en vez de descubrirlo por casualidad en el perfil. El
`SelectorTema` gana una prop `conTexto` para salir con las palabras -Claro,
Oscuro, Sistema- en vez de solo con los iconos; sus dos usos de siempre -el
menu lateral y el perfil- no cambian.

Y con el mismo criterio, todo lo que se ve **antes de entrar al panel**:
`/acceso`, `/auth/nueva-contrasena`, `/unirse/<codigo>` -el primer contacto de
quien escanea el QR- y `/bienvenida`. La regla es esa: hasta el panel, claro;
del panel para dentro, manda el tema de cada uno.

Comprobado en vivo con el tema puesto en **oscuro**: la portada, el alta, la
politica y `/bienvenida` salen en claro igualmente, el panel sigue oscuro, y
sin sesion (curl, sin cookies) las cuatro publicas llevan la clase.

**Entrar sin pasar por la portada, y Google en la barra (22-ago-2026)**, las
dos pedidas por Nicolas mirando como lo hace Clockify:

- **Entrar con Google desde la barra de la portada**. Se reutiliza
  `boton-google.tsx` -la G oficial en colores y el texto que piden las guias
  de marca de Google, que conviene respetar justo ahora que se va a pedir la
  verificacion-, con una variante `compacto` que no ocupa el ancho y que, si
  da error, lo cuelga por debajo en vez de empujar la barra. Con sesion no
  sale -ahi la barra solo tiene que devolverte adentro- y en el movil tampoco,
  que no cabe.
- **"Llevame directo la proxima vez"**, casilla debajo del boton del hero, que
  solo ve quien tiene la sesion abierta. Se descarto redirigir siempre: la
  portada tiene que poder ensenarse a otro equipo sin cerrar sesion. Va en una
  **cookie** y no en `localStorage` para que la decision la tome el servidor y
  el salto ocurra antes de pintar, sin el fogonazo de ver la portada un
  instante. La portada sigue accesible con `/?portada`, que ademas es donde se
  desmarca.

  **Gotcha que costo un rato**: el nombre de la cookie estaba exportado desde
  el propio componente, que es `"use client"`. Una constante exportada desde un
  modulo cliente **no llega al servidor como su valor**, sino como una
  referencia de cliente, asi que `cookies().get(...)` no encontraba nada aunque
  la cookie si viajara en la peticion -se vio con un log: la cookie estaba en
  `getAll()` pero `get(CONSTANTE)` daba `undefined`-. Los nombres de cookies
  compartidas viven ahora en `src/lib/cookies.ts`, que no es de nadie.

  Probado en vivo: marcada, `/` lleva al panel; `/?portada` la ensena con la
  casilla marcada; desmarcada, todo vuelve a como estaba.

Pendiente: **mirarlo desde el movil**. El navegador de esta sesion no cambia
el ancho de verdad, asi que el responsive esta razonado por codigo pero no
visto con los ojos, igual que en el repaso del 20-ago.

### 4. Equipo

La pantalla se queda corta: solo lista y cambia roles. Falta ver cuanto
trabaja cada uno, quien no ha rellenado la semana, y poder entrar en la ficha
de una persona igual que se entra en la de un proyecto.

### 5. Control de las horas

- Bloquear semanas ya facturadas para que no se toquen.
- ~~Aprobar o devolver las horas de otra persona~~ descartado el 20-ago-2026:
  dentro de un equipo LEINN nadie aprueba las horas de otro. Solo volveria si
  esto se usa para empresas de fuera de LEINN, sin decidir todavia.
- Avisar de dias sin rellenar antes de cerrar la semana.

### 6. Flujos de alta y baja de horas

- Borrado y edicion en bloque desde los informes.
- Mover un rango de horas de un proyecto a otro.
- Duplicar una semana entera.
- Deshacer lo ultimo.

### 7. Identidad

Hecho el 18-ago-2026 el nombre: ~~ClockLEINN~~, en la portada, en el acceso, en
la pestana y en el manifiesto.

Renombrado el 20-ago-2026 a **hitoo**: es el nombre real, el dominio ya era
`hitoo.vercel.app` desde antes. Cambiado en la portada, el acceso, la pestana,
el manifiesto, `package.json`, README y guia de despliegue. Logo y favicon
propios puestos -wordmark en el header y acceso, marca "h" en favicon e
iconos PWA (192, 512, 512 recortable)-, a partir del SVG que paso Nicolas
(`hitoo_logo_white_v4_wordmark_only.svg`).

**og:image hecho el 21-ago-2026**: `src/app/opengraph-image.tsx`, generado
con `next/og` -mismo dibujo que el wordmark, blanco en negrita sobre
`#0e0e0e`-, prerenderizado en build. Next lo conecta solo a `og:image` y a
`twitter:image`/`twitter:card` de la portada.

**Repositorio de GitHub ya renombrado** -comprobado el 21-ago-2026 con `git
remote -v`: el remoto ya es `github.com/NittonNi/hitoo`, no hacia falta
tocar nada-. La carpeta local sigue llamandose `nitton-horas`, que no pinta
nada de puertas afuera.

Queda:

- Revisar `theme_color`/`background_color` del manifiesto: siguen siendo el
  azul de antes (`#0071e3` / `#f5f5f7`), no se han tocado a proposito -es un
  cambio de paleta, no de marca-.

### 8. Despliegue

Vercel, dominio y repetir la configuracion de URLs de Google con el dominio
real.

## Ideas apuntadas

- **Horas compartidas, segunda vuelta**: avisar a quien ya acepto cuando el que
  las propuso cambia la hora o las borra; poder proponer desde el cronometro y
  desde la hoja semanal, no solo desde el calendario.
- **Calendario**: vista de dia para movil, arrastrar entre semanas, y duplicar
  un bloque con alt.
- **Recordatorios**: aviso si se acaba la semana con horas sin meter.
- **Etiquetas**: se usan como formas fijas de clasificar el tiempo, al margen
  del proyecto. Falta poder filtrar por etiqueta desde cualquier pantalla y no
  solo desde informes, y una ficha por etiqueta parecida a la de proyecto.
- **Regenerar `database.types.ts`** entero en la proxima migracion: los tipos de
  `entry_invitations` y `resumen_proyectos` se anadieron a mano.

## Hecho

- Espacios de trabajo independientes, con roles por espacio y RLS probada.
- Importacion de Clockify desde CSV, sin duplicar al reimportar.
- Cronometro, hoja semanal, informes con importes, tarifas por ambito.
- Acceso por correo y con Google (pendiente solo de dar de alta credenciales).
- **Calendario**: rejilla semanal, arrastrar para crear, mover y estirar.
- **Horas compartidas**: se proponen a otras personas y ellas aceptan o rechazan.
- **Descarga en Excel** con columnas tipadas y hoja de resumen.
- **Aspecto**: menu lateral en escritorio, barra inferior en movil, gris
  agrupado, tarjetas blancas y un solo azul para lo pulsable.
- **Proyectos**: apartado propio con ficha por proyecto -horas, reparto por
  tarea y por persona, presupuesto, color y tareas- y creacion de proyectos y
  de tareas desde el propio selector.
- **Facturable**: el mismo verde en todas partes, con recuadro sobre la linea
  de color del proyecto.
- **Editar en el sitio**: en el cronometro se cambia la descripcion, el
  proyecto, la tarea, las etiquetas, el dia, las horas y si se cobra pulsando
  encima del dato, sin abrir ningun dialogo.
- **Preferencias de edicion**: el espacio puede fijar que todo se guarde en
  MAYUSCULAS. Va en la base, con disparador, asi que vale tambien para lo que
  entra por el importador.
- **Portada publica** en `/`, con el cronometro de ejemplo corriendo de verdad.
  La aplicacion se mudo a `/panel` y la ruta vive en `src/lib/rutas.ts`.

## Dudas abiertas

### Etiquetas

Se usan como formas fijas de clasificar el tiempo, al margen del proyecto, y
para poder buscar por ellas. Falta decidir:

- si se filtra por etiqueta desde cualquier pantalla, y no solo desde informes;
- si tienen ficha propia, como los proyectos, con sus horas;
- si conviene que una entrada pueda llevar varias, o solo una.

### Antes de venderla (1-sep-2026)

Cuatro cosas que Nicolas quiere revisar antes de salir a vender, apuntadas
mientras se montaba la pasarela de pago. No estan decididas, estan abiertas.

- **Que le damos a un leinner que no le de un cronometro cualquiera.** Hoy la
  respuesta esta repartida por la app -el €/h contra el objetivo, las
  ediciones, las areas, el informe en Excel con columnas de verdad- pero no
  esta dicha en ninguna parte, ni en la portada ni al entrar. Si no se sabe
  decir en una frase, no se sabe vender.
- **Los datos tienen que llegar masticados.** No basta con que la app los
  guarde: al abrirla tiene que verse ya lo que hay que mirar, sin construirse
  el usuario ningun informe. Hoy el Panel y Estadisticas ya apuntan ahi, pero
  hay que decidir cual es la pantalla que contesta sola.
- **Registrarse tiene que ser de verdad facil.** Menos pasos, menos campos, y
  que nada de lo que se pueda deducir se pregunte. Medir donde se cae la gente
  en `/empezar`.
- **La importacion de datos, con cuidado.** Traerse el historico de otra
  herramienta es la clase de tarea que parece una chorrada y se come semanas,
  y si se hace mal ensucia la base para siempre. Duda abierta: si se cobra
  aparte como servicio -no esta claro que lo quieran ni que lo paguen- o si
  entra en la cuota.

## Salir a vender: lo que falta para el push (repasado el 7-sep-2026)

Google dio la verificacion el 2-sep, asi que **ya no bloquea nada**. Lo que
queda para cobrar de verdad son tres cosas, y las tres estan fuera del codigo:
son paneles de Stripe y de Vercel.

### Bloquea el push

1. ~~Rellenar `src/lib/empresa.ts`~~ **hecho el 1-sep**: Asociacion
   estudiantil junior empresa Nitton, CIF G56659964, Paseo Uribitarte 6, 1.º,
   48001 Bilbao.
2. ~~Verificacion de Google~~ **aprobada el 2-sep** (hitoo-506113).
3. **Modo real en Stripe**, que es una cuenta distinta del sandbox y no se ve
   desde estas sesiones. Hay que recrear alli, a mano:
   - **Producto** «hitoo — Equipo», descripcion "Control de horas para un
     equipo de hasta 20 personas. Cuota mensual por espacio de trabajo.",
     metadata `app=hitoo` (en el sandbox es `prod_VBDYmK4zl1h6aK`).
   - **Precio** recurrente, 19,00 EUR, mensual, `tax_behavior: exclusive`
     -es decir, SIN IVA incluido- (sandbox: `price_1UAr7n3wYiZE7FbO3FoYNsd8`).
   - **Tipo de IVA** del 21%, en Productos > Tipos de impuesto (sandbox:
     `txr_1UAs0M3wYiZE7FbOFGZvSODM`).
   - **Endpoint de webhook** `https://www.hitoo.es/api/stripe/webhook`,
     escuchando `checkout.session.completed` y `customer.subscription.*`, y
     quedarse con su secreto de firma -que **no** es el del `stripe listen`-.
   - **La URL de las condiciones** en Configuracion > Publico. Sin ella el
     Checkout falla entero, porque desde el 7-sep pide aceptarlas
     (`consent_collection`). Aprovechar y poner tambien nombre publico y
     politica de reembolso.
4. **Variables en Vercel** (Production y Preview), y redesplegar:
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_TAX_RATE_ID`,
   `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` y
   `NEXT_PUBLIC_SITE_URL`. Todas estan documentadas en `.env.example` desde
   el 7-sep, con el aviso de que sandbox y real son cuentas distintas.

### Conviene antes de cobrar de verdad

- **Revocar la clave secreta de Supabase** que se pego en el chat el 1-sep y
  poner otra.
- **Probar con el raton** la pagina de pago de Stripe (recogida de direccion
  y NIF, la casilla de las condiciones, vuelta a la app) y el portal de
  cliente. Lo unico que sigue sin probarse a mano.

### Repaso del 7-sep-2026: siete cosas arregladas

Todo esto salio mirando la pasarela pantalla por pantalla. Ordenado por lo
que dolia:

1. **El webhook perdia cobros en silencio.** `guardar()` se tragaba los
   fallos en un `console.error` y `POST` contestaba `200` igual. Para Stripe
   eso significa "entregado, olvidate": no reintenta. Alguien pagaba, la fila
   no se escribia y no habia segunda oportunidad. Ahora cualquier fallo
   -error de la base, o un UPDATE que no encuentra fila, que en Postgres **no
   es un error**- lanza y devuelve **500**, que es lo que hace que Stripe
   reintente durante dias. De paso el `checkout.session.completed` acepta la
   suscripcion venga como identificador o ya expandida.
2. **La politica de privacidad no cumplia el RGPD.** Le faltaban la base
   juridica de cada tratamiento (art. 13.1.c), los derechos del interesado
   (arts. 15-22) y la mencion a la **AEPD** (art. 13.2.d), que es obligatoria.
   Escritos los tres apartados. Ademas decia que se borra todo al pedir la
   baja, cuando **las facturas hay que conservarlas por ley**: ahora la
   excepcion esta dicha. Y se añadieron las **transferencias
   internacionales**, que faltaban: Supabase Inc. y Vercel Inc. son
   estadounidenses aunque los servidores esten en Irlanda.
   *Ojo*: es la pagina que Google reviso. No se toco nada de Calendar -los
   bloques de Google, Limited Use y el cifrado siguen igual-, solo se
   añadieron apartados.
3. **El Checkout no pedia aceptar las condiciones.** Añadido
   `consent_collection: { terms_of_service: "required" }` y `locale: "es"`.
   Si falta la URL en el panel de Stripe, el error ya no llega en ingles:
   dice donde se arregla.
4. **`.env.example` estaba desactualizado y ademas mentia**: no tenia ninguna
   de las variables de Stripe y decia "No hace falta una service_role key",
   que dejo de ser cierto en cuanto existio el webhook.
5. **Al caducar, el mensaje engañaba.** Intentar apuntar una hora rebotaba en
   la politica `time_entries_insert` y `mensajeError` lo traducia como "No
   tienes permisos para hacer eso" -que hace pensar que te han cambiado el
   rol-. Ahora dice que se acabo la prueba y que las horas siguen ahi.
6. **El precio estaba escrito a mano** en la portada y en la pantalla de
   Cuota, y el "22.99 €" de las condiciones salia con **punto** por ser un
   numero de JavaScript. Los tres sitios salen ya de `PRECIO`, y hay
   `PRECIO.conIvaTexto` para escribirlo en castellano.
7. **El correo estaba escrito a mano dos veces** en la politica; ahora sale
   de `EMPRESA.correo`.

**Comprobado y correcto, no hizo falta tocarlo:** el candado de pago es real
y esta donde tiene que estar -la politica `time_entries_insert` lleva
`puede_escribir(workspace_id)`, asi que un espacio caducado no puede apuntar
horas nuevas pero si corregir y exportar, que es justo lo que promete la
pagina de condiciones-. La funcion de la base y `leerEstado` dicen lo mismo.
Los 9 espacios tienen su fila; los 7 anteriores a la migracion quedaron en
`cortesia` hasta 2036, que es lo correcto para no cobrar de golpe a quien ya
estaba.

### Decisiones tomadas el 7-sep-2026 (no volver a abrirlas)

- **El tope de 20 personas: se avisa, no se bloquea.** A partir de la persona
  21 sale un aviso en Gestion > Equipo diciendo cuantos sois y que se hable
  con nosotros; no se corta nada. El motivo: con un solo precio y sin plan de
  mas arriba, cerrarle la puerta al equipo 21 es rechazar al cliente mas
  grande que tienes. El recuento es quien esta dentro y activo **mas** los
  huecos que nadie ha cogido -un hueco ya cogido no cuenta dos veces-.
- **El correo sigue siendo `hitooclock@gmail.com` por ahora.** Es el que sale
  en el aviso legal, en la politica y como via para ejercer los derechos
  RGPD. Se sabe que un Gmail canta en un aviso legal con CIF y domicilio
  reales; se cambia cuando exista el buzon en el dominio, y como vive en
  `EMPRESA.correo` es cambiar una linea.

### Lo que ya esta hecho y probado

Tabla de suscripciones con RLS de solo lectura, prueba de 14 dias al crear el
espacio, codigo `LEINNHITOO` de 30 dias, webhook firmado, Checkout con IVA
aparte (19 + 3,99 = 22,99 €), portal de cliente, pantalla Gestion > Cuota,
aviso en el armazon, seccion de precio en la portada, aviso legal,
condiciones de contratacion y la politica de privacidad al dia. El ciclo
entero -alta, cobro, webhook, baja, solo lectura y vuelta a abrir- verificado
el 1-sep.

## Horas compartidas (19-ago-2026)

Hecho: las propuestas se pintan en el calendario como invitacion -sin rellenar,
borde a rayas del color del proyecto, sin sumar al dia, con Aceptar / No fui al
pulsarlas-, y con quien cuenta una hora se cambia despues desde la propia fila
(añadir manda propuesta; quitar solo retira las que siguen sin contestar).

Cuando llegue **Google Calendar**, un evento externo pendiente se pinta con ese
mismo formato y solo cambia el icono de la esquina: reloj = horas propuestas
por alguien del equipo, calendario = evento de fuera.

Queda:

- **Compartir desde la hoja de la semana**, que ahi todavia no se puede.
- **Aceptar o rechazar en bloque** cuando lleguen varias propuestas del mismo
  dia; ahora se contestan de una en una.

## Onboarding (hecho 19-ago-2026)

`/empezar` monta el espacio de una sentada, en cuatro pasos: el espacio -nombre,
zona y plantilla de LEINN-, el equipo -los nombres, que se pueden pegar de una
lista-, repartirlo -enlace y codigo QR- y por donde empezar -importar de
Clockify o al cronometro-. `/bienvenida` se queda solo para elegir entre los
espacios que ya tienes y llevar aqui.

El QR se dibuja en el navegador con `qrcode`, cargado solo al usarlo, a partir
del enlace de siempre: no se guarda nada nuevo. El codigo de union se genera al
llegar al paso 3, no antes: quien no pasa por ahi no deja una puerta abierta.

Queda por si se quiere:

- **Reclamar la plaza en el mismo QR**: hoy quien escanea entra y elige su
  nombre en `/unirse/[codigo]`, que ya funciona; se podria llevar directo a su
  plaza si el enlace la nombrara.
- **Un paso de proyectos** al final, para no llegar al cronometro sin nada
  contra lo que apuntar. Se decidio no meterlo: el aviso de "aun no hay
  proyectos" del panel ya lo resuelve sin alargar el alta.
