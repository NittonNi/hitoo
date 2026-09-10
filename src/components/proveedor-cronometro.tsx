"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { aEntradaEnMarcha, SELECT_EN_MARCHA } from "@/lib/cronometro"
import { useAvisos } from "@/components/avisos"
import { useSesion } from "@/components/proveedor-sesion"
import type { BorradorEntrada, Entrada, EntradaEnMarcha } from "@/lib/tipos"

type Contexto = {
  enMarcha: EntradaEnMarcha | null
  /** Segundos transcurridos, refrescado cada segundo. */
  segundos: number
  cargando: boolean
  arrancar: (borrador: BorradorEntrada) => Promise<void>
  /** Devuelve la entrada ya cerrada: hace falta para proponerla a otros. */
  parar: () => Promise<Entrada | null>
  descartar: () => Promise<void>
  /** Vuelve a leer el cronómetro del servidor (otra pestaña, el movil...). */
  recargar: () => Promise<void>
}

const ContextoCronometro = createContext<Contexto | null>(null)

export function ProveedorCronometro({
  espacioId,
  inicial,
  children,
}: {
  /**
   * Uno en marcha por espacio, y este proveedor solo sabe del suyo. El layout
   * le pone el espacio de `key`: al cambiar de espacio nace de nuevo en vez de
   * seguir contando el del anterior, y lo que llegue tarde del viejo (un
   * recargar, un parar a medias) cae en un componente ya desmontado.
   */
  espacioId: string
  inicial: EntradaEnMarcha | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { perfil } = useSesion()
  const [enMarcha, setEnMarcha] = useState<EntradaEnMarcha | null>(inicial)
  const [ahora, setAhora] = useState(() => Date.now())
  const [cargando, setCargando] = useState(false)
  const supabaseRef = useRef(createClient())

  // Reloj: los segundos se calculan desde start_at en cada render en vez de
  // acumularse, así no se desincronizan si el navegador congela el intervalo
  // (movil en segundo plano). Lo único que se guarda es "qué hora es".
  const segundos = enMarcha
    ? Math.max(
        0,
        Math.floor((ahora - new Date(enMarcha.start_at).getTime()) / 1000),
      )
    : 0

  useEffect(() => {
    if (!enMarcha) return
    // El primer tick va aparte para que la cuenta arranque ya, sin esperar un segundo
    const primero = setTimeout(() => setAhora(Date.now()), 0)
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => {
      clearTimeout(primero)
      clearInterval(id)
    }
  }, [enMarcha])

  /** El que corre en este espacio según el servidor; undefined si no hay sesión. */
  const leer = useCallback(async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return undefined

    const { data } = await supabase
      .from("time_entries")
      .select(SELECT_EN_MARCHA)
      .eq("user_id", user.id)
      .eq("workspace_id", espacioId)
      .is("end_at", null)
      .maybeSingle()

    return aEntradaEnMarcha(data)
  }, [espacioId])

  const recargar = useCallback(async () => {
    const leida = await leer()
    if (leida !== undefined) setEnMarcha(leida)
  }, [leer])

  // Si arrancaste el cronómetro en el movil y abres el portatil, que cuadre.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") void recargar()
    }
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    return () => {
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener("focus", alVolver)
    }
  }, [recargar])

  const arrancar = useCallback(
    async (borrador: BorradorEntrada) => {
      setCargando(true)
      try {
        const { error } = await supabaseRef.current.rpc("start_timer", {
          p_workspace_id: espacioId,
          /* Cierra solo el que corriera en este espacio: el de otro sigue a lo
             suyo. Sin esto la base los cierra todos, que es lo que espera la
             version anterior de la app mientras siga desplegada. */
          p_solo_este_espacio: true,
          // La funcion recibe uuid opcional: null y undefined valen lo mismo
          p_project_id: borrador.project_id ?? undefined,
          p_edition_id: borrador.edition_id ?? undefined,
          p_task_id: borrador.task_id ?? undefined,
          p_description: borrador.description,
          p_billable: borrador.billable,
          p_tag_ids: borrador.tagIds,
        })
        if (error) throw error
        await recargar()
        router.refresh()
      } catch (err) {
        avisar(mensajeError(err), undefined, "mal")
      } finally {
        setCargando(false)
      }
    },
    [espacioId, recargar, router, avisar],
  )

  const parar = useCallback(async () => {
    setCargando(true)
    try {
      // Con el espacio: sin él, la base para el primero que encuentre, sea de donde sea
      const { data, error } = await supabaseRef.current.rpc("stop_timer", {
        p_workspace_id: espacioId,
      })
      if (error) throw error
      router.refresh()

      /* Sin nada que parar la base no da error: devuelve una fila vacía. O ya
         estaba parado -otra pestaña, el movil- o no ha dejado; se vuelve a leer
         para decir cuál, y para que la cuenta cuadre. */
      if (!data?.id) {
        const sigue = await leer()
        if (sigue === null) {
          setEnMarcha(null)
          avisar("El cronómetro ya estaba parado.")
        } else {
          if (sigue) setEnMarcha(sigue)
          avisar("No se ha podido parar el cronómetro.", undefined, "mal")
        }
        return null
      }

      setEnMarcha(null)
      return data as Entrada
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
      return null
    } finally {
      setCargando(false)
    }
  }, [espacioId, leer, router, avisar])

  /* Nada de preguntar antes: se descarta y se avisa con un Deshacer, que es
     mas rapido de usar y ademas perdona el error de verdad. */
  const descartar = useCallback(async () => {
    if (!enMarcha) return
    const tirado = enMarcha
    setCargando(true)
    try {
      const { error } = await supabaseRef.current
        .from("time_entries")
        .delete()
        .eq("id", tirado.id)
      if (error) throw error
      setEnMarcha(null)
      router.refresh()

      avisar("Cronómetro descartado.", async () => {
        const { error: errVolver } = await supabaseRef.current
          .from("time_entries")
          .insert({
            id: tirado.id,
            workspace_id: tirado.workspace_id,
            user_id: perfil.id,
            project_id: tirado.project_id,
            edition_id: tirado.edition_id,
            task_id: tirado.task_id,
            description: tirado.description,
            billable: tirado.billable,
            start_at: tirado.start_at,
          })
        if (errVolver) throw new Error(mensajeError(errVolver))
        if (tirado.tagIds.length > 0) {
          await supabaseRef.current
            .from("time_entry_tags")
            .insert(tirado.tagIds.map((tag_id) => ({ entry_id: tirado.id, tag_id })))
        }
        await recargar()
        router.refresh()
        return "Sigue corriendo."
      })
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
    } finally {
      setCargando(false)
    }
  }, [enMarcha, router, avisar, recargar, perfil.id])

  return (
    <ContextoCronometro.Provider
      value={{ enMarcha, segundos, cargando, arrancar, parar, descartar, recargar }}
    >
      {children}
    </ContextoCronometro.Provider>
  )
}

export function useCronometro(): Contexto {
  const ctx = useContext(ContextoCronometro)
  if (!ctx) {
    throw new Error("useCronometro tiene que usarse dentro de <ProveedorCronometro>")
  }
  return ctx
}
