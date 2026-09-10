"use client"

import { useSyncExternalStore } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"

import { formatDurationShort, formatObjetivoCorto } from "@/lib/time"
import { cn } from "@/lib/utils"

/**
 * Los tres numeros de arriba del cronometro. Cada uno elige los suyos: es la
 * pantalla que mas se mira y no todo el mundo mira lo mismo. La eleccion vive
 * en el navegador, que es donde vive el gusto de cada uno.
 */
export type Cifras = {
  hoy: number
  semana: number
  facturableSemana: number
  /** En cuantos proyectos distintos cayeron esas horas facturables. */
  proyectosFacturables: number
  mes: number
  diasConHoras: number
  objetivoDia: number | null
  objetivoSemana: number | null
}

type Clave =
  | "hoy"
  | "semana"
  | "facturable"
  | "mes"
  | "restante-dia"
  | "restante-semana"
  | "media"

const DATOS: { clave: Clave; etiqueta: string }[] = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "semana", etiqueta: "Esta semana" },
  { clave: "facturable", etiqueta: "Facturable" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "restante-dia", etiqueta: "Falta hoy" },
  { clave: "restante-semana", etiqueta: "Falta esta semana" },
  { clave: "media", etiqueta: "Media por día" },
]

const POR_DEFECTO: Clave[] = ["hoy", "semana", "facturable"]

function almacen(espacioId: string) {
  return "resumen:" + espacioId
}

function valor(clave: Clave, c: Cifras): { valor: string; pie?: string; verde?: boolean } {
  switch (clave) {
    case "hoy":
      return {
        valor: formatDurationShort(c.hoy),
        pie: c.objetivoDia ? "de " + formatObjetivoCorto(c.objetivoDia) : undefined,
      }
    case "semana":
      return {
        valor: formatDurationShort(c.semana),
        pie: c.objetivoSemana
          ? "de " + formatObjetivoCorto(c.objetivoSemana)
          : undefined,
      }
    case "facturable":
      return {
        valor: formatDurationShort(c.facturableSemana),
        verde: c.facturableSemana > 0,
        pie:
          c.proyectosFacturables === 0
            ? undefined
            : c.proyectosFacturables === 1
              ? "en 1 proyecto"
              : "en " + c.proyectosFacturables + " proyectos",
      }
    case "mes":
      return { valor: formatDurationShort(c.mes) }
    case "restante-dia": {
      if (!c.objetivoDia) return { valor: "—", pie: "sin objetivo" }
      const falta = c.objetivoDia * 60 - c.hoy
      return falta > 0
        ? { valor: formatDurationShort(falta), pie: "para las " + formatObjetivoCorto(c.objetivoDia) }
        : { valor: "Hecho", verde: true, pie: "objetivo del día" }
    }
    case "restante-semana": {
      if (!c.objetivoSemana) return { valor: "—", pie: "sin objetivo" }
      const falta = c.objetivoSemana * 60 - c.semana
      return falta > 0
        ? {
            valor: formatDurationShort(falta),
            pie: "para las " + formatObjetivoCorto(c.objetivoSemana),
          }
        : { valor: "Hecho", verde: true, pie: "objetivo de la semana" }
    }
    case "media":
      return {
        valor: formatDurationShort(
          c.diasConHoras > 0 ? Math.round(c.semana / c.diasConHoras) : 0,
        ),
        pie: c.diasConHoras === 1 ? "1 día con horas" : c.diasConHoras + " días con horas",
      }
  }
}

/* La eleccion vive en el navegador. Se lee con useSyncExternalStore para que
   el servidor pinte los tres de siempre y el navegador cambie a los tuyos sin
   pelearse con la hidratacion. */

const oyentes = new Set<() => void>()

function avisar() {
  for (const oyente of oyentes) oyente()
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  window.addEventListener("storage", oyente)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener("storage", oyente)
  }
}

/* getSnapshot tiene que devolver siempre el mismo objeto mientras no cambie
   nada, o React se queda dando vueltas. Por eso se guarda lo ya leido. */
let ultimoBruto: string | null = null
let ultimaLista: Clave[] = POR_DEFECTO

function leer(espacioId: string): Clave[] {
  let bruto: string | null = null
  try {
    bruto = localStorage.getItem(almacen(espacioId))
  } catch {
    return POR_DEFECTO
  }
  if (bruto === ultimoBruto) return ultimaLista
  ultimoBruto = bruto
  try {
    const lista = bruto ? (JSON.parse(bruto) as Clave[]) : null
    ultimaLista =
      Array.isArray(lista) && lista.length === 3 ? lista : POR_DEFECTO
  } catch {
    // un ajuste roto no puede tumbar la pantalla
    ultimaLista = POR_DEFECTO
  }
  return ultimaLista
}

export function ResumenCronometro({
  espacioId,
  cifras,
}: {
  espacioId: string
  cifras: Cifras
}) {
  const elegidos = useSyncExternalStore(
    suscribir,
    () => leer(espacioId),
    () => POR_DEFECTO,
  )

  function cambiar(hueco: number, clave: Clave) {
    const lista = [...elegidos]
    lista[hueco] = clave
    try {
      localStorage.setItem(almacen(espacioId), JSON.stringify(lista))
    } catch {
      // navegar en privado tampoco puede tumbar nada
    }
    avisar()
  }

  return (
    /* Tres columnas en un movil son tres columnas rotas: ahi van una debajo de
       otra, con la cifra a la derecha. */
    <div className="card grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {elegidos.map((clave, hueco) => {
        const dato = valor(clave, cifras)
        const etiqueta =
          DATOS.find((d) => d.clave === clave)?.etiqueta ?? "Dato"
        return (
          <div
            key={hueco}
            className="flex items-center justify-between gap-3 px-4 py-3 sm:block"
          >
            <div className="min-w-0">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="rotulo group flex items-center gap-1 transition hover:text-ink">
                {etiqueta}
                <ChevronDown className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={4}
                  className="z-50 w-52 overflow-hidden rounded-[var(--radio)] border border-line bg-surface p-1"
                  style={{ boxShadow: "var(--shadow-lg)" }}
                >
                  {DATOS.map((d) => (
                    <DropdownMenu.Item
                      key={d.clave}
                      onSelect={() => cambiar(hueco, d.clave)}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none data-highlighted:bg-surface-2"
                    >
                      <span className="flex-1">{d.etiqueta}</span>
                      {d.clave === clave && (
                        <Check className="h-3.5 w-3.5 text-accent" />
                      )}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {/* En movil el pie va pegado al rotulo, que la cifra se va a la
                derecha; en pantalla grande, debajo de la cifra como siempre */}
            <p className="mt-0.5 text-xs text-muted sm:hidden">{dato.pie}</p>
            </div>

            <p
              className={cn(
                "cifra shrink-0 text-2xl font-semibold leading-none tracking-tight sm:mt-1",
                dato.verde && "text-billable",
              )}
            >
              {dato.valor}
            </p>
            <p className="mt-1.5 hidden h-4 text-xs text-muted sm:block">
              {dato.pie}
            </p>
          </div>
        )
      })}
    </div>
  )
}
