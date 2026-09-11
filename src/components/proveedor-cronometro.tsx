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
import {
  aEntradaEnMarcha,
  aEntradaPausada,
  SELECT_EN_MARCHA,
  SELECT_PAUSA,
} from "@/lib/cronometro"
import { useAvisos } from "@/components/avisos"
import { useSesion } from "@/components/proveedor-sesion"
import type { BorradorEntrada, Entrada, EntradaEnMarcha, EntradaPausada } from "@/lib/tipos"

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
  /** Un rato pausado en este espacio, si lo hay: «Seguir» arranca uno igual. */
  pausa: EntradaPausada | null
  /** Para el rato en marcha y lo deja guardado como pausa, con las mismas
   *  comprobaciones que parar (proyecto y descripción, si el espacio los exige).
   *  Devuelve la hora cerrada, como parar, para poder proponerla. */
  pausar: () => Promise<Entrada | null>
  /** Quita la pausa sin arrancar nada: el rato ya guardado no se toca. */
  quitarPausa: () => Promise<void>
}

const ContextoCronometro = createContext<Contexto | null>(null)

export function ProveedorCronometro({
  espacioId,
  inicial,
  pausaInicial,
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
  /** Un rato pausado en este espacio, leído igual que `inicial`. */
  pausaInicial: EntradaPausada | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { perfil } = useSesion()
  const [enMarcha, setEnMarcha] = useState<EntradaEnMarcha | null>(inicial)
  const [pausa, setPausa] = useState<EntradaPausada | null>(pausaInicial)
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

  /** La pausa de este espacio según el servidor; undefined si no hay sesión. */
  const leerPausa = useCallback(async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return undefined

    const { data } = await supabase
      .from("timer_pauses")
      .select(SELECT_PAUSA)
      .eq("user_id", user.id)
      .eq("workspace_id", espacioId)
      .maybeSingle()

    return aEntradaPausada(data)
  }, [espacioId])

  const recargar = useCallback(async () => {
    // A la vez: son independientes y la base ya garantiza que no coinciden
    const [leida, pausaLeida] = await Promise.all([leer(), leerPausa()])
    if (leida !== undefined) setEnMarcha(leida)
    if (pausaLeida !== undefined) setPausa(pausaLeida)
  }, [leer, leerPausa])

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
      const { data, error } = await supabaseRef.current
        .from("time_entries")
        .delete()
        .eq("id", tirado.id)
        .select("id")
      if (error) throw error
      // La RLS puede dejar pasar la orden y no borrar ninguna fila: PostgREST no lo cuenta como error
      if (!data?.length) throw new Error("No se ha podido descartar el cronómetro.")
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

  /**
   * Para el rato en marcha y lo deja guardado como pausa: mismas
   * comprobaciones que parar (las hace la propia función en la base), y en la
   * misma transacción se apunta en `timer_pauses`. La configuración ya la
   * tenemos en `enMarcha` -es la misma hora que se acaba de cerrar-, así que
   * no hace falta releerla del servidor para pintar la barra al momento.
   */
  const pausar = useCallback(async (): Promise<Entrada | null> => {
    if (!enMarcha) return null
    const activa = enMarcha
    setCargando(true)
    try {
      const { data, error } = await supabaseRef.current.rpc("pause_timer", {
        p_workspace_id: espacioId,
      })
      if (error) throw error
      router.refresh()

      // Igual que en parar(): sin nada que pausar la base no da error, da una fila vacía
      if (!data?.id) {
        const sigue = await leer()
        if (sigue === null) {
          setEnMarcha(null)
          avisar("El cronómetro ya estaba parado.")
        } else {
          if (sigue) setEnMarcha(sigue)
          avisar("No se ha podido pausar el cronómetro.", undefined, "mal")
        }
        return null
      }

      setEnMarcha(null)
      setPausa({
        entryId: data.id,
        project_id: activa.project_id,
        edition_id: activa.edition_id,
        task_id: activa.task_id,
        description: activa.description,
        start_at: activa.start_at,
        end_at: data.end_at!,
        billable: activa.billable,
        proyecto: activa.proyecto,
        tarea: activa.tarea,
        tagIds: activa.tagIds,
      })
      return data as Entrada
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
      return null
    } finally {
      setCargando(false)
    }
  }, [enMarcha, espacioId, leer, router, avisar])

  /* Solo quita la fila de timer_pauses: el rato ya cerrado no se toca, así
     que deshacerlo es solo volver a apuntar la pausa. */
  const quitarPausa = useCallback(async () => {
    if (!pausa) return
    const quitada = pausa
    setCargando(true)
    try {
      const { data, error } = await supabaseRef.current
        .from("timer_pauses")
        .delete()
        .eq("workspace_id", espacioId)
        .eq("user_id", perfil.id)
        .select("entry_id")
      if (error) throw error
      if (!data?.length) throw new Error("No se ha podido quitar la pausa.")

      setPausa(null)

      avisar("Pausa quitada.", async () => {
        const { error: errVolver } = await supabaseRef.current
          .from("timer_pauses")
          .insert({
            workspace_id: espacioId,
            user_id: perfil.id,
            entry_id: quitada.entryId,
          })
        if (errVolver) throw new Error(mensajeError(errVolver))
        await recargar()
        return "Sigue en pausa."
      })
    } catch (err) {
      avisar(mensajeError(err), undefined, "mal")
    } finally {
      setCargando(false)
    }
  }, [pausa, espacioId, perfil.id, avisar, recargar])

  return (
    <ContextoCronometro.Provider
      value={{
        enMarcha,
        segundos,
        cargando,
        arrancar,
        parar,
        descartar,
        recargar,
        pausa,
        pausar,
        quitarPausa,
      }}
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
