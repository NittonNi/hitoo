"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Plus, RefreshCw, Search, Unlink, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useAvisos } from "@/components/avisos"
import { formatDateShort, formatMoney } from "@/lib/time"
import {
  anuladasPendientes,
  haceCuanto,
  ordenarPorParecido,
  type Ajuste,
  type DatosHolded,
  type HoldedAnulada,
} from "@/lib/holded"
import {
  actualizarHolded,
  desenlazarCierre,
  enlazarCierre,
  reenlazarCierre,
} from "@/app/(app)/gestion/holded/acciones"
import type { Resultado } from "@/components/resultados-proyecto"
import { cn } from "@/lib/utils"

/* ================================================================ enlazar */

/**
 * Elegir con qué proyecto de Holded va este cierre. Se abre en la propia
 * tarjeta, sin diálogo: primero sale el que más se parece por nombre.
 */
export function EnlazarHolded({
  proyectoId,
  edicionId,
  nombre,
  holded,
  onCerrar,
}: {
  proyectoId: string
  edicionId: string | null
  /** «Proyecto · Edición», para proponer el que más se parece. */
  nombre: string
  holded: DatosHolded
  onCerrar: () => void
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [busqueda, setBusqueda] = useState("")
  const [enlazando, setEnlazando] = useState<string | null>(null)

  const opciones = useMemo(() => {
    const q = busqueda
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
    const ordenados = ordenarPorParecido(holded.proyectos, q || nombre).map((x) => x.p)
    const filtrados = q
      ? ordenados.filter((p) =>
          p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q),
        )
      : ordenados
    // Los que ya están enlazados con otro cierre, al final: no se pueden elegir
    const libresPrimero = [
      ...filtrados.filter((p) => !holded.enlazados[p.holded_id]),
      ...filtrados.filter((p) => holded.enlazados[p.holded_id]),
    ]
    return libresPrimero.slice(0, 8)
  }, [busqueda, holded.proyectos, holded.enlazados, nombre])

  async function enlazar(holdedId: string, nombreHolded: string) {
    setEnlazando(holdedId)
    const r = await enlazarCierre({ proyectoId, edicionId, holdedId })
    setEnlazando(null)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      router.refresh()
      return
    }
    onCerrar()
    avisar(`Enlazado con ${nombreHolded}.`, async () => {
      const d = await desenlazarCierre(r.cierreId)
      router.refresh()
      if ("error" in d) return d.error
    })
    router.refresh()
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            autoFocus
            className="field h-8 py-0 pl-8 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en Holded"
            aria-label="Buscar proyecto de Holded"
          />
        </div>
        <button type="button" onClick={onCerrar} className="btn h-8 shrink-0 text-xs">
          Cancelar
        </button>
      </div>

      {holded.proyectos.length === 0 ? (
        <p className="text-xs text-muted">
          Todavía no se ha traído el listado de Holded. Pulsa «Actualizar» en Gestión → Holded.
        </p>
      ) : opciones.length === 0 ? (
        <p className="text-xs text-muted">Ningún proyecto de Holded se llama así.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radio-sm)] border border-line">
          {opciones.map((p) => {
            const enOtro = holded.enlazados[p.holded_id]
            const ocupado = Boolean(enOtro)
            return (
              <li key={p.holded_id}>
                <button
                  type="button"
                  disabled={ocupado || enlazando !== null}
                  onClick={() => void enlazar(p.holded_id, p.name)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition",
                    ocupado ? "cursor-not-allowed text-muted" : "hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    {ocupado && (
                      <span className="block truncate text-xs">ya enlazado con {enOtro}</span>
                    )}
                  </span>
                  <span className="cifra shrink-0 text-xs text-muted">
                    {enlazando === p.holded_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : p.start_date ? (
                      formatDateShort(p.start_date)
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ================================================================ desglose */

/**
 * Un cierre enlazado: de dónde sale cada cifra. Lo que dice Holded, cada
 * ajuste con su nota y su firma, y las facturas anuladas que Holded cuenta.
 * El total no se calcula aquí: lo calcula la base, y aquí solo se enseña.
 */
export function DesgloseHolded({
  espacioId,
  resultado,
  holded,
  puedeGestionar,
}: {
  espacioId: string
  resultado: Resultado
  holded: DatosHolded
  puedeGestionar: boolean
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [actualizando, setActualizando] = useState(false)
  const [desenlazando, setDesenlazando] = useState(false)
  const [nuevo, setNuevo] = useState<{
    campo: "income" | "expenses"
    importe: string
    nota: string
    documento: string | null
  } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const holdedId = resultado.holded_project_id!
  const nombreHolded =
    holded.proyectos.find((p) => p.holded_id === holdedId)?.name ?? null
  const ajustes = holded.ajustes.filter((a) => a.result_id === resultado.id)
  const anuladas = anuladasPendientes(
    (Array.isArray(resultado.holded_cancelled) ? resultado.holded_cancelled : []) as HoldedAnulada[],
    ajustes,
  )

  async function actualizar() {
    setActualizando(true)
    const r = await actualizarHolded(resultado.id)
    setActualizando(false)
    if (!r.ok) avisar(r.error, undefined, "mal")
    else if (r.aviso) avisar(r.aviso)
    router.refresh()
  }

  async function desenlazar() {
    setDesenlazando(true)
    const r = await desenlazarCierre(resultado.id)
    setDesenlazando(false)
    if ("error" in r) {
      avisar(r.error, undefined, "mal")
      return
    }
    avisar("Desenlazado: el cierre se queda con la última cifra, a mano.", async () => {
      const d = await reenlazarCierre(resultado.id, holdedId)
      router.refresh()
      if ("error" in d) return d.error
    })
    router.refresh()
  }

  function importeDe(texto: string) {
    const limpio = texto.trim().replace(/\s|€/g, "").replace("−", "-").replace(",", ".")
    const n = Number(limpio)
    return limpio && Number.isFinite(n) && n !== 0 ? Math.round(n * 100) / 100 : null
  }

  async function guardarAjuste() {
    if (!nuevo) return
    const importe = importeDe(nuevo.importe)
    if (importe === null) {
      setError("El importe tiene que ser un número distinto de cero, como -150 o 80,50.")
      return
    }
    if (!nuevo.nota.trim()) {
      setError("Escribe por qué: la nota es lo que evita dudas luego.")
      return
    }
    setGuardando(true)
    setError(null)
    const { data, error: err } = await createClient()
      .from("result_adjustments")
      .insert({
        workspace_id: espacioId,
        result_id: resultado.id,
        field: nuevo.campo,
        amount: importe,
        note: nuevo.nota.trim(),
        holded_document: nuevo.documento,
      })
      .select("id")
    setGuardando(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    if (!data?.length) {
      setError("No se ha podido guardar el ajuste.")
      return
    }
    setNuevo(null)
    router.refresh()
  }

  async function quitarAjuste(a: Ajuste) {
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("result_adjustments")
      .delete()
      .eq("id", a.id)
      .select("id")
    if (err || !data?.length) {
      avisar(err ? mensajeError(err) : "No se ha podido quitar el ajuste.", undefined, "mal")
      return
    }
    avisar("Ajuste quitado.", async () => {
      const { error: e } = await createClient()
        .from("result_adjustments")
        .insert({
          workspace_id: espacioId,
          result_id: a.result_id,
          field: a.field,
          amount: a.amount,
          note: a.note,
          holded_document: a.holded_document,
        })
        .select("id")
      router.refresh()
      if (e) return mensajeError(e)
    })
    router.refresh()
  }

  function restarAnulada(f: HoldedAnulada) {
    setError(null)
    setNuevo({
      campo: "income",
      importe: String(-f.importe).replace(".", ","),
      nota: `Factura ${f.numero} anulada, que Holded sigue contando`,
      documento: f.numero,
    })
  }

  const filas: { campo: "income" | "expenses"; titulo: string; total: number; deHolded: number | null }[] = [
    { campo: "income", titulo: "Ingresos", total: Number(resultado.income), deHolded: resultado.holded_income ?? null },
    { campo: "expenses", titulo: "Gastos", total: Number(resultado.expenses), deHolded: resultado.holded_expenses ?? null },
  ]

  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        {filas.map((fila) => (
          <div key={fila.campo}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium">{fila.titulo}</dt>
              <dd className="cifra font-semibold">{formatMoney(fila.total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 pl-3 text-xs text-muted">
              <span className="min-w-0 truncate">Holded{nombreHolded ? ` · ${nombreHolded}` : ""}</span>
              <span className="cifra shrink-0">
                {fila.deHolded === null ? "—" : formatMoney(Number(fila.deHolded))}
              </span>
            </div>
            {ajustes
              .filter((a) => a.field === fila.campo)
              .map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 pl-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-ink-soft">Ajuste</p>
                    <p className="text-muted">«{a.note}»</p>
                    <p className="text-muted">
                      {holded.nombres[a.created_by ?? ""] ?? "Alguien"} ·{" "}
                      {formatDateShort(a.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="cifra text-ink-soft">
                      {a.amount > 0 ? "+" : ""}
                      {formatMoney(Number(a.amount))}
                    </span>
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => void quitarAjuste(a)}
                        className="rounded-[3px] p-0.5 text-muted transition hover:bg-danger-soft hover:text-danger"
                        aria-label={`Quitar el ajuste «${a.note}»`}
                        title="Quitar el ajuste"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </dl>

      {anuladas.length > 0 && (
        <div className="space-y-1.5 rounded-[var(--radio-sm)] border border-live-line bg-live-soft p-2.5 text-xs text-live">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {anuladas.length === 1
              ? "Holded cuenta una factura anulada:"
              : `Holded cuenta ${anuladas.length} facturas anuladas:`}
          </p>
          {anuladas.map((f) => (
            <div key={f.numero} className="flex flex-wrap items-center justify-between gap-2 pl-5">
              <span className="cifra">
                {f.numero} · {f.fecha ? formatDateShort(f.fecha) : "sin fecha"} · {formatMoney(f.importe)}
              </span>
              {puedeGestionar && (
                <button type="button" onClick={() => restarAnulada(f)} className="btn h-7 text-xs">
                  Restarla con un ajuste
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {nuevo && (
        <div className="space-y-2 rounded-[var(--radio-sm)] bg-surface-2 p-2.5">
          <div className="flex flex-wrap gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-[var(--radio-sm)] border border-line" role="radiogroup" aria-label="Qué se ajusta">
              {(["income", "expenses"] as const).map((campo) => (
                <button
                  key={campo}
                  type="button"
                  role="radio"
                  aria-checked={nuevo.campo === campo}
                  onClick={() => setNuevo({ ...nuevo, campo })}
                  className={cn(
                    "h-8 px-3 text-xs transition",
                    nuevo.campo === campo ? "bg-accent text-accent-fg" : "bg-surface text-ink-soft",
                  )}
                >
                  {campo === "income" ? "Ingresos" : "Gastos"}
                </button>
              ))}
            </div>
            <input
              className="field cifra h-8 w-28 py-0 text-sm"
              inputMode="decimal"
              value={nuevo.importe}
              onChange={(e) => setNuevo({ ...nuevo, importe: e.target.value })}
              placeholder="-150"
              aria-label="Importe del ajuste, con signo menos para restar"
            />
          </div>
          <input
            autoFocus
            className="field h-8 py-0 text-sm"
            value={nuevo.nota}
            onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })}
            placeholder="Por qué: factura duplicada, gasto en efectivo…"
            aria-label="Nota del ajuste"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNuevo(null)} className="btn h-8 text-xs">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void guardarAjuste()}
              disabled={guardando}
              className="btn btn-primary h-8 text-xs"
            >
              {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar ajuste
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" suppressHydrationWarning>
          {holded.conectado
            ? `Traído ${haceCuanto(resultado.holded_synced_at ?? null)}`
            : "Holded desconectado: cifras de la última vez"}
        </p>
        {puedeGestionar && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!nuevo && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setNuevo({ campo: "income", importe: "", nota: "", documento: null })
                }}
                className="btn h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajuste
              </button>
            )}
            {holded.conectado && (
              <button
                type="button"
                onClick={() => void actualizar()}
                disabled={actualizando}
                className="btn h-8 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", actualizando && "animate-spin")} />
                Actualizar
              </button>
            )}
            <button
              type="button"
              onClick={() => void desenlazar()}
              disabled={desenlazando}
              className="btn h-8 text-xs"
              title="Dejar este cierre a mano"
            >
              <Unlink className="h-3.5 w-3.5" />
              Desenlazar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
