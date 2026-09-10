"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import {
  BarChart3,
  Boxes,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Euro,
  FolderKanban,
  Layers,
  LogOut,
  Plus,
  Settings2,
  Square,
  Timer,
  TrendingUp,
  Upload,
  User,
  Users,
} from "lucide-react"

import CargandoCronometro from "@/app/(app)/panel/loading"
import { useAvisos } from "@/components/avisos"
import { useCambioEspacio, type CambioEspacio } from "@/components/cambio-espacio"
import { useSesion } from "@/components/proveedor-sesion"
import { useCronometro } from "@/components/proveedor-cronometro"
import { SelectorTema } from "@/components/selector-tema"
import { BarraTeclado } from "@/components/barra-teclado"
import { COOKIE_MENU_PLEGADO } from "@/lib/cookies"
import { formatDuration } from "@/lib/time"
import { NOMBRE_ROL } from "@/lib/roles"
import { RUTA_APP } from "@/lib/rutas"
import { cn } from "@/lib/utils"

/**
 * Agrupado por lo que se va a hacer, no por lo que es cada pantalla: primero se
 * apuntan las horas, luego se miran, y de vez en cuando se configura algo.
 */
type Enlace = {
  href: string
  etiqueta: string
  icono: typeof Timer
  exacto?: boolean
  soloAdmin?: boolean
}

/**
 * Las rutas van sin tildes -son URLs y carpetas- y los rotulos con ellas.
 * No confundirlos: un href acentuado da 404.
 */

const GRUPOS: {
  titulo: string
  soloGestores?: boolean
  enlaces: Enlace[]
}[] = [
  {
    titulo: "Apuntar",
    enlaces: [
      { href: RUTA_APP, etiqueta: "Cronómetro", icono: Timer, exacto: true },
      { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays },
      { href: "/semana", etiqueta: "Semana", icono: CalendarRange },
    ],
  },
  {
    titulo: "Revisar",
    enlaces: [
      { href: "/proyectos", etiqueta: "Proyectos", icono: FolderKanban },
      { href: "/informes", etiqueta: "Informes", icono: BarChart3 },
      { href: "/estadisticas", etiqueta: "Estadísticas", icono: TrendingUp },
    ],
  },
  {
    titulo: "Ajustar",
    soloGestores: true,
    enlaces: [
      { href: "/gestion/categorias", etiqueta: "Categorización", icono: Layers },
      { href: "/gestion", etiqueta: "Catálogo", icono: Boxes, exacto: true },
      { href: "/gestion/equipo", etiqueta: "Equipo", icono: Users },
      {
        href: "/gestion/tarifas",
        etiqueta: "Tarifas",
        icono: Euro,
        soloAdmin: true,
      },
      { href: "/gestion/importar", etiqueta: "Importar", icono: Upload },
    ],
  },
]

function useGrupos() {
  const { rol } = useSesion()
  const puedeGestionar = rol === "admin" || rol === "manager"
  return GRUPOS.filter((g) => !g.soloGestores || puedeGestionar).map((g) => ({
    ...g,
    enlaces: g.enlaces.filter((e) => !e.soloAdmin || rol === "admin"),
  }))
}

/**
 * En movil caben cinco y no mas: las tres de apuntar, proyectos e informes.
 * Estadisticas y gestion viven en el menu de arriba a la derecha.
 */
const EN_MOVIL = ["/calendario", "/semana", "/proyectos", "/informes"]

function useEnlacesMovil(): Enlace[] {
  return GRUPOS.flatMap((g) => g.enlaces).filter(
    (e) => e.href === RUTA_APP || EN_MOVIL.includes(e.href),
  )
}

