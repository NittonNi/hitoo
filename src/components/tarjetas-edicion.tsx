"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Archive,
  Euro,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Star,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { useAvisos } from "@/components/avisos"
import { formatDateShort, formatDurationShort, formatMoney, todayKey } from "@/lib/time"
import type { Edicion, EntradaVista } from "@/lib/tipos"
import type { DatosHolded } from "@/lib/holded"
import type { Resultado } from "@/components/resultados-proyecto"
import { DesgloseHolded, EnlazarHolded } from "@/components/cierre-holded"
import { cn } from "@/lib/utils"

/**
 * Cada edición, una tarjeta. Es la unidad de trabajo de verdad: un evento
 * tiene sus horas y su resultado, y el proyecto solo es el paraguas
 * que los junta. Los proyectos que no se repiten no necesitan ediciones: ahí la
 * tarjeta es el proyecto entero.
 */
export function TarjetasEdicion({
  espacioId,
  proyectoId,
  nombreProyecto,
  holded,
  ediciones,
  entradas,
  resultados,
  objetivoHora,
  predeterminada,
  puedeGestionar,
  puedeVerImportes,
}: {
  espacioId: string
  proyectoId: string
  nombreProyecto: string
  /** Null si quien mira no ve importes. */
  holded: DatosHolded | null
  ediciones: Edicion[]
  entradas: EntradaVista[]
  resultados: Resultado[]
  objetivoHora: number | null
  predeterminada: string | null
  puedeGestionar: boolean
  puedeVerImportes: boolean
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [creando, setCreando] = useState(false)
  const [verArchivadas, setVerArchivadas] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibles = ediciones.filter((e) => verArchivadas || !e.archived)
  const archivadas = ediciones.filter((e) => e.archived).length
  const sueltas = entradas.filter((e) => !e.edition_id)
  const sinEdiciones = ediciones.length === 0

  /* El periodo del cierre sin edicion es el de las horas sueltas, no el de
     todo el proyecto: si contara tambien las horas que ya son de una
     edicion, se duplicarian al sumar los cierres -esa edicion ya las cuenta
     por su cuenta-. Sin ediciones, sueltas es todo, asi que no cambia nada. */
  const dias = sueltas.map((e) => e.local_date).sort()
  const vida = {
    primera: dias[0] ?? null,
    ultima: dias[dias.length - 1] ?? null,
  }

  /** El del proyecto entero: existe cuando no hay ediciones que cierren solas. */
  const delProyecto = resultados.find((r) => !r.edition_id) ?? null

  async function crear() {
    const limpio = nombre.trim()
    if (!limpio) return
    setOcupado(true)
    setError(null)
    const { error: err } = await createClient().from("project_editions").insert({
      workspace_id: espacioId,
      project_id: proyectoId,
      name: limpio,
      position: ediciones.length,
    })
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setNombre("")
    setCreando(false)
    router.refresh()
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            {sinEdiciones ? "Este proyecto" : "Ediciones"}
          </h2>
          <p className="text-sm text-muted">
            {sinEdiciones
              ? "No se repite: el proyecto entero es la unidad, con sus fechas, sus horas y su resultado."
              : "Lo que se repite va en ediciones: TBCE 1 y TBCE 2 son el mismo proyecto en dos años, cada una con sus horas y su resultado."}
          </p>
        </div>
        {archivadas > 0 && (
          <button
            type="button"
            onClick={() => setVerArchivadas((v) => !v)}
            className="text-xs font-medium text-muted transition hover:text-ink"
          >
            {verArchivadas ? "Ocultar" : "Ver"} cerradas ({archivadas})
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-[var(--radio-sm)] bg-danger-soft p-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Horas que no están en ninguna edición: un cabo suelto, no una
          tarjeta. No se cierran cuentas de lo que nadie ha repartido. */}
      {!sinEdiciones && sueltas.length > 0 && puedeGestionar && (
        <HorasSueltas
          entradas={sueltas}
          ediciones={visibles.filter((e) => !e.archived)}
        />
      )}

      {sinEdiciones ? (
        /* Sin ediciones el proyecto es la unidad: una sola tarjeta, a lo ancho,
           y llamada por lo que es y no por lo que le falta. */
        <Tarjeta
          espacioId={espacioId}
          proyectoId={proyectoId}
          nombreProyecto={nombreProyecto}
          holded={holded}
          edicion={null}
          titulo="Todo el proyecto"
          entradas={sueltas}
          vida={vida}
          resultado={delProyecto}
          objetivoHora={objetivoHora}
          enCurso={false}
          puedeGestionar={puedeGestionar}
          puedeVerImportes={puedeVerImportes}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibles.map((edicion) => (
            <Tarjeta
              key={edicion.id}
              espacioId={espacioId}
              proyectoId={proyectoId}
              nombreProyecto={nombreProyecto}
              holded={holded}
              edicion={edicion}
              entradas={entradas.filter((e) => e.edition_id === edicion.id)}
              vida={vida}
              resultado={resultados.find((r) => r.edition_id === edicion.id) ?? null}
              objetivoHora={objetivoHora}
              enCurso={predeterminada === edicion.id}
              puedeGestionar={puedeGestionar}
              puedeVerImportes={puedeVerImportes}
            />
          ))}

          {/* Un cierre del proyecto entero de cuando no había ediciones: se
              sigue pudiendo tocar, que si no el dinero cuenta y no se ve. */}
          {delProyecto && (
            <Tarjeta
              espacioId={espacioId}
              proyectoId={proyectoId}
              nombreProyecto={nombreProyecto}
              holded={holded}
              edicion={null}
              titulo="Resultado del proyecto"
              entradas={sueltas}
              vida={vida}
              resultado={delProyecto}
              objetivoHora={objetivoHora}
              enCurso={false}
              puedeGestionar={puedeGestionar}
              puedeVerImportes={puedeVerImportes}
            />
          )}
        </div>
      )}

      {puedeGestionar &&
        (creando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void crear()
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              autoFocus
              className="field w-auto min-w-[12rem] flex-1"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="TBCE 3, edición de mayo, 2027..."
              aria-label="Nombre de la edición"
            />
            <button
              type="submit"
              disabled={ocupado || !nombre.trim()}
              className="btn btn-primary shrink-0"
            >
              {ocupado ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="btn shrink-0"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setCreando(true)} className="btn">
            <Plus className="h-4 w-4" />
            Nueva edición
          </button>
        ))}
    </section>
  )
}

