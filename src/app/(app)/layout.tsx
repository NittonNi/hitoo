import { Suspense } from "react"
import { cookies } from "next/headers"

import { COOKIE_MENU_PLEGADO } from "@/lib/cookies"
import { getSesion } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/server"
import {
  aEntradaEnMarcha,
  enMarchaEnOtrosEspacios,
  SELECT_EN_MARCHA,
} from "@/lib/cronometro"
import { ProveedorSesion } from "@/components/proveedor-sesion"
import { ProveedorCronometro } from "@/components/proveedor-cronometro"
import { Armazon } from "@/components/armazon"
import { ProveedorAvisos } from "@/components/avisos"
import { GuiaInicial } from "@/components/guia-inicial"
import { EsqueletoMarco } from "@/components/esqueleto-marco"
import { veTodo } from "@/lib/roles"
import { getSuscripcion } from "@/lib/suscripcion"
import { AvisoCuota } from "@/components/aviso-cuota"
import { AvisoOlvido } from "@/components/aviso-olvido"

/**
 * getSesion() usa cookies() (dato "runtime") y aquí además se consulta la
 * entrada en marcha: sin Cache Components activado (no lo está, ver
 * next.config.ts) un layout async sin su propio <Suspense> bloquea la
 * navegación entera y el loading.tsx de la página no llega a mostrar nada
 * -ver node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * loading.md líneas 88-93 ("Good to know") y layout.md líneas 316-345
 * (patrón "Interaction with loading.js") de esta instalación.
 *
 * Por eso todo lo que depende de getSesion()/la entrada en marcha se separa
 * en MarcoSesion, con su propio limite de Suspense aquí: ProveedorAvisos no
 * depende de ningún dato y se queda fuera para que ni siquiera él espere.
 */
export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode
}) {
  /* La cookie del menú plegado se lee aquí, por fuera del Suspense: es un dato
     de la propia petición y no espera a nada. Así hasta el esqueleto sale con
     la barra como se dejó, en vez de ancha un instante al recargar. */
  const menuPlegado = (await cookies()).get(COOKIE_MENU_PLEGADO)?.value === "1"

  return (
    <ProveedorAvisos>
      <Suspense fallback={<EsqueletoMarco plegado={menuPlegado} />}>
        <MarcoSesion menuPlegado={menuPlegado}>{children}</MarcoSesion>
      </Suspense>
    </ProveedorAvisos>
  )
}

async function MarcoSesion({
  menuPlegado,
  children,
}: {
  menuPlegado: boolean
  children: React.ReactNode
}) {
  const sesion = await getSesion()
  const supabase = await createClient()

  /* Uno en marcha por espacio. Se piden todos los tuyos de una vez: el de este
     espacio es el cronómetro, y los de los otros solo sirven para avisar si
     alguno lleva demasiado (AvisoOlvido). La cuota sale a la vez, no detrás. */
  const [{ data: enMarcha }, suscripcion] = await Promise.all([
    supabase
      .from("time_entries")
      .select(SELECT_EN_MARCHA)
      .eq("user_id", sesion.perfil.id)
      .is("end_at", null),
    getSuscripcion(sesion.espacio.id),
  ])
  const aqui = enMarcha?.find((e) => e.workspace_id === sesion.espacio.id)

  return (
    <ProveedorSesion sesion={sesion}>
      {/* Por fuera de esto sigue estando ProveedorAvisos (en LayoutApp): así
          el propio cronómetro puede avisar cuando algo le sale mal, en vez
          de sacar un alert.

          El key es el espacio. El layout no se desmonta al cambiar de espacio
          y React conserva el estado de lo que cuelga de él, así que sin key el
          cronómetro seguía contando el del espacio anterior, y la barra
          guardaba el proyecto a medio elegir de allí. Con él, lo de un espacio
          nace de nuevo en el otro. */}
      <ProveedorCronometro
        key={sesion.espacio.id}
        espacioId={sesion.espacio.id}
        inicial={aEntradaEnMarcha(aqui)}
      >
        <Armazon plegadoInicial={menuPlegado}>
          <AvisoOlvido
            fuera={enMarchaEnOtrosEspacios(enMarcha, sesion.espacios, sesion.espacio.id)}
          />
          <AvisoCuota suscripcion={suscripcion} rol={sesion.rol} />
          {children}
        </Armazon>
        <GuiaInicial perfilId={sesion.perfil.id} esGestor={veTodo(sesion.rol)} />
      </ProveedorCronometro>
    </ProveedorSesion>
  )
}
