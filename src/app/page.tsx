import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  BarChart3,
  CalendarCheck,
  CalendarRange,
  Check,
  FileSpreadsheet,
  FolderTree,
  Layers,
  Timer,
  Upload,
  Users,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { RUTA_APP } from "@/lib/rutas"
import { AlEntrar } from "@/components/al-entrar"
import { BotonGoogle } from "@/components/boton-google"
import { EntrarDirecto } from "@/components/entrar-directo"
import { COOKIE_DIRECTO } from "@/lib/cookies"
import { CronometroDemo } from "@/components/cronometro-demo"

/**
 * La portada va siempre en claro -ver `.tema-claro` en globals.css-, así que
 * la barra del navegador en el móvil no puede seguir al tema del sistema.
 */
export const viewport = { themeColor: "#f5f5f7" }

export const metadata = {
  title: { absolute: "hitoo · Las horas del equipo, en su sitio" },
  description:
    "Control de horas para equipos LEINN: cronómetro, calendario, hoja semanal, proyectos e informes. Con la categorización de vuestro equipo y lo que ya tenéis en Clockify.",
}

/** La marca, en pequeño. */
function Marca() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG de marca, no necesita next/image
    <img src="/hitoo-logo.svg" alt="hitoo" className="h-7 w-auto" />
  )
}

/** Titulillo de sección: el mismo rótulo gris que se usa dentro de la app. */
function Seccion({
  rotulo,
  titulo,
  texto,
  centrado,
}: {
  rotulo: string
  titulo: string
  texto?: string
  centrado?: boolean
}) {
  return (
    <div className={centrado ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="rotulo">{rotulo}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
        {titulo}
      </h2>
      {texto && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{texto}</p>
      )}
    </div>
  )
}

/**
 * Una sección de las que van en dos columnas: el texto a un lado y un trozo de
 * la aplicación al otro, cambiando de lado cada vez. Una página entera de
 * bloques centrados uno debajo de otro se lee como un documento, no como un
 * producto.
 */