/* ------------------------------------------------------------ una tarjeta */

function Tarjeta({
  espacioId,
  proyectoId,
  nombreProyecto,
  holded,
  edicion,
  titulo,
  entradas,
  vida,
  resultado,
  objetivoHora,
  enCurso,
  puedeGestionar,
  puedeVerImportes,
}: {
  espacioId: string
  proyectoId: string
  nombreProyecto: string
  holded: DatosHolded | null
  /** Null: la tarjeta es el proyecto entero. */
  edicion: Edicion | null
  /** Como se llama cuando no es una edicion. */
  titulo?: string
  entradas: EntradaVista[]
  /** De cuando a cuando vive el proyecto entero, para el cierre sin edicion. */
  vida: { primera: string | null; ultima: string | null }
  resultado: Resultado | null
  objetivoHora: number | null
  enCurso: boolean
  puedeGestionar: boolean
  puedeVerImportes: boolean
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [editando, setEditando] = useState(false)
  const [enlazando, setEnlazando] = useState(false)
  const [ingresos, setIngresos] = useState("")
  const [gastos, setGastos] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cerradas = entradas.filter((e) => e.end_at)
  const segundos = cerradas.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
  const cobrables = cerradas
    .filter((e) => e.billable)
    .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)

  /* De la primera hora apuntada a la ultima: las fechas no se escriben, se
     deducen de lo trabajado. */
  const dias = cerradas.map((e) => e.local_date).sort()
  const primera = dias[0] ?? null
  const ultima = dias[dias.length - 1] ?? null

  const neto = resultado
    ? Number(resultado.income) - Number(resultado.expenses)
    : null
  const horasCobrables = cobrables / 3600
  /* Con menos de una hora marcada esto no es un dato, es una division: mil
     euros entre dieciocho segundos son doscientos mil euros la hora. */
  const porHora =
    resultado && horasCobrables >= 1
      ? Number(resultado.income) / horasCobrables
      : null
  const faltanHoras = Boolean(resultado) && horasCobrables < 1
  const llega = porHora !== null && objetivoHora ? porHora >= objetivoHora : null
  /** Como se llamaría en Holded: «Proyecto Edición». */
  const nombreCierre = edicion ? `${nombreProyecto} ${edicion.name}` : nombreProyecto

  function aNumero(texto: string) {
    const limpio = texto.trim().replace(/\s|€/g, "").replace(",", ".")
    if (!limpio) return 0
    const valor = Number(limpio)
    return Number.isFinite(valor) ? valor : null
  }

  function abrir() {
    setIngresos(resultado ? String(resultado.income) : "")
    setGastos(resultado ? String(resultado.expenses) : "")
    setError(null)
    setEditando(true)
  }

  async function guardar() {
    const entra = aNumero(ingresos)
    const sale = aNumero(gastos)
    if (entra === null || sale === null) {
      setError("Los importes tienen que ser números, como 1250 o 1250,50.")
      return
    }

    /* El periodo de una edicion son sus horas; el del proyecto entero, las
       de todo el proyecto. Nunca las que quedaron sueltas: eso cambiaba solo
       con mover una hora de sitio. */
    const desde = (edicion ? primera : vida.primera) ?? todayKey()
    const hasta = (edicion ? ultima : vida.ultima) ?? todayKey()

    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = resultado
      ? await supabase
          .from("project_results")
          .update({
            income: entra,
            expenses: sale,
            // Se reajusta al guardar: entretanto se habran apuntado mas horas
            starts_on: desde,
            ends_on: hasta,
          })
          .eq("id", resultado.id)
          .select("id")
      : await supabase
          .from("project_results")
          .insert({
            workspace_id: espacioId,
            project_id: proyectoId,
            edition_id: edicion?.id ?? null,
            label: edicion?.name ?? (titulo ?? "Todo el proyecto"),
            starts_on: desde,
            ends_on: hasta,
            income: entra,
            expenses: sale,
          })
          .select("id")

    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    if (!data || data.length === 0) {
      setError("No se ha podido guardar el resultado.")
      return
    }
    setEditando(false)
    router.refresh()
  }

  async function marcarEnCurso() {
    setOcupado(true)
    const { error: err } = await createClient()
      .from("projects")
      .update({ default_edition_id: enCurso ? null : (edicion?.id ?? null) })
      .eq("id", proyectoId)
    setOcupado(false)
    if (err) {
      avisar(mensajeError(err), undefined, "mal")
      return
    }
    router.refresh()
  }

  async function archivar() {
    if (!edicion) return
    setOcupado(true)
    const { error: err } = await createClient()
      .from("project_editions")
      .update({ archived: !edicion.archived })
      .eq("id", edicion.id)
    setOcupado(false)
    if (err) {
      avisar(mensajeError(err), undefined, "mal")
      return
    }
    router.refresh()
  }

  return (
    <article
      className={cn(
        "card flex min-w-0 flex-col gap-3 p-4",
        edicion?.archived && "opacity-60",
      )}
    >
      <header className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {edicion?.name ?? titulo ?? "Todo el proyecto"}
            </span>
            {enCurso && (
              <span className="chip shrink-0 border-live-line bg-live-soft text-live">
                en curso
              </span>
            )}
            {edicion?.archived && <span className="chip shrink-0">cerrada</span>}
          </h3>
          <p className="cifra mt-0.5 text-xs text-muted">
            {primera ? (
              <>
                {formatDateShort(primera)}
                {ultima !== primera && ` – ${formatDateShort(ultima!)}`}
              </>
            ) : (
              <span className="cifra-no">Todavía sin horas</span>
            )}
          </p>
        </div>

        {puedeGestionar && edicion && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void marcarEnCurso()}
              disabled={ocupado}
              aria-pressed={enCurso}
              title={
                enCurso
                  ? "Es lo que se pone al elegir el proyecto"
                  : "Marcarla como la edición en curso"
              }
              className={cn(
                "rounded-[3px] p-1 transition",
                enCurso ? "text-live" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Star className={cn("h-3.5 w-3.5", enCurso && "fill-current")} />
            </button>
            {edicion && (
              <button
                type="button"
                onClick={() => void archivar()}
                disabled={ocupado}
                title={edicion.archived ? "Reabrir" : "Cerrar la edición"}
                aria-label={edicion.archived ? "Reabrir" : "Cerrar la edición"}
                className="rounded-[3px] p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                {edicion.archived ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
        <p>
          <span className="cifra text-xl font-semibold leading-none">
            {formatDurationShort(segundos)}
          </span>
          <span className="ml-1.5 text-xs text-muted">en total</span>
        </p>
        {cobrables > 0 && (
          <p className="text-xs text-muted">
            <span className="cifra text-billable">
              {formatDurationShort(cobrables)}
            </span>{" "}
            se cobran
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- resultado */}
      {puedeVerImportes && (
        <div className="border-t border-line pt-3">
          {editando ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`ing-${edicion?.id ?? "sin"}`}>
                    Ingresos (€)
                  </label>
                  <input
                    id={`ing-${edicion?.id ?? "sin"}`}
                    autoFocus
                    className="field cifra h-8 py-0"
                    value={ingresos}
                    onChange={(e) => setIngresos(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`gas-${edicion?.id ?? "sin"}`}>
                    Gastos (€)
                  </label>
                  <input
                    id={`gas-${edicion?.id ?? "sin"}`}
                    className="field cifra h-8 py-0"
                    value={gastos}
                    onChange={(e) => setGastos(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  className="btn h-8"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void guardar()}
                  disabled={ocupado}
                  className="btn btn-primary h-8"
                >
                  {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar
                </button>
              </div>
            </div>
          ) : resultado?.holded_project_id && holded ? (
            /* Enlazado: las cifras salen de Holded y de los ajustes, nunca a mano */
            <div className="space-y-3">
              <DesgloseHolded
                espacioId={espacioId}
                resultado={resultado}
                holded={holded}
                puedeGestionar={puedeGestionar}
              />
              <div className="border-t border-line pt-2">
                <Neto
                  resultado={resultado}
                  neto={neto!}
                  porHora={porHora}
                  faltanHoras={faltanHoras}
                  llega={llega}
                  objetivoHora={objetivoHora}
                />
              </div>
            </div>
          ) : enlazando ? (
            <EnlazarHolded
              proyectoId={proyectoId}
              edicionId={edicion?.id ?? null}
              nombre={nombreCierre}
              holded={holded!}
              onCerrar={() => setEnlazando(false)}
            />
          ) : resultado ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Neto
                  resultado={resultado}
                  neto={neto!}
                  porHora={porHora}
                  faltanHoras={faltanHoras}
                  llega={llega}
                  objetivoHora={objetivoHora}
                />
                {puedeGestionar && (
                  <div className="flex shrink-0 gap-1.5">
                    {holded?.conectado && (
                      <button
                        type="button"
                        onClick={() => setEnlazando(true)}
                        className="btn h-8 text-xs"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Holded
                      </button>
                    )}
                    <button type="button" onClick={abrir} className="btn h-8 text-xs">
                      Cambiar
                    </button>
                  </div>
                )}
              </div>
              {holded?.conectado && puedeGestionar && (
                <p className="text-xs text-muted">
                  Apuntado a mano. Enlázalo con Holded y las cifras llegarán solas.
                </p>
              )}
            </div>
          ) : (
            puedeGestionar &&
            (holded?.conectado ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEnlazando(true)}
                  className="btn btn-primary h-8 flex-1 text-xs"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Enlazar con Holded
                </button>
                <button type="button" onClick={abrir} className="btn h-8 text-xs">
                  Apuntar a mano
                </button>
              </div>
            ) : (
              <button type="button" onClick={abrir} className="btn h-8 w-full text-xs">
                <Euro className="h-3.5 w-3.5" />
                Apuntar el resultado
              </button>
            ))
          )}
        </div>
      )}
    </article>
  )
}

/** Ingresos − gastos = neto, y el €/h si hay horas para sacarlo. */
function Neto({
  resultado,
  neto,
  porHora,
  faltanHoras,
  llega,
  objetivoHora,
}: {
  resultado: Resultado
  neto: number
  porHora: number | null
  faltanHoras: boolean
  llega: boolean | null
  objetivoHora: number | null
}) {
  return (
    <div className="min-w-0">
      <p className="cifra text-sm">
        {formatMoney(Number(resultado.income))}
        <span className="text-muted">
          {" − "}
          {formatMoney(Number(resultado.expenses))} ={" "}
        </span>
        <span className={cn("font-semibold", neto < 0 && "text-danger")}>
          {formatMoney(neto)}
        </span>
      </p>
      {porHora === null && faltanHoras && (
        <p className="text-xs text-muted">faltan horas con el euro para sacar el €/h</p>
      )}
      {porHora !== null && (
        <p
          className={cn(
            "cifra text-lg font-semibold leading-tight",
            llega === null ? "" : llega ? "text-billable" : "text-danger",
          )}
          title={objetivoHora ? `Objetivo: ${objetivoHora} €/h` : undefined}
        >
          {porHora.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €/h
        </p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- horas sueltas */

/**
 * Las horas que no están en ninguna edición.
 *
 * No son una edición ni un cierre: son un cabo suelto. Nadie apunta el
 * resultado de «las horas sueltas», así que aquí no se pide dinero, se pide
 * repartirlas. Mientras estén así se quedan fuera de todos los cierres.
 */
function HorasSueltas({
  entradas,
  ediciones,
}: {
  entradas: EntradaVista[]
  ediciones: Edicion[]
}) {
  const router = useRouter()
  const { avisar } = useAvisos()
  const [destino, setDestino] = useState("")
  const [ocupado, setOcupado] = useState(false)

  const segundos = entradas.reduce((s, e) => s + (e.duration_seconds ?? 0), 0)

  async function mover() {
    if (!destino) return
    setOcupado(true)
    const ids = entradas.map((e) => e.id)
    const { data, error } = await createClient()
      .from("time_entries")
      .update({ edition_id: destino })
      .in("id", ids)
      .select("id")
    setOcupado(false)

    if (error) {
      avisar(mensajeError(error), undefined, "mal")
      return
    }
    const movidas = data?.length ?? 0
    if (movidas === 0) {
      avisar("No se ha podido mover ninguna hora.", undefined, "mal")
      return
    }
    /* Puede quedarse alguna fuera: las horas de otra persona no siempre se
       pueden tocar, y callarse eso seria peor que no moverlas. */
    avisar(
      movidas < ids.length
        ? `Se han movido ${movidas} de ${ids.length}: el resto son de otra persona.`
        : movidas === 1
          ? "Hora movida."
          : `${movidas} horas movidas.`,
    )
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radio)] border border-live-line bg-live-soft p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-live" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-live">
        <span className="cifra font-semibold">
          {formatDurationShort(segundos)}
        </span>{" "}
        en {entradas.length} {entradas.length === 1 ? "apunte" : "apuntes"} sin
        edición: no cuentan para el cierre de ninguna edición.
      </p>

      {ediciones.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <select
            className="field h-8 w-auto py-0 text-sm"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            aria-label="Edición a la que moverlas"
          >
            <option value="">Moverlas a…</option>
            {ediciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void mover()}
            disabled={ocupado || !destino}
            className="btn h-8 shrink-0"
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            Mover
          </button>
        </div>
      )}
    </div>
  )
}
