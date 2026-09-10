/** Traduce los errores que devuelven Supabase Auth y Postgres a algo legible. */
export function mensajeError(error: unknown): string {
  if (!error) return "Ha ocurrido un error inesperado."

  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string }).message ?? String(error))

  const code = (error as { code?: string }).code

  // Postgres
  if (code === "23505") {
    if (raw.includes("one_running_per_workspace")) {
      return "Ya tienes un cronómetro en marcha en este espacio."
    }
    if (raw.includes("projects_name_unique")) return "Ya existe un proyecto con ese nombre."
    if (raw.includes("tasks_name_per_project")) return "Ese proyecto ya tiene una tarea con ese nombre."
    if (raw.includes("tags_name_unique")) return "Ya existe una etiqueta con ese nombre."
    if (raw.includes("rates_scope_unique")) return "Ya hay una tarifa para ese ambito y esa fecha."
    if (
      raw.includes("project_results_scope_unique") ||
      raw.includes("project_results_general_unique")
    ) {
      return "Alguien más acaba de guardar este resultado, recarga y vuelve a intentarlo."
    }
    return "Ese registro ya existe."
  }
  // Lo lanza stop_timer cuando el espacio pide proyecto
  if (raw.includes("Elige un proyecto antes de parar")) {
    return "Elige un proyecto antes de parar el cronómetro."
  }
  if (code === "23514" && raw.includes("end_after_start")) {
    return "La hora de fin tiene que ser posterior a la de inicio."
  }
  if (code === "42501" || code === "PGRST301") {
    if (raw.includes("autorizada")) return raw
    // La politica `time_entries_insert` lleva `puede_escribir(workspace_id)`:
    // con la prueba acabada o la suscripcion cancelada, apuntar una hora
    // nueva rebota aqui. Sin este caso el mensaje era "No tienes permisos",
    // que hace pensar que te han cambiado el rol -y lo que pasa es que hay
    // que pagar-.
    if (raw.includes("time_entries")) {
      return "Se acabó la prueba de este espacio: las horas que hay siguen aquí y se pueden corregir y exportar, pero no se pueden apuntar nuevas hasta suscribirlo."
    }
    return "No tienes permisos para hacer eso."
  }

  // El minimo de caracteres se puede cambiar desde el panel de Supabase: se
  // lee del propio mensaje en vez de dejarlo fijo, que si no se desincroniza
  // -paso una vez, cuando se subio de 6 a 8-.
  const minimo = raw.match(/Password should be at least (\d+) characters?/)
  if (minimo) {
    return `La contraseña tiene que tener al menos ${minimo[1]} caracteres.`
  }

  // Acceso con Google
  const oauth: Record<string, string> = {
    "Unsupported provider": "El acceso con Google no esta activado en el servidor.",
    "provider is not enabled":
      "El acceso con Google no esta activado en el servidor.",
    access_denied: "Has cancelado el acceso con Google.",
    "enlace-invalido": "Ese enlace ya no vale. Pide uno nuevo.",
  }
  for (const [clave, es] of Object.entries(oauth)) {
    if (raw.includes(clave)) return es
  }

  // Supabase Auth
  const auth: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed":
      "Tu correo está sin confirmar. Revisa la bandeja de entrada.",
    // Sin confirmar si la cuenta existe -igual que recuperar contraseña,
    // que responde lo mismo exista o no la cuenta.
    "User already registered": "Revisa tu correo para continuar.",
    "Email rate limit exceeded":
      "Se ha superado el límite de correos. Espera unos minutos.",
    "Signups not allowed for this instance":
      "El registro está cerrado. Pide a un administrador que te invite.",
    "Auth session missing": "Ese enlace ya no vale. Pide uno nuevo.",
    "New password should be different from the old password":
      "Pon una contraseña distinta a la que ya tenías.",
  }
  for (const [en, es] of Object.entries(auth)) {
    if (raw.includes(en)) return es
  }

  if (raw.includes("Database error saving new user") || raw.includes("no esta autorizada")) {
    return "Esa dirección no esta autorizada. Pide a un administrador que te invite."
  }
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "No hay conexion con el servidor. Comprueba tu red."
  }

  return raw
}
