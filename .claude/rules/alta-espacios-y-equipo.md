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
- **Importar de Clockify**: CSV del informe detallado. Reimportar no duplica (`source = 'clockify'` + `external_id`). La columna «Client» entra como área, porque no hay clientes.
- **Tutorial**: `guia-inicial.tsx` sale la primera vez y se repite desde el perfil (el último paso elige el tema); `pista-pagina.tsx` es una línea azul por pantalla. Nada de modales por pantalla.
- **Más de 20 personas** en Equipo: aviso, nunca bloqueo. Cuenta la gente activa más las plazas sin coger.
