"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Square, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import {
  enMarchaEnOtrosEspacios,
  SEGUNDOS_OLVIDO,
  type EnMarchaEnOtroEspacio,
} from "@/lib/cronometro"
import { formatDuration } from "@/lib/time"
import { useAvisos } from "@/components/avisos"
import { useCronometro } from "@/components/proveedor-cronometro"
import { useSesion } from "@/components/proveedor-sesion"

/**
 * La línea que pregunta si se te olvidó el cronómetro.
 *
 * Cada espacio enseña solo el suyo, así que uno olvidado en otro espacio
 * correría sin que nadie lo viera. Por eso, pasadas las diez horas, sale aquí
 * sea del espacio que sea; antes no sale nada, ni del de aquí ni del de fuera.
 *
 * No se va sola, que es lo que la distingue de un aviso de abajo: se cierra
 * con la X, y cerrada se queda para ese cronómetro mientras dure la pestaña.
 */

const ALMACEN = "olvido-cerrados"

function leerCerrados(): string[] {
  try {
    const lista: unknown = JSON.parse(sessionStorage.getItem(ALMACEN) ?? "[]")
    return Array.isArray(lista)
      ? lista.filter((id): id is string => typeof id === "string")
      : []
  } catch {
    // Sin almacen, o bloqueado: vuelve a salir, que es mejor que perderla
    return []
  }
}

function guardarCerrados(ids: string[]) {
  try {
    sessionStorage.setItem(ALMACEN, JSON.stringify(ids))
  } catch {
    // da igual: en esta pantalla ya esta cerrada
  }
}

function segundosEntre(inicio: string, fin: number) {
  return Math.max(0, Math.floor((fin - new Date(inicio).getTime()) / 1000))
}

type Linea = {
  id: string
  espacioId: string
  /** null si es el de este espacio: entonces basta con «el cronómetro». */
  espacioNombre: string | null
  segundos: number
}

