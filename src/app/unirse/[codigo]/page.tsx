import { redirect } from "next/navigation"

import { getPerfil } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/server"
import { Unirse } from "@/components/unirse"

export const metadata = { title: "Unirse a un equipo" }

/** Se ve antes de entrar al panel, así que va en claro como la portada. */
export const viewport = { themeColor: "#f5f5f7" }

/**
 * Lo que devuelve `espacio_por_codigo`: el equipo y los nombres libres. La que
 * trae tu correo de la importación llega primera y marcada como sugerida.
 */
type Plaza = { id: string; nombre: string; sugerida: boolean; con_horas: boolean }

export default async function PaginaUnirse({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  // Con sesion siempre: el proxy manda a /acceso y vuelve aqui
  await getPerfil()

  const supabase = await createClient()
  const { data } = await supabase.rpc("espacio_por_codigo", { p_codigo: codigo })
  const espacio = data?.[0]

  if (!espacio) {
    return (
      <main className="tema-claro mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Este enlace ya no vale
        </h1>
        <p className="mt-2 text-sm text-muted">
          Puede que el equipo lo haya cambiado. Pide uno nuevo a quien lleve el
          espacio.
        </p>
      </main>
    )
  }

  // Si ya estas dentro, no hay nada que preguntar
  const { data: dentro } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", espacio.id)
    .maybeSingle()
  if (dentro) redirect("/panel")

  return (
    <Unirse
      codigo={codigo}
      espacio={espacio.name}
      plazas={(espacio.plazas ?? []) as Plaza[]}
    />
  )
}