function estaActivo(pathname: string, href: string, exacto?: boolean) {
  return exacto ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/* ----------------------------------------------------------- menú plegado */

/**
 * Plegar la barra lateral se recuerda en una cookie y no en localStorage: así
 * el servidor ya la pinta como se dejó y no se ve ancha un instante al cargar.
 *
 * Se lee con useSyncExternalStore, igual que «Llévame directo»: en el servidor
 * y al hidratar vale lo que leyó el layout, y en cualquier otro montaje se lee
 * la cookie misma, que es la que manda. El armazón se remonta entero al
 * cambiar de espacio (por el key de ProveedorCronometro) y así no lo nota.
 */
const oyentesMenu = new Set<() => void>()

function suscribirMenu(avisar: () => void) {
  oyentesMenu.add(avisar)
  return () => {
    oyentesMenu.delete(avisar)
  }
}

function leerMenuPlegado() {
  return document.cookie
    .split("; ")
    .some((trozo) => trozo === `${COOKIE_MENU_PLEGADO}=1`)
}

function useMenuPlegado(inicial: boolean) {
  const plegado = useSyncExternalStore(suscribirMenu, leerMenuPlegado, () => inicial)

  function plegar(nuevo: boolean) {
    /* Desplegada es lo normal: en vez de guardar un «no», se borra */
    document.cookie = nuevo
      ? `${COOKIE_MENU_PLEGADO}=1; path=/; max-age=31536000; samesite=lax`
      : `${COOKIE_MENU_PLEGADO}=; path=/; max-age=0; samesite=lax`
    for (const avisar of oyentesMenu) avisar()
  }

  return [plegado, plegar] as const
}

export function Armazon({
  plegadoInicial,
  children,
}: {
  /** Lo que dice la cookie del menú plegado, leída en el servidor. */
  plegadoInicial: boolean
  children: React.ReactNode
}) {
  const grupos = useGrupos()
  const pathname = usePathname()
  const { avisar } = useAvisos()
  const [plegado, plegar] = useMenuPlegado(plegadoInicial)
  /* Aqui y no en cada selector: hay dos -barra lateral y cabecera del movil- y
     los dos, y tambien el contenido, tienen que enterarse del mismo cambio */
  const cambio = useCambioEspacio(() =>
    avisar("No se ha podido cambiar de espacio. Prueba otra vez.", undefined, "mal"),
  )

  return (
    <div className="flex min-h-dvh">
      {/* ------------------------------------------------ barra lateral */}
      {/* Lo que cambia de ancho, con su transición, es el <aside>; lo de dentro
          toma el ancho final en el mismo clic y el aside lo va recortando. Al
          desplegar, la barra destapa los rótulos ya en su sitio en vez de
          apretarlos y cortarlos con puntos suspensivos, y al plegar los iconos
          no viajan por la columna. Cada fila mide lo mismo en los dos estados,
          para que tampoco salten en vertical. */}
      <aside
        className={cn(
          "no-print sticky top-0 z-20 hidden h-dvh shrink-0 border-r border-line bg-surface-2/60 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block",
          plegado ? "w-16" : "w-60",
        )}
      >
        <div className="h-full overflow-hidden">
          <div className={cn("flex h-full flex-col", plegado ? "w-16" : "w-60")}>
            {/* Alto fijo: desplegado, el selector lleva dos líneas de texto y
                plegado solo el cuadrado; sin él, todo lo de debajo subía un
                poco al plegar */}
            <div className="flex h-16 items-center p-2">
              <SelectorEspacio cambio={cambio} plegado={plegado} />
            </div>

            {/* Plegada, una barra de scroll de las de siempre -la de Windows-
                se come un cuarto de la columna y descentra los iconos. La
                rueda y el teclado siguen bajando igual. */}
            <nav
              className={cn(
                "flex-1 space-y-4 overflow-y-auto p-2 pt-3",
                plegado && "[scrollbar-width:none]",
              )}
            >
              {grupos.map((grupo, i) => (
                <div key={grupo.titulo}>
                  {/* Plegada, el rótulo no se quita: se vuelve transparente y
                      sigue ocupando su alto, para que los iconos no suban.
                      Entre un grupo y otro, en su lugar, una raya a media
                      distancia de los dos. */}
                  <p
                    aria-hidden={plegado || undefined}
                    className={cn(
                      "rotulo relative truncate px-3 pb-1",
                      plegado && "text-transparent",
                    )}
                  >
                    {grupo.titulo}
                    {plegado && i > 0 && (
                      <span className="absolute inset-x-3 top-0.5 h-px bg-line" />
                    )}
                  </p>
                  <ul className="space-y-0.5">
                    {grupo.enlaces.map(({ href, etiqueta, icono: Icono, exacto }) => {
                      const activo = estaActivo(pathname, href, exacto)
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={activo ? "page" : undefined}
                            aria-label={plegado ? etiqueta : undefined}
                            title={plegado ? etiqueta : undefined}
                            className={cn(
                              "relative flex h-9 items-center gap-2.5 rounded-[var(--radio-sm)] text-sm font-medium transition",
                              plegado ? "justify-center" : "pl-3 pr-2",
                              activo
                                ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]"
                                : "text-ink-soft hover:bg-surface-3/60",
                            )}
                          >
                            <Icono
                              className={cn(
                                "h-[18px] w-[18px] shrink-0",
                                activo && "text-accent",
                              )}
                              strokeWidth={1.9}
                            />
                            {!plegado && etiqueta}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="space-y-2 p-2">
              <CronometroLateral plegado={plegado} />
              <MenuUsuario plegado={plegado} />
            </div>
          </div>
        </div>

        {/* La pestaña del borde, siempre a la vista: la flecha apunta hacia
            donde se va a mover la barra. Va fuera del recorte para poder
            asomar sobre el contenido, y a media altura de la pantalla, que la
            barra ocupa entera. */}
        <button
          type="button"
          onClick={() => plegar(!plegado)}
          aria-expanded={!plegado}
          aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
          title={plegado ? "Desplegar el menú" : "Plegar el menú"}
          className="btn absolute right-0 top-1/2 h-6 w-6 translate-x-1/2 -translate-y-1/2 rounded-full p-0 text-ink-soft"
        >
          {plegado ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* ------------------------------------------------------ contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-4 backdrop-blur lg:hidden">
          <SelectorEspacio cambio={cambio} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <CronometroPastilla />
            <MenuUsuario />
          </div>
        </header>

        {/* `min-w-0`: sin esto, una tabla ancha estira toda la pagina y el movil
            se va de lado en vez de dejar que la tabla ruede por dentro */}
        <main
          aria-busy={cambio.cambiando}
          className="mx-auto w-full min-w-0 max-w-[90rem] flex-1 px-4 py-5 pb-24 lg:px-8 lg:py-7 lg:pb-7"
        >
          {/* Cambiar de espacio siempre acaba en el cronometro, asi que mientras
              llega se ve ya su esqueleto. La pagina de antes se esconde y no se
              desmonta: si el cambio falla, vuelve tal cual estaba, con lo que
              hubiera a medio escribir. `contents` para que el envoltorio no
              cambie la maquetacion de lo de dentro. */}
          {cambio.cambiando && <CargandoCronometro />}
          <div className={cambio.cambiando ? "hidden" : "contents"}>{children}</div>
        </main>

        <BarraInferior />
        <BarraTeclado />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- espacios */

function SelectorEspacio({
  cambio,
  plegado = false,
}: {
  cambio: CambioEspacio
  /** En la barra lateral plegada: solo el cuadrado de las iniciales. */
  plegado?: boolean
}) {
  const { espacio: activo, espacios } = useSesion()
  /* El de la sesion no cambia hasta que vuelve el servidor: mientras tanto se
     enseña el elegido, que es lo que se acaba de pedir */
  const espacio =
    espacios.find((p) => p.espacio.id === cambio.elegido)?.espacio ?? activo

  /* Radix cierra -y desmonta- el menu en cuanto se elige un item, y lo hace
     dentro del propio click, antes de que el navegador llegue a enviar nada:
     un <form> con boton de submit aqui dentro no sale nunca, porque para
     cuando le toca el turno ya no esta en la pagina. Es el mismo motivo por el
     que "Cerrar sesion" se dispara aparte. Asi que la accion se llama a mano
     desde onSelect, que si corre antes del cierre.

     Se compara con el que se enseña y no con el de la sesion: si se elige
     otro y, antes de que llegue, se vuelve al de antes, eso tambien es un
     cambio que hay que pedir. */
  function elegir(id: string) {
    if (id === espacio.id) return
    cambio.cambiar(id)
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={plegado ? `Espacio: ${espacio.name}` : undefined}
        title={plegado ? espacio.name : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[var(--radio-sm)] p-1.5 text-left transition hover:bg-surface-3/60",
          plegado && "justify-center",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radio-sm)] bg-accent text-[13px] font-semibold text-[color:var(--accent-fg)]">
          {espacio.name.slice(0, 2).toUpperCase()}
        </span>
        {!plegado && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold tracking-tight">
                {espacio.name}
              </span>
              <span className="block truncate text-xs leading-tight text-muted">Espacio</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          </>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        {/* Con la barra plegada, el menú sale hacia el contenido, al lado del
            cuadrado, en vez de caer encima de la columna de iconos */}
        <DropdownMenu.Content
          side={plegado ? "right" : "bottom"}
          align="start"
          sideOffset={6}
          className="z-50 w-64 overflow-hidden rounded-[var(--radio)] border border-line bg-surface p-1"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <p className="rotulo px-2 py-1.5">Espacios de trabajo</p>
          {espacios.map(({ espacio: e, rol }) => (
            <DropdownMenu.Item
              key={e.id}
              onSelect={() => elegir(e.id)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-left text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="rotulo block leading-tight">{NOMBRE_ROL[rol]}</span>
              </span>
              {e.id === espacio.id && (
                <Check className="h-4 w-4 shrink-0 text-accent" />
              )}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link
              href="/bienvenida"
              className="flex items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
            >
              <Plus className="h-4 w-4" />
              Crear o unirse a otro
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/* -------------------------------------------------------------- cronómetro */

/**
 * Titulo de la pestaña: la cuenta corre aunque la ventana este de fondo. Va el
 * proyecto y no la descripcion, que entre pestañas se busca en que se trabaja.
 */
function useTituloCronometro() {
  const { enMarcha, segundos } = useCronometro()

  /* Sin nada en marcha no se toca: se queda el de la pagina, que pone Next
     ("Calendario · hitoo"). Al parar, o al remontarse con otro espacio, se
     devuelve el que habia, pero solo si sigue el nuestro: al navegar, Next
     pone el de la pagina nueva y ese manda. */
  useEffect(() => {
    if (!enMarcha) return
    const dePagina = document.title
    const etiqueta = enMarcha.proyecto?.name || enMarcha.description || "En marcha"
    const titulo = `${formatDuration(segundos)} · ${etiqueta}`
    document.title = titulo
    return () => {
      if (document.title === titulo) document.title = dePagina
    }
  }, [enMarcha, segundos])
}

/**
 * En escritorio el cronómetro vive abajo del todo, siempre a la vista... menos
 * en la propia pantalla del cronómetro, donde la tarjeta de arriba ya es él:
 * verlo dos veces en la misma pantalla solo confunde.
 */
function CronometroLateral({ plegado }: { plegado: boolean }) {
  const { enMarcha, segundos, parar, cargando } = useCronometro()
  const pathname = usePathname()
  useTituloCronometro()

  if (!enMarcha || pathname === RUTA_APP) return null

  const que = enMarcha.description || enMarcha.proyecto?.name || "Sin descripción"
  const botonParar = (
    <button
      type="button"
      onClick={() => void parar()}
      disabled={cargando}
      aria-label="Parar el cronómetro"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radio-sm)] bg-live-fill text-white transition hover:brightness-110 disabled:opacity-50"
    >
      <Square className="h-3 w-3 fill-current" />
    </button>
  )

  /* Plegada la barra, lo que se está haciendo no cabe: se quedan el tiempo,
     que se sigue viendo correr, y el botón de parar, uno encima del otro. La
     descripción va en el title, de más. A 11 px para que h:mm:ss quepa entero
     en la columna. */
  if (plegado) {
    return (
      <div
        title={que}
        className="flex flex-col items-center gap-1.5 rounded-[var(--radio-sm)] border border-live-line bg-live-soft py-2"
      >
        <span aria-hidden className="latido h-[3px] w-6 rounded-full bg-live-fill" />
        <p className="cifra text-[11px] font-semibold leading-none text-live">
          {formatDuration(segundos)}
        </p>
        {botonParar}
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radio-sm)] border border-live-line bg-live-soft p-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className="latido h-8 w-[3px] shrink-0 rounded-full bg-live-fill" />
        <div className="min-w-0 flex-1">
          <p className="cifra text-lg font-semibold leading-none text-live">
            {formatDuration(segundos)}
          </p>
          <p className="mt-1 truncate text-xs text-ink-soft">{que}</p>
        </div>
        {botonParar}
      </div>
    </div>
  )
}

/** En movil, una pastilla en la cabecera. Misma regla: en el cronómetro, no. */
function CronometroPastilla() {
  const { enMarcha, segundos, parar, cargando } = useCronometro()
  const pathname = usePathname()
  useTituloCronometro()

  if (!enMarcha || pathname === RUTA_APP) return null

  return (
    <div className="flex items-center gap-1.5 rounded-[var(--radio-sm)] border border-live-line bg-live-soft py-1 pl-2 pr-1">
      <span aria-hidden className="latido h-4 w-[3px] rounded-full bg-live-fill" />
      <span className="cifra text-sm font-semibold text-live">
        {formatDuration(segundos)}
      </span>
      <button
        type="button"
        onClick={() => void parar()}
        disabled={cargando}
        aria-label="Parar el cronómetro"
        className="rounded p-1 text-live transition hover:bg-live/15 disabled:opacity-50"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ movil */

function BarraInferior() {
  const enlaces = useEnlacesMovil()
  const pathname = usePathname()

  return (
    <nav className="no-print no-teclado fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {enlaces.map(({ href, etiqueta, icono: Icono, exacto }) => {
        const activo = estaActivo(pathname, href, exacto)
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
              activo ? "text-accent" : "text-muted",
            )}
          >
            <Icono className="h-5 w-5" strokeWidth={activo ? 2.1 : 1.75} />
            {etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

/* ---------------------------------------------------------------- usuario */

function MenuUsuario({ plegado = false }: { plegado?: boolean }) {
  const { perfil, rol } = useSesion()
  const formSalirRef = useRef<HTMLFormElement>(null)

  const iniciales = perfil.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={plegado ? perfil.full_name || "Tu cuenta" : undefined}
        title={plegado ? perfil.full_name : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radio-sm)] p-1.5 text-left transition hover:bg-surface-3/60",
          plegado && "justify-center",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold">
          {iniciales || <User className="h-3.5 w-3.5" />}
        </span>
        {!plegado && (
          <span className="hidden min-w-0 flex-1 truncate text-sm lg:block">
            {perfil.full_name}
          </span>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={plegado ? "right" : "bottom"}
          align="end"
          sideOffset={6}
          className="z-50 w-60 overflow-hidden rounded-[var(--radio)] border border-line bg-surface p-1"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{perfil.full_name}</p>
            <p className="truncate text-xs text-muted">{perfil.email}</p>
            <span className="chip mt-1.5">{NOMBRE_ROL[rol]}</span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-sm">Aspecto</span>
            <SelectorTema />
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          {/* En escritorio ya estan en la barra lateral */}
          <div className="lg:hidden">
            <DropdownMenu.Item asChild>
              <Link
                href="/estadisticas"
                className="flex items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
              >
                <TrendingUp className="h-4 w-4" />
                Estadísticas
              </Link>
            </DropdownMenu.Item>
            {(rol === "admin" || rol === "manager") && (
              <DropdownMenu.Item asChild>
                <Link
                  href="/gestion"
                  className="flex items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
                >
                  <Settings2 className="h-4 w-4" />
                  Gestión
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
          </div>

          <DropdownMenu.Item asChild>
            <Link
              href="/perfil"
              className="block rounded-[var(--radio-sm)] px-2 py-1.5 text-sm outline-none transition hover:bg-surface-2 data-highlighted:bg-surface-2"
            >
              Mi perfil
            </Link>
          </DropdownMenu.Item>
          {/* Radix cierra (desmonta) el menu al elegir un item: si la accion
              vive en el click nativo de un boton de un <form> anidado con
              asChild, el desmontaje gana la carrera y el submit no llega a
              salir. Se dispara aparte, con la referencia, en onSelect. */}
          <form ref={formSalirRef} action="/auth/salir" method="post" className="hidden" />
          <DropdownMenu.Item
            onSelect={() => formSalirRef.current?.requestSubmit()}
            className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radio-sm)] px-2 py-1.5 text-sm text-danger outline-none transition hover:bg-danger-soft data-highlighted:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