function Cara({
  rotulo,
  titulo,
  texto,
  puntos,
  maqueta,
  invertida,
  id,
}: {
  rotulo: string
  titulo: string
  texto: string
  puntos?: { titulo: string; texto: string }[]
  maqueta: React.ReactNode
  /** La maqueta a la izquierda y el texto a la derecha. */
  invertida?: boolean
  id?: string
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-t border-line py-14 lg:py-20"
    >
      <AlEntrar className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={invertida ? "lg:order-2" : undefined}>
          <p className="rotulo">{rotulo}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {titulo}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {texto}
          </p>

          {puntos && (
            <dl className="mt-6 space-y-4">
              {puntos.map(({ titulo: t, texto: x }) => (
                <div key={t}>
                  <dt className="text-[15px] font-semibold">{t}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {x}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className={invertida ? "lg:order-1" : undefined}>{maqueta}</div>
      </AlEntrar>
    </section>
  )
}

const CHIPS = [
  "En castellano",
  "Un espacio por equipo",
  "Trae tu histórico de Clockify",
  "Excel con columnas de verdad",
]

const PASOS = [
  {
    titulo: "Crea el espacio de tu equipo",
    texto:
      "Te preguntamos cuántos sois y de dónde venís, y con eso queda montado: la estructura típica de LEINN -Backoffice, Conocimiento y Proyectos- o en blanco, y los huecos de cada uno preparados.",
  },
  {
    titulo: "Invita a la gente",
    texto:
      "Un enlace y un código QR: lo enseñas en la reunión, cada uno entra y dice cuál es su nombre. Con su papel: quien apunta, quien gestiona y quien administra.",
  },
  {
    titulo: "Sube lo de Clockify",
    texto:
      "El CSV detallado entra con su proyecto, su tarea y sus etiquetas. Si lo vuelves a subir no se duplica nada.",
  },
]

const PARA_LEINN = [
  {
    icono: Users,
    titulo: "Un espacio por equipo",
    texto:
      "Cada equipo tiene el suyo, con sus proyectos, su gente y sus roles. Si estás en dos, cambias de espacio desde arriba sin salir de la cuenta.",
  },
  {
    icono: CalendarRange,
    titulo: "Horas que se comparten",
    texto:
      "Apuntas la reunión una vez y se la propones a quien estuvo. A cada uno le llega y decide si la acepta: nadie apunta horas en el calendario de otro.",
  },
  {
    icono: Upload,
    titulo: "Lo de Clockify se trae",
    texto:
      "Sin empezar de cero ni perder el año pasado. Cada rama del informe entra como área, y las horas se quedan donde estaban.",
  },
  {
    icono: BarChart3,
    titulo: "Objetivos, no solo horas",
    texto:
      "El equipo fija las horas de la semana y del día, y las de cada rama. En el cronómetro se ve lo que falta, no solo lo que llevas.",
  },
]

const PREGUNTAS = [
  {
    q: "¿Y todo lo que tenemos ya en Clockify?",
    a: "Se sube el CSV detallado y entra tal cual: proyecto, tarea, etiquetas, si se cobraba y quién lo apuntó. Se reconoce lo que ya está, así que puedes subirlo varias veces sin miedo a duplicar.",
  },
  {
    q: "Estoy en dos equipos, ¿tengo dos cuentas?",
    a: "No. Una cuenta y tantos espacios como equipos. Se cambia desde arriba a la izquierda y cada espacio tiene sus proyectos, su gente y sus horas, sin mezclarse.",
  },
  {
    q: "¿Quién ve mis horas?",
    a: "Tú ves las tuyas. Quien gestiona o administra el espacio ve las del equipo, porque le hacen falta para facturar y cerrar. No es una promesa: la base de datos lo impide fila a fila.",
  },
  {
    q: "Hemos tenido una reunión los cuatro, ¿la apuntamos cuatro veces?",
    a: "La apunta uno y elige a quién más le cuenta. A los demás les llega una propuesta que aceptan o rechazan, como la invitación de un calendario. Hasta que la aceptan no tienen nada apuntado.",
  },
  {
    q: "Hacemos el mismo evento cada año, ¿lo duplicamos?",
    a: "No hace falta. El proyecto es The Bilbao Coffee Experience y dentro tiene sus ediciones: TBCE 1, TBCE 2. Cada una con sus fechas, su presupuesto y sus horas, y el proyecto suma todas.",
  },
  {
    q: "¿Qué pasa si conecto mi Google Calendar?",
    a: "Solo se leen tus eventos para poder enseñártelos dentro y convertirlos en horas con un clic. hitoo no crea, cambia ni borra nada en tu calendario, y se desconecta desde los ajustes cuando quieras.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Nada. Lo hicimos para nuestro equipo porque lo necesitábamos, y lo abrimos al resto de LEINN.",
  },
]

/* ------------------------------------------------------------- maquetas
   Trozos de la propia aplicación, dibujados con los mismos tokens: se ve lo
   que hay, no un dibujo bonito de lo que podría haber. */

/** Los ratos de la semana de la portada: día, hora de inicio, cuánto y color. */
const SEMANA = [
  { dia: 0, desde: 9, dura: 2, que: "TLT", color: "#0a84ff" },
  { dia: 0, desde: 12, dura: 1.5, que: "TBCE 2", color: "#ff9500" },
  { dia: 1, desde: 8.5, dura: 1, que: "Care", color: "#34c759" },
  { dia: 1, desde: 10, dura: 3, que: "TBCE 2", color: "#ff9500" },
  { dia: 2, desde: 9, dura: 2.5, que: "BL 3", color: "#5856d6" },
  { dia: 2, desde: 13, dura: 1, que: "Care", color: "#34c759" },
  { dia: 3, desde: 8.5, dura: 2, que: "TBCE 2", color: "#ff9500" },
  { dia: 3, desde: 11.5, dura: 2, que: "TLT", color: "#0a84ff" },
  { dia: 4, desde: 9.5, dura: 1.5, que: "BL 3", color: "#5856d6" },
]

const DIAS = ["L", "M", "X", "J", "V"]
const DESDE = 8
const HASTA = 15

/**
 * La semana, como se ve dentro. Los ratos van apareciendo uno detrás de otro
 * al cargar -con `prefers-reduced-motion` salen ya puestos, que para eso la
 * hoja de estilos apaga las animaciones-.
 */
function MaquetaSemana() {
  const alto = (horas: number) => `${(horas / (HASTA - DESDE)) * 100}%`

  return (
    <div
      className="card overflow-hidden"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {/* La cabecera de la pantalla de la semana, como dentro */}
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
        <CalendarRange className="h-3.5 w-3.5 text-muted" aria-hidden />
        <p className="text-xs font-medium">16 - 20 de marzo</p>
        <p className="cifra ml-auto text-xs text-ink-soft">
          27:40 <span className="text-muted">/ 35:00</span>
        </p>
      </div>

      <div className="p-3">
        <div className="flex gap-1.5">
          {/* Las horas del lateral */}
          <div className="flex w-7 shrink-0 flex-col justify-between py-1 text-right">
            {Array.from({ length: HASTA - DESDE }, (_, i) => (
              <span key={i} className="cifra text-[10px] leading-none text-muted">
                {DESDE + i}
              </span>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-5 gap-1.5">
            {DIAS.map((dia, d) => (
              <div key={dia} className="min-w-0">
                <p className="mb-1 text-center text-[10px] font-medium text-muted">
                  {dia}
                </p>
                <div className="relative h-44 rounded-[var(--radio-sm)] bg-surface-2 sm:h-56">
                  {SEMANA.filter((r) => r.dia === d).map((rato, i) => (
                    <div
                      key={`${rato.que}-${i}`}
                      className="entra absolute inset-x-0.5 overflow-hidden rounded-[3px] px-1 py-0.5"
                      style={{
                        top: alto(rato.desde - DESDE),
                        height: alto(rato.dura),
                        background: `color-mix(in srgb, ${rato.color} 26%, transparent)`,
                        borderLeft: `2px solid ${rato.color}`,
                        animationDelay: `${0.15 + d * 0.09 + i * 0.05}s`,
                      }}
                    >
                      <span className="block truncate text-[10px] font-medium text-ink">
                        {rato.que}
                      </span>
                    </div>
                  ))}

                  {/* El de ahora mismo, latiendo como dentro de la app */}
                  {d === 4 && (
                    <div
                      className="entra absolute inset-x-0.5 overflow-hidden rounded-[3px] border-l-2 border-live-fill bg-live-soft px-1 py-0.5"
                      style={{
                        top: alto(11.5 - DESDE),
                        height: alto(1.25),
                        animationDelay: "0.75s",
                      }}
                    >
                      <span className="latido block truncate text-[10px] font-medium text-live">
                        Ahora
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lo que llevas de la semana, creciendo */}
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Objetivo de la semana</span>
            <span className="cifra font-medium">79%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="crece h-full rounded-full bg-accent"
              style={{ width: "79%" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Lo que deja un proyecto y lo que cuesta: la aguja del €/h, como dentro. */
function MaquetaDinero() {
  const r = 76
  const cx = 100
  const cy = 96
  const largo = Math.PI * r
  // 21 €/h contra un objetivo de 17: se ha pasado, y por eso va en verde
  const parte = 0.72

  return (
    <div className="card p-5" style={{ boxShadow: "var(--shadow-lg)" }}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className="w-[12rem] shrink-0">
          <svg viewBox="0 0 200 116" className="w-full" aria-hidden>
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              strokeWidth="13"
              strokeLinecap="round"
              className="stroke-surface-2"
            />
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              strokeWidth="13"
              strokeLinecap="round"
              stroke="var(--billable-fill)"
              className="dibuja"
              style={
                {
                  "--largo": largo,
                  "--hasta": largo * (1 - parte),
                } as React.CSSProperties
              }
            />
            <line
              x1={cx + Math.cos(Math.PI * (1 - 0.58)) * (r - 10)}
              y1={cy - Math.sin(Math.PI * (1 - 0.58)) * (r - 10)}
              x2={cx + Math.cos(Math.PI * (1 - 0.58)) * (r + 10)}
              y2={cy - Math.sin(Math.PI * (1 - 0.58)) * (r + 10)}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="stroke-ink"
            />
          </svg>
          <div className="-mt-11 text-center">
            <p className="cifra text-3xl font-semibold leading-none text-billable">
              21
              <span className="ml-0.5 text-base font-medium">€/h</span>
            </p>
            <p className="mt-2 text-xs text-muted">
              por encima de los 17 €/h
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Ingresos</span>
              <span className="cifra font-medium text-billable">3.400,00 €</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="crece h-full w-full rounded-full bg-billable-fill" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Gastos</span>
              <span className="cifra font-medium text-danger">− 620,00 €</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="crece h-full rounded-full bg-danger"
                style={{ width: "18%", animationDelay: "0.1s" }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line pt-3">
            <div>
              <p className="cifra text-xl font-semibold leading-none text-billable">
                2.780,00 €
              </p>
              <p className="mt-1 text-xs text-muted">queda después de gastos</p>
            </div>
            <div>
              <p className="cifra text-xl font-semibold leading-none">132:15</p>
              <p className="mt-1 text-xs text-muted">horas que se cobran</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Una reunión de Google esperando a que la aceptes, como en el calendario. */
function MaquetaGoogle() {
  return (
    <div className="card p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <p className="rotulo mb-3 flex items-center gap-1.5">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
        Miércoles
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-[var(--radio-sm)] border border-line bg-surface-2 p-3">
          <span
            aria-hidden
            className="h-8 w-[3px] shrink-0 rounded-full"
            style={{ background: "#5856d6" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">Sesión de conocimiento</p>
            <p className="truncate text-xs text-muted">BL 3 · Conocimiento</p>
          </div>
          <span className="cifra text-sm text-ink-soft">1:30</span>
        </div>

        {/* Sin rellenar y a rayas: la convención de una invitación */}
        <div className="flex items-center gap-3 rounded-[var(--radio-sm)] border border-dashed border-line-strong p-3">
          <CalendarCheck
            className="h-4 w-4 shrink-0 text-muted"
            strokeWidth={1.9}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-soft">
              Reunión con proveedores
            </p>
            <p className="truncate text-xs text-muted">De tu Google Calendar</p>
          </div>
          <span className="chip shrink-0">Aceptar</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Hasta que no la aceptas no suma en ningún total.
      </p>
    </div>
  )
}

function MaquetaArbol() {
  const arbol = [
    { nombre: "Backoffice", hijas: ["TLT", "Care team", "Financial team", "Legal team"] },
    { nombre: "Conocimiento", hijas: [] },
    { nombre: "Proyectos", hijas: ["Eventos", "Proyectos", "Oportunidades"] },
  ]

  return (
    <div className="card p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <p className="rotulo mb-2 flex items-center gap-1.5">
        <FolderTree className="h-3.5 w-3.5" aria-hidden />
        Categorización
      </p>
      <ul className="space-y-1.5">
        {arbol.map(({ nombre, hijas }) => (
          <li key={nombre} className="rounded-[var(--radio-sm)] bg-surface-2/60 p-2">
            <p className="text-sm font-medium">{nombre}</p>
            {hijas.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5 pl-3">
                {hijas.map((h) => (
                  <li key={h} className="chip">
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MaquetaEdiciones() {
  const ediciones = [
    { nombre: "TBCE 1", fechas: "sep 2025", horas: "82:15", presupuesto: "80 h" },
    { nombre: "TBCE 2", fechas: "mar 2026", horas: "46:30", presupuesto: "120 h" },
  ]

  return (
    <div className="card p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <p className="rotulo mb-1 flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" aria-hidden />
        The Bilbao Coffee Experience
      </p>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Edición</th>
            <th className="th">Fechas</th>
            <th className="th text-right">Horas</th>
            <th className="th text-right">Presupuesto</th>
          </tr>
        </thead>
        <tbody>
          {ediciones.map((e) => (
            <tr key={e.nombre} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-sm font-medium">{e.nombre}</td>
              <td className="py-2 pr-3 text-sm text-muted">{e.fechas}</td>
              <td className="cifra py-2 pr-3 text-right text-sm">{e.horas}</td>
              <td className="cifra py-2 text-right text-sm text-muted">
                {e.presupuesto}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MaquetaColumnas() {
  const columnas = [
    "Fecha",
    "Persona",
    "Área",
    "Categoría",
    "Proyecto",
    "Edición",
    "Tarea",
    "Horas",
    "Facturable",
    "Importe",
  ]

  return (
    <div className="card p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <p className="rotulo mb-2 flex items-center gap-1.5">
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        Lo que sale en el Excel
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {columnas.map((c) => (
          <li key={c} className="chip">
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Las horas son un número, las fechas son fechas y el importe es moneda.
        La tabla dinámica sale a la primera.
      </p>
    </div>
  )
}

export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ portada?: string }>
}) {
  // Con la sesión abierta la portada sigue siendo visible -sirve para
  // enseñársela a otro equipo- pero los botones llevan al espacio.
  const supabase = await createClient()
  const [{ data: { user } }, galletas, parametros] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
    searchParams,
  ])
  const dentro = Boolean(user)

  /* Quien lo haya pedido -la casilla de abajo- entra directo, y el salto lo
     da el servidor: así no se ve la portada un instante antes de irse. Con
     `?portada` se ve igualmente, que si no, quien la marca no puede volver a
     enseñarla ni desmarcarla. */
  const aPelo = parametros.portada !== undefined
  if (dentro && !aPelo && galletas.get(COOKIE_DIRECTO)?.value === "1") {
    redirect(RUTA_APP)
  }

  return (
    /* Siempre en claro, mire quien la mire y tenga lo que tenga puesto: es la
       cara de hitoo, no una pantalla más de la aplicación. */
    <div className="tema-claro flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5">
          <Marca />
          <nav className="hidden flex-1 items-center gap-5 text-sm text-ink-soft md:flex">
            <a href="#que-hace" className="transition hover:text-ink">
              Qué hace
            </a>
            <a href="#organizar" className="transition hover:text-ink">
              Cómo se organiza
            </a>
            <a href="#dinero" className="transition hover:text-ink">
              El dinero
            </a>
            <a href="#empezar" className="transition hover:text-ink">
              Cómo se empieza
            </a>
            <a href="#preguntas" className="transition hover:text-ink">
              Preguntas
            </a>
          </nav>
          {/* Con la sesión abierta, la barra solo tiene que hacer una cosa:
              devolverte adentro. Sin ella, entrar con Google es el camino
              corto -y el que usa casi todo el mundo-, así que va aquí mismo
              y no escondido detrás de /acceso. */}
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {dentro ? (
              <Link href={RUTA_APP} className="btn btn-ghost text-accent">
                Ir a mi espacio
              </Link>
            ) : (
              <>
                <Link href="/acceso" className="btn btn-ghost text-accent">
                  Entrar
                </Link>
                {/* En el móvil no cabe: ahí se entra desde /acceso */}
                <span className="hidden sm:block">
                  <BotonGoogle compacto texto="Entrar con Google" />
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- portada */}
      {/* A sangre y con un resplandor detrás: el negro plano de lado a lado
          hacía que todo pareciera una columna estrecha en medio de la nada. */}
      <div className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[34rem]"
          style={{
            background:
              "radial-gradient(70% 60% at 60% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
          }}
        />
        <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div>
            <p className="rotulo">hitoo · Para equipos LEINN</p>
            {/* Sin `br`: a este tamaño el salto a mano parte el titular en
                cuatro lineas en cuanto la columna se estrecha. */}
            <h1 className="mt-3 text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.035em] text-balance sm:text-[2.75rem] xl:text-[3.25rem]">
              Las horas del equipo, cada una en su sitio.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-soft sm:text-base">
              Backoffice, conocimiento y proyectos no se miden igual, pero acaban
              en la misma hoja. hitoo es el cronómetro, el calendario y los
              informes de tu equipo, en castellano y con vuestra manera de
              organizaros.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {dentro ? (
                <div>
                  <Link href={RUTA_APP} className="btn btn-primary">
                    Ir a mi espacio
                  </Link>
                  <EntrarDirecto />
                </div>
              ) : (
                <>
                  <Link href="/acceso?modo=registrarse" className="btn btn-primary">
                    Crear el espacio de mi equipo
                  </Link>
                  <Link href="/acceso" className="btn">
                    Ya tengo cuenta
                  </Link>
                </>
              )}
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
              {CHIPS.map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-xs text-muted">
                  <Check className="h-3.5 w-3.5 text-billable" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <MaquetaSemana />
        </section>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5">
        {/* -------------------------------------------------------- que hace */}
        <section
          id="que-hace"
          className="scroll-mt-16 border-t border-line py-14 first:border-t-0 lg:py-20"
        >
          <AlEntrar>
            <Seccion
              rotulo="Qué hace"
              titulo="Apuntar, revisar y cerrar la semana"
              texto="Tres pantallas para lo mismo, según cómo trabaje cada uno: el cronómetro para el día a día, el calendario para arrastrar el rato donde toca y la hoja semanal para rellenar a mano el viernes."
            />

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {[
                {
                  icono: Timer,
                  titulo: "Cronómetro",
                  texto:
                    "Play y a trabajar. Lo que empieces en el móvil sigue corriendo en el portátil, y no te deja parar sin decir en qué proyecto ha sido.",
                },
                {
                  icono: CalendarRange,
                  titulo: "Calendario y semana",
                  texto:
                    "Arrastras sobre el hueco y ya está apuntado; mueves el bloque si te confundiste. O escribes las horas en la tabla: acepta 2, 1:30, 90m o 1,5.",
                },
                {
                  icono: BarChart3,
                  titulo: "Informes",
                  texto:
                    "Filtras por persona, proyecto, área, etiqueta o fecha, ves el reparto y te lo llevas en Excel, CSV o PDF. O todo el histórico de un botón.",
                },
              ].map(({ icono: Icono, titulo, texto }) => (
                <div key={titulo}>
                  <Icono className="h-5 w-5 text-ink-soft" strokeWidth={1.9} aria-hidden />
                  <h3 className="mt-3 text-[15px] font-semibold">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{texto}</p>
                </div>
              ))}
            </div>
          </AlEntrar>
        </section>

        {/* -------------------------------------------------------- apuntar */}
        <Cara
          rotulo="El día a día"
          titulo="Se apunta mientras se trabaja"
          texto="El cronómetro es la pantalla de siempre: lo que corre, lo que llevas hoy y lo que falta para el objetivo. Sin abrir nada más ni acordarse el viernes de lo que se hizo el martes."
          puntos={[
            {
              titulo: "Sigue de un sitio a otro",
              texto:
                "Empiezas en el móvil y sigue corriendo en el portátil. Es el mismo cronómetro, no dos.",
            },
            {
              titulo: "No se para en el aire",
              texto:
                "Al parar te pide el proyecto, y la descripción si el equipo lo exige. Lo de «reunión» a secas se acaba ahí.",
            },
          ]}
          maqueta={<CronometroDemo />}
        />

        {/* ------------------------------------------------------ organizar */}
        <Cara
          id="organizar"
          invertida
          rotulo="Cómo se organiza"
          titulo="Vuestra estructura, no la de una herramienta"
          texto="En LEINN el tiempo se reparte entre backoffice, conocimiento y empresa, y dentro por equipos y por tipo de trabajo. Aquí eso es de primera clase, y no un campo apañado para poder filtrar."
          puntos={[
            {
              titulo: "Dos niveles, y para",
              texto:
                "Área y categoría. Suficiente para Backoffice · TLT y para Proyectos · Eventos, y poco suficiente para que nadie se monte un laberinto.",
            },
            {
              titulo: "Etiqueta de filtro, no carpeta",
              texto:
                "El proyecto cuelga de una rama, pero sigue siendo del espacio: se mira por área, por categoría o por persona sin mover nada de sitio.",
            },
            {
              titulo: "Una columna por nivel",
              texto:
                "En el Excel salen Área y Categoría como columnas aparte. Ahí acaba el copiar y pegar de los cierres.",
            },
          ]}
          maqueta={<MaquetaArbol />}
        />

        {/* --------------------------------------------------------- dinero */}
        <Cara
          id="dinero"
          rotulo="El dinero"
          titulo="La pregunta no es cuántas horas: es a cuánto sale la hora"
          texto="Cada proyecto lleva lo que ha dejado y lo que ha costado en horas, y de ahí sale la facturación por hora contra la que aspira el equipo. Con menos de una hora marcada no se enseña la cifra: mil euros entre dieciocho segundos no es un dato, es una división."
          puntos={[
            {
              titulo: "Por edición, no por año",
              texto:
                "Cada edición se cierra con sus ingresos y sus gastos, y se compara con la anterior del mismo evento.",
            },
            {
              titulo: "Lo que falta por cerrar",
              texto:
                "Las horas que se cobran y todavía no cuenta ningún cierre salen aparte, para que el €/h no se quede corto sin que nadie se entere.",
            },
          ]}
          maqueta={<MaquetaDinero />}
        />

        {/* ------------------------------------------------------- ediciones */}
        <Cara
          invertida
          rotulo="Lo que se repite"
          titulo="El mismo evento cada año, sin duplicar el proyecto"
          texto="TBCE 1 y TBCE 2 no son dos proyectos: son dos ediciones del mismo. Cada una con sus fechas, su presupuesto y sus horas; el proyecto suma todas y se pueden comparar entre sí. Las tareas quedan libres para lo que son."
          maqueta={<MaquetaEdiciones />}
        />

        {/* --------------------------------------------------------- google */}
        <Cara
          rotulo="Google Calendar"
          titulo="Las reuniones que ya tienes, sin volver a escribirlas"
          texto="Si conectas tu Google Calendar, las reuniones que aceptaste aparecen en la rejilla como una invitación y las conviertes en horas con un clic. Es opcional y va por persona: quien no lo use, ni se entera."
          puntos={[
            {
              titulo: "Solo lectura",
              texto:
                "hitoo pide permiso para leer tus eventos y nada más: no crea, no cambia ni borra nada en tu calendario.",
            },
            {
              titulo: "Se corta cuando quieras",
              texto:
                "Desde los ajustes se desconecta, y el permiso se retira también en tu cuenta de Google en ese momento.",
            },
            {
              titulo: "No sale del servidor",
              texto:
                "La llave para leer el calendario se guarda cifrada y nunca llega al navegador.",
            },
          ]}
          maqueta={<MaquetaGoogle />}
        />

        {/* -------------------------------------------------------- informes */}
        <Cara
          invertida
          rotulo="Cerrar"
          titulo="El Excel que de verdad usáis después"
          texto="Lo que se cobra va marcado en verde y con su importe según la tarifa de cada persona o proyecto. Y la descarga no es una captura: son columnas con tipo."
          maqueta={<MaquetaColumnas />}
        />

        {/* --------------------------------------------------------- empezar */}
        <section id="empezar" className="scroll-mt-16 border-t border-line py-14 lg:py-20">
          <AlEntrar>
            <Seccion rotulo="Cómo se empieza" titulo="Tres pasos y a apuntar" />

            <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {PASOS.map(({ titulo, texto }, i) => (
                <li key={titulo} className="border-t border-line pt-4">
                  <span className="cifra text-sm font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-1 text-[15px] font-semibold">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{texto}</p>
                </li>
              ))}
            </ol>
          </AlEntrar>
        </section>

        {/* ------------------------------------------------------ para LEINN */}
        <section className="border-t border-line py-14 lg:py-20">
          <AlEntrar>
            <Seccion
              rotulo="Por qué no es otro Clockify"
              titulo="Está hecho desde dentro de un equipo"
            />

            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
              {PARA_LEINN.map(({ icono: Icono, titulo, texto }) => (
                <div key={titulo} className="flex gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radio-sm)] bg-surface-2 text-ink-soft">
                    <Icono className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold">{titulo}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AlEntrar>
        </section>

        {/* ------------------------------------------------------- preguntas */}
        <section id="preguntas" className="scroll-mt-16 border-t border-line py-14 lg:py-20">
          <AlEntrar className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
            <Seccion rotulo="Preguntas" titulo="Lo que pregunta todo el mundo" />

            <div className="divide-y divide-line border-y border-line">
              {PREGUNTAS.map(({ q, a }) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium marker:content-none">
                    {q}
                    <span
                      aria-hidden
                      className="shrink-0 text-muted transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </AlEntrar>
        </section>
      </main>

      {/* -------------------------------------------------------------- cta */}
      <div className="relative overflow-hidden border-t border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[22rem]"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 100%, color-mix(in srgb, var(--accent) 15%, transparent), transparent 70%)",
          }}
        />
        <section className="relative mx-auto w-full max-w-6xl px-5 py-16 text-center lg:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {dentro
              ? "Sigue donde lo dejaste"
              : "Empieza por las horas de esta semana"}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            {dentro
              ? "Tu espacio te espera con el cronómetro parado y la semana a medias."
              : "Creas el espacio del equipo, invitas a la gente y en cinco minutos está apuntando. Lo de antes lo subes cuando quieras."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={dentro ? RUTA_APP : "/acceso?modo=registrarse"}
              className="btn btn-primary"
            >
              {dentro ? "Ir a mi espacio" : "Crear el espacio de mi equipo"}
            </Link>
            {!dentro && (
              <Link href="/acceso" className="btn">
                Entrar
              </Link>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-[-0.02em] text-ink">hitoo</span>
            <span aria-hidden>·</span>
            <span>Hecho por un equipo LEINN, para los equipos LEINN.</span>
          </div>
          <nav className="flex items-center gap-4">
            <a href="#que-hace" className="transition hover:text-ink">
              Qué hace
            </a>
            <a href="#preguntas" className="transition hover:text-ink">
              Preguntas
            </a>
            <Link href="/privacidad" className="transition hover:text-ink">
              Privacidad
            </Link>
            <Link
              href={dentro ? RUTA_APP : "/acceso"}
              className="transition hover:text-ink"
            >
              {dentro ? "Mi espacio" : "Entrar"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
