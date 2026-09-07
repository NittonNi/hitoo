import { Suspense } from "react"

import { getSesion } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/server"
import { aEntradaEnMarcha, SELECT_EN_MARCHA } from "@/lib/cronometro"
import { ProveedorSesion } from "@/components/proveedor-sesion"
import { ProveedorCronometro } from "@/components/proveedor-cronometro"
import { Armazon } from "@/components/armazon"
import { ProveedorAvisos } from "@/components/avisos"
import { GuiaInicial } from "@/components/guia-inicial"
import { EsqueletoMarco } from "@/components/esqueleto-marco"
import { veTodo } from "@/lib/roles"
import { getSuscripcion } from "@/lib/suscripcion"
import { AvisoCuota } from "@/components/aviso-cuota"

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
export default function LayoutApp({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProveedorAvisos>
      <Suspense fallback={<EsqueletoMarco />}>
        <MarcoSesion>{children}</MarcoSesion>
      </Suspense>
    </ProveedorAvisos>
  )
}

async function MarcoSesion({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  const supabase = await createClient()

  // El cronómetro es único por persona, pero solo se muestra si corre aquí
  const { data } = await supabase
    .from("time_entries")
    .select(SELECT_EN_MARCHA)
    .eq("user_id", sesion.perfil.id)
    .eq("workspace_id", sesion.espacio.id)
    .is("end_at", null)
    .maybeSingle()

  return (
    <ProveedorSesion sesion={sesion}>
      {/* Por fuera de esto sigue estando ProveedorAvisos (en LayoutApp): así
          el propio cronómetro puede avisar cuando algo le sale mal, en vez
          de sacar un alert */}
      <ProveedorCronometro espacioId={sesion.espacio.id} inicial={aEntradaEnMarcha(data)}>
        <Armazon>
          <AvisoCuota suscripcion={await getSuscripcion(sesion.espacio.id)} rol={sesion.rol} />
          {children}
        </Armazon>
        <GuiaInicial perfilId={sesion.perfil.id} esGestor={veTodo(sesion.rol)} />
      </ProveedorCronometro>
    </ProveedorSesion>
  )
}
