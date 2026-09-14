"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Mail, Pencil, Plus, Trash2, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { mensajeError } from "@/lib/errores"
import { formatDateShort } from "@/lib/time"
import { NOMBRE_ROL, type Rol } from "@/lib/roles"
import type { Espacio, Invitacion, Miembro } from "@/lib/tipos"
import { cn } from "@/lib/utils"

const ROLES: { valor: Rol; ayuda: string }[] = [
  { valor: "admin", ayuda: "Todo, incluidas tarifas y equipo" },
  { valor: "manager", ayuda: "Ve las horas de todos y el catalogo" },
  { valor: "member", ayuda: "Solo sus propias horas" },
  { valor: "coach", ayuda: "Ve todo el equipo, sin apuntar ni cambiar nada" },
]

export function GestionEquipo({
  yoId,
  rol,
  espacio,
  miembros,
  invitaciones,
}: {
  yoId: string
  rol: Rol
  espacio: Espacio
  miembros: Miembro[]
  invitaciones: Invitacion[]
}) {
  const esAdmin = rol === "admin"
  const pendientes = invitaciones.filter((i) => !i.accepted_at)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Miembros
        espacioId={espacio.id}
        miembros={miembros}
        yoId={yoId}
        esAdmin={esAdmin}
      />
      <div className="space-y-5">
        <Invitaciones
          espacioId={espacio.id}
          yoId={yoId}
          pendientes={pendientes}
          esAdmin={esAdmin}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ miembros */

function Miembros({
  espacioId,
  miembros,
  yoId,
  esAdmin,
}: {
  espacioId: string
  miembros: Miembro[]
  yoId: string
  esAdmin: boolean
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renombrando, setRenombrando] = useState<string | null>(null)
  const [nombre, setNombre] = useState("")

  /**
   * El perfil es de cada uno, pero los nombres entran mal: al importar, al
   * unirse con prisa. Quien administra lo arregla sin tener que pedirselo,
   * y por una funcion que comprueba que esa persona es de este espacio.
   */
  async function renombrar(id: string) {
    const limpio = nombre.trim()
    if (!limpio) return
    setOcupado(id)
    setError(null)
    const { error: err } = await createClient().rpc("renombrar_miembro", {
      p_workspace: espacioId,
      p_user: id,
      p_nombre: limpio,
    })
    setOcupado(null)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setRenombrando(null)
    router.refresh()
  }

  async function cambiar(id: string, cambios: { role?: Rol; active?: boolean }) {
    setOcupado(id)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("workspace_members")
      .update(cambios)
      .eq("workspace_id", espacioId)
      .eq("user_id", id)
    setOcupado(null)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
  }

  const admins = miembros.filter((m) => m.role === "admin" && m.active).length

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">
        Miembros <span className="text-muted">({miembros.length})</span>
      </h2>

      {error && (
        <p className="mb-2 rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="divide-y divide-line">
        {miembros.map((miembro) => {
          const soyYo = miembro.id === yoId
          // No dejar el espacio sin ningún administrador activo
          const ultimoAdmin = miembro.role === "admin" && miembro.active && admins <= 1

          return (
            <li
              key={miembro.id}
              className={cn(
                "flex flex-wrap items-center gap-2 py-2.5",
                !miembro.active && "opacity-55",
              )}
            >
              <div className="min-w-0 flex-1">
                {renombrando === miembro.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void renombrar(miembro.id)
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      autoFocus
                      className="field h-8 py-0 text-sm"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenombrando(null)
                      }}
                      aria-label={"Nombre de " + miembro.full_name}
                    />
                    <button
                      type="submit"
                      disabled={ocupado === miembro.id || !nombre.trim()}
                      className="btn btn-primary h-8 px-2"
                      aria-label="Guardar el nombre"
                    >
                      {ocupado === miembro.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenombrando(null)}
                      className="btn h-8 px-2"
                      aria-label="Dejarlo como estaba"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {miembro.full_name}
                    </span>
                    {soyYo && <span className="text-xs text-muted">(tu)</span>}
                    {esAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setNombre(miembro.full_name)
                          setRenombrando(miembro.id)
                        }}
                        title="Cambiar el nombre"
                        aria-label={"Cambiar el nombre de " + miembro.full_name}
                        className="shrink-0 rounded-[3px] p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </p>
                )}
                <p className="truncate text-xs text-muted">{miembro.email}</p>
              </div>

              {esAdmin ? (
                <select
                  className="field w-40 py-1"
                  value={miembro.role}
                  disabled={ocupado === miembro.id || ultimoAdmin}
                  title={
                    ultimoAdmin
                      ? "Es el único administrador activo"
                      : "Rol dentro de este espacio"
                  }
                  onChange={(e) =>
                    void cambiar(miembro.id, { role: e.target.value as Rol })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {NOMBRE_ROL[r.valor]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="chip">{NOMBRE_ROL[miembro.role]}</span>
              )}

              {esAdmin && (
                <button
                  type="button"
                  onClick={() => void cambiar(miembro.id, { active: !miembro.active })}
                  disabled={ocupado === miembro.id || ultimoAdmin || soyYo}
                  title={
                    soyYo
                      ? "No puedes sacarte a ti mismo"
                      : miembro.active
                        ? "Quitar el acceso a este espacio"
                        : "Devolver el acceso"
                  }
                  className={cn("btn py-1", miembro.active && "btn-danger")}
                >
                  {ocupado === miembro.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {miembro.active ? "Desactivar" : "Reactivar"}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {esAdmin && (
        <p className="mt-3 text-xs text-muted">
          Desactivar conserva las horas ya registradas: solo cierra el acceso a
          este espacio.
        </p>
      )}
    </section>
  )
}

/* -------------------------------------------------------------- invitaciones */

function Invitaciones({
  espacioId,
  yoId,
  pendientes,
  esAdmin,
}: {
  espacioId: string
  yoId: string
  pendientes: Invitacion[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [rol, setRol] = useState<Rol>("member")
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function invitar() {
    const correo = email.trim().toLowerCase()
    if (!correo.includes("@")) {
      setError("Escribe una dirección de correo válida.")
      return
    }
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from("invitations").insert({
      workspace_id: espacioId,
      email: correo,
      full_name: nombre.trim(),
      role: rol,
      invited_by: yoId,
    })
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    setEmail("")
    setNombre("")
    router.refresh()
  }

  async function retirar(id: string) {
    setOcupado(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from("invitations").delete().eq("id", id)
    setOcupado(false)
    if (err) {
      setError(mensajeError(err))
      return
    }
    router.refresh()
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-sm font-semibold">Invitaciones</h2>
      <p className="mb-3 text-xs text-muted">
        Autoriza una dirección y verá este espacio nada más entrar, sin que le
        mandes nada.
      </p>

      {esAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void invitar()
          }}
          className="space-y-2"
        >
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="companero@empresa.com"
            aria-label="Correo a invitar"
          />
          <div className="flex gap-2">
            <input
              className="field"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre (opcional)"
              aria-label="Nombre"
            />
            <select
              className="field w-40"
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              aria-label="Rol"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {NOMBRE_ROL[r.valor]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={ocupado || !email.trim()}
            className="btn btn-primary w-full"
          >
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Invitar
          </button>
        </form>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-line">
        {pendientes.length === 0 && (
          <li className="py-2 text-sm text-muted">No hay invitaciones pendientes.</li>
        )}
        {pendientes.map((inv) => (
          <li key={inv.id} className="flex items-center gap-2 py-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{inv.email}</p>
              <p className="text-xs text-muted">
                {NOMBRE_ROL[inv.role]} · {formatDateShort(inv.created_at.slice(0, 10))}
              </p>
            </div>
            {esAdmin && (
              <button
                type="button"
                onClick={() => void retirar(inv.id)}
                disabled={ocupado}
                className="btn btn-ghost p-1.5 text-danger"
                aria-label={`Retirar la invitación de ${inv.email}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
