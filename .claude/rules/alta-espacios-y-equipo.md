---
paths:
  - "src/components/asistente-inicio.tsx"
  - "src/components/bienvenida.tsx"
  - "src/components/unirse.tsx"
  - "src/components/codigo-qr.tsx"
  - "src/components/gestion-plazas.tsx"
  - "src/components/gestion-equipo.tsx"
  - "src/components/gestion-categorias.tsx"
  - "src/components/gestion-proyectos.tsx"
  - "src/components/gestion-etiquetas.tsx"
  - "src/components/ajustes-espacio.tsx"
  - "src/components/importador-clockify.tsx"
  - "src/components/guia-inicial.tsx"
  - "src/components/pista-pagina.tsx"
  - "src/lib/clockify.ts"
  - "src/lib/categorias.ts"
  - "src/lib/roles.ts"
  - "src/app/empezar/**"
  - "src/app/bienvenida/**"
  - "src/app/unirse/**"
  - "src/app/**/gestion/**"
---

# Alta, espacios, equipo y catálogo

- **Alta en `/empezar`** (`asistente-inicio.tsx`): el espacio; cómo sois (cuántos y de dónde venís: Clockify, otra herramienta o de cero); el equipo en filas numeradas, donde se puede pegar una lista; repartirlo con enlace y QR; y por dónde empezar. Si vas solo, desaparecen los pasos de nombres y de enlace. `/bienvenida` solo sirve para elegir espacio.
- **Plazas estilo Tricount**: `workspace_seats` + `join_code`. Quien entra por `/unirse/<codigo>` elige su plaza. El código se genera en el paso 3, con `nuevoCodigo` (`crypto.getRandomValues`, 10 caracteres).
- **`espacio_por_codigo` y sus hermanas comprueban `auth.uid()`**: sin sesión no devuelven nada. Cualquier RPC nueva de ese estilo, igual.
- **Renombrar a alguien**: `renombrar_miembro(workspace, user, nombre)`, `SECURITY DEFINER`, que comprueba que quien llama administra ese espacio.
- **Gestión > Ajustes** reúne todo lo del espacio: qué es, a qué aspira, qué hay que rellenar (`require_description`) y cómo se escribe. El estilo de texto (mayúsculas) va con disparador en la base, así que alcanza también a lo importado y a los nombres del equipo.
- **Nunca un `<form>` dentro de otro**: rompía la hidratación de `/gestion/ajustes`.
- **Categorización**: dos niveles, **Área** y **Categoría**. El árbol no repite el camino en cada fila. Mover es un `update` de `parent_id` y `position`, y los proyectos se van con su categoría.
- **Plazas con horas** (14-sep-2026): una plaza puede traer horas de alguien que aún no tiene cuenta. Esas horas cuelgan de un perfil `sin_cuenta` (usuario de Auth sin contraseña y con correo `@hitoo.invalid`, que no puede entrar), miembro del espacio para que salga en informes y filtros. `workspace_seats.provisional_id` apunta a él y `email` guarda el correo de la importación, que sirve para sugerirle su plaza al unirse. Se crean con `crear_plaza_con_horas(espacio, nombre, email)`, que no duplica: si la plaza ya existe devuelve su persona, y si alguien la cogió, a quien la cogió. Al coger la plaza, `unirse_con_codigo` llama a `traspasar_plaza`, que pasa horas, tarifas, repartos y propuestas a la cuenta real y borra la provisional. `provisional_id` y `sin_cuenta` no se pueden cambiar desde el cliente (disparadores): si se pudiera, un admin apuntaría la plaza a otro miembro y se quedaría con sus horas. En la interfaz, las personas `sin_cuenta` no salen en Miembros (ya salen como plaza), no se les proponen horas y su plaza no tiene papelera.
- **Dos claves de `workspace_seats` a `profiles`** (`claimed_by` y `provisional_id`): un `profiles(...)` a secas da error de relación ambigua y PostgREST devuelve la lista vacía. Se nombra la clave: `profiles!workspace_seats_claimed_by_fkey(full_name)`.
- **Rol coach** (14-sep-2026): ve como un responsable (horas de todos, importes, cierres, repartos) y no toca nada. En la base, `ve_todo()` (admin, responsable y coach) para leer y `puede_tocar()` (todos menos el coach) en las escrituras de horas, etiquetas de horas, propuestas y `start_timer`; el catálogo sigue con `can_see_all`, que no incluye al coach. A un coach no se le pueden proponer horas ni imputárselas. En la interfaz, `veTodo` / `puedeGestionar` / `soloMira` de `roles.ts`: sin Gestión, sin el grupo Apuntar del menú, y `/panel` le lleva a Estadísticas.
- **Importar de Clockify**: CSV del informe detallado, uno o varios a la vez -la versión gratuita solo exporta un año cada vez-, cada uno con su propio formato de fecha. Reimportar no duplica (`source = 'clockify'` + `external_id` = `persona|inicio|fin`, en la zona del espacio); si la misma persona tiene dos filas con el mismo inicio y el mismo fin, la segunda lleva el número de aparición detrás (`|2`, `|3`...). La columna «Client» entra como área, porque no hay clientes. Quien no tiene cuenta entra por defecto como plaza con sus horas.
- **Tutorial**: `guia-inicial.tsx` sale la primera vez y se repite desde el perfil (el último paso elige el tema); `pista-pagina.tsx` es una línea azul por pantalla. Nada de modales por pantalla.
- **Más de 20 personas** en Equipo: aviso, nunca bloqueo. Cuenta la gente activa más las plazas sin coger.