export function AvisoOlvido({ fuera }: { fuera: EnMarchaEnOtroEspacio[] }) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const { perfil, espacio, espacios } = useSesion()
  const { enMarcha, segundos, parar, cargando } = useCronometro()
  const supabaseRef = useRef(createClient())

  /* Los de fuera llegan del layout y se ponen al día al volver a la pestaña,
     por si se arrancó o se paró uno en el movil. Si el layout trae datos
     nuevos (router.refresh), mandan esos. */
  const [deLayout, setDeLayout] = useState(fuera)
  const [otros, setOtros] = useState(fuera)
  if (deLayout !== fuera) {
    setDeLayout(fuera)
    setOtros(fuera)
  }

  /* null hasta montar: la hora del servidor y la del navegador no son la misma
     y pintar la cuenta antes de hidratar daria un desajuste. Lo cerrado tambien
     se lee al montar, que en el servidor no hay sessionStorage. */
  const [ahora, setAhora] = useState<number | null>(null)
  const [cerrados, setCerrados] = useState<string[]>([])
  const [parando, setParando] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setCerrados(leerCerrados())
      setAhora(Date.now())
    }, 0)
    return () => clearTimeout(id)
  }, [])

  /* Del de aquí ya lleva la cuenta el proveedor; de los de fuera, nadie. Para
     esperar diez horas no hace falta un tic por segundo: se despierta cuando
     el primero las cumple, y desde ahí sí, cada segundo, mientras haya alguno
     a la vista. */
  useEffect(() => {
    if (ahora === null) return
    const limites = otros
      .filter((o) => !cerrados.includes(o.id))
      .map((o) => new Date(o.start_at).getTime() + SEGUNDOS_OLVIDO * 1000)
    if (limites.length === 0) return
    const espera = limites.some((l) => l <= ahora)
      ? 1000
      : Math.min(...limites) - ahora
    const id = setTimeout(() => setAhora(Date.now()), espera)
    return () => clearTimeout(id)
  }, [ahora, otros, cerrados])

  const sincronizar = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("time_entries")
      .select("id, workspace_id, start_at")
      .eq("user_id", perfil.id)
      .is("end_at", null)
    // Si la lectura falla se queda lo que habia: no es motivo para molestar
    if (error) return null
    const lista = enMarchaEnOtrosEspacios(data, espacios, espacio.id)
    setOtros(lista)
    return lista
  }, [perfil.id, espacio.id, espacios])

  // Con un solo espacio no hay fuera que vigilar
  useEffect(() => {
    if (espacios.length < 2) return
    const alVolver = () => {
      if (document.visibilityState !== "visible") return
      // En segundo plano el navegador congela los relojes: se recupera la hora
      setAhora(Date.now())
      void sincronizar()
    }
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    return () => {
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener("focus", alVolver)
    }
  }, [espacios.length, sincronizar])

  function cerrar(id: string) {
    const lista = [...cerrados, id]
    setCerrados(lista)
    guardarCerrados(lista)
  }

  async function pararLinea(linea: Linea) {
    // El de aquí, con el proveedor: así la cuenta de la barra se entera
    if (linea.espacioNombre === null) {
      const cerrada = await parar()
      if (cerrada?.end_at) {
        avisar(
          `Hora apuntada: ${formatDuration(
            segundosEntre(cerrada.start_at, new Date(cerrada.end_at).getTime()),
          )}.`,
        )
      }
      return
    }

    const nombre = linea.espacioNombre
    setParando(linea.id)
    try {
      const { data, error } = await supabaseRef.current.rpc("stop_timer", {
        p_workspace_id: linea.espacioId,
      })
      if (error) throw error
      router.refresh()

      /* Sin nada que parar la base no da error: devuelve una fila vacía. O ya
         estaba parado -otra pestaña, el movil- o no ha dejado; se vuelve a leer
         para decir cuál. */
      if (!data?.id || !data.end_at) {
        const lista = await sincronizar()
        const sigue = lista?.some((o) => o.id === linea.id) ?? true
        avisar(
          sigue
            ? `No se ha podido parar el cronómetro de ${nombre}.`
            : `El cronómetro de ${nombre} ya estaba parado.`,
          undefined,
          sigue ? "mal" : "normal",
        )
        return
      }

      setOtros((lista) => lista.filter((o) => o.id !== linea.id))
      avisar(
        `Hora apuntada en ${nombre}: ${formatDuration(
          segundosEntre(data.start_at, new Date(data.end_at).getTime()),
        )}.`,
      )
    } catch (err) {
      const mensaje = mensajeError(err)
      /* Ese espacio pide proyecto y este no lo lleva: desde aqui no se puede
         elegir, asi que se dice donde hay que entrar */
      avisar(
        mensaje.startsWith("Elige un proyecto")
          ? `En ${nombre} hace falta un proyecto para parar: entra en ese espacio y elígelo.`
          : mensaje,
        undefined,
        "mal",
      )
    } finally {
      setParando(null)
    }
  }

  if (ahora === null) return null

  const lineas: Linea[] = []
  if (enMarcha && segundos >= SEGUNDOS_OLVIDO && !cerrados.includes(enMarcha.id)) {
    lineas.push({ id: enMarcha.id, espacioId: espacio.id, espacioNombre: null, segundos })
  }
  for (const o of otros) {
    const s = segundosEntre(o.start_at, ahora)
    if (s >= SEGUNDOS_OLVIDO && !cerrados.includes(o.id)) {
      lineas.push({
        id: o.id,
        espacioId: o.espacioId,
        espacioNombre: o.espacioNombre,
        segundos: s,
      })
    }
  }
  if (lineas.length === 0) return null

  /* Sin role="status": la cuenta cambia cada segundo y un lector de pantalla
     la leería cada segundo. */
  return (
    <div className="no-print mb-4 space-y-2">
      {lineas.map((linea) => {
        const ocupado =
          linea.espacioNombre === null ? cargando : parando === linea.id
        return (
          <div
            key={linea.id}
            className="entra flex items-center gap-2 rounded-[var(--radio)] border border-live-line bg-live-soft py-2 pl-3 pr-2 text-sm"
          >
            <span
              aria-hidden
              className="latido w-[3px] shrink-0 self-stretch rounded-full bg-live-fill"
            />
            <p className="min-w-0 flex-1 text-ink-soft">
              {linea.espacioNombre === null
                ? "El cronómetro"
                : `El cronómetro de ${linea.espacioNombre}`}{" "}
              lleva{" "}
              <span className="cifra font-semibold text-live">
                {formatDuration(linea.segundos)}
              </span>{" "}
              en marcha. ¿Se te olvidó?
            </p>
            <button
              type="button"
              onClick={() => void pararLinea(linea)}
              disabled={ocupado}
              className="btn h-8 shrink-0 border-live-line text-live"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden />
              Parar
            </button>
            <button
              type="button"
              onClick={() => cerrar(linea.id)}
              aria-label="Cerrar el aviso"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radio-sm)] text-live transition hover:bg-live/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
