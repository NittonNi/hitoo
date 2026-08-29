import Link from "next/link"

export const metadata = { title: "Política de privacidad" }

/** Cuelga de la portada, así que va en claro como ella. */
export const viewport = { themeColor: "#f5f5f7" }

export default function PaginaPrivacidad() {
  return (
    /* En claro: se llega pulsando en el pie de la portada, y saltar de blanco
       a negro al hacerlo no tenía ningún sentido. */
    <main className="tema-claro mx-auto w-full max-w-2xl px-5 py-16">
      <Link href="/" className="text-sm text-muted transition hover:text-ink">
        ← Volver a hitoo
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-muted">Última actualización: 29 de agosto de 2026.</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink">
        <section>
          <p>
            hitoo es una aplicación de control de horas para equipos LEINN:
            cronómetro, hoja semanal, calendario e informes con importes. La
            ofrece Nicolás Martínez Riego, y se puede escribir en cualquier
            momento a{" "}
            <a href="mailto:hitooclock@gmail.com" className="underline hover:text-muted">
              hitooclock@gmail.com
            </a>{" "}
            para cualquier pregunta sobre esta política o sobre los datos
            propios.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Qué datos se recogen</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Al crear la cuenta:</strong> nombre, correo electrónico
              y, si se entra con Google, el nombre y correo que Google
              facilita. La contraseña, si se usa acceso por correo, la guarda
              y cifra Supabase (el proveedor de base de datos y autenticación
              de hitoo) — hitoo nunca la ve en claro.
            </li>
            <li>
              <strong>Datos de uso normal de la app:</strong> las horas que se
              apuntan (inicio, fin, proyecto, tarea, descripción, si se
              cobran), los proyectos y tarifas que un administrador del
              espacio configure, y las propuestas de horas compartidas entre
              compañeros de equipo.
            </li>
            <li>
              <strong>Si se conecta Google Calendar</strong> (opcional, se
              activa a mano desde Ajustes): un token de acceso de solo
              lectura sobre el calendario, y los eventos de los próximos días
              para poder ofrecerlos como horas con un clic. hitoo nunca
              escribe ni modifica nada en el calendario de Google — solo lee.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Para qué se usan</h2>
          <p className="mt-3">
            Únicamente para que el equipo pueda fichar sus horas, ver en qué
            se reparte el tiempo de cada proyecto y calcular lo que cuesta o
            factura. Nada de estos datos se usa para publicidad, ni se vende
            ni se cede a terceros con fines comerciales.
          </p>
        </section>

        <section id="google-calendar">
          <h2 className="text-lg font-semibold text-ink">
            Acceso a Google Calendar
          </h2>
          <p className="mt-3">
            hitoo pide el permiso <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">calendar.readonly</code> de
            Google —solo lectura— exclusivamente para mostrar los eventos
            aceptados del calendario de quien lo conecta, dentro de la propia
            app, y dejar que los convierta en una hora fichada con un clic en
            vez de escribirla a mano. No se usa para ningún otro fin.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              El token que Google entrega se guarda cifrado con AES-256-GCM
              antes de escribirlo en la base de datos. La clave de cifrado vive
              solo en el entorno del servidor, nunca en la base ni en el
              navegador: quien llegase a leer la fila se llevaría un texto
              inservible. Solo el servidor de hitoo lo descifra, y únicamente
              para pedirle a Google los eventos de quien lo conectó.
            </li>
            <li>
              Los eventos del calendario se piden en el momento de mirar la
              pantalla y no se guardan en la base de datos. Lo único que se
              queda es lo que la persona convierte en hora fichada a
              propósito, y solo eso (ver más abajo, «Con quién se comparten»).
            </li>
            <li>
              Se puede desconectar el calendario en cualquier momento desde
              Ajustes → Calendario. Al desconectarlo, hitoo revoca el permiso
              directamente con Google (no solo lo olvida por su cuenta) y
              borra el token guardado.
            </li>
          </ul>
          <p className="mt-3">
            El uso y la transferencia a cualquier otra aplicación de la
            información recibida de las APIs de Google se ajusta a la{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-muted"
            >
              Política de datos de usuario de los Servicios de API de Google
            </a>
            , incluidos los requisitos de Uso Limitado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Dónde se guardan</h2>
          <p className="mt-3">
            Todos los datos viven en Supabase, sobre un proyecto propio de
            hitoo alojado en la Unión Europea. Cada espacio de trabajo tiene
            sus propias reglas de acceso: solo quien pertenece a un espacio
            puede ver sus horas, y solo quien lo administra ve los importes.
          </p>
        </section>

        <section id="con-quien-se-comparten">
          <h2 className="text-lg font-semibold text-ink">Con quién se comparten</h2>
          <p className="mt-3">
            hitoo no vende, alquila ni cede datos personales a nadie, y no los
            usa para publicidad ni para entrenar modelos de inteligencia
            artificial. Los datos solo llegan a estos destinatarios, y a
            ninguno más:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Las demás personas del mismo espacio de trabajo.</strong>{" "}
              hitoo es una herramienta de equipo: las horas apuntadas —fecha,
              duración, proyecto y descripción— las ven los compañeros del
              mismo espacio, y quien lo administra ve además los importes.
              Esto afecta también a los datos que vienen de Google Calendar:
              si alguien convierte un evento en una hora fichada, el título de
              ese evento pasa a ser la descripción de esa hora y queda visible
              para su equipo. Los eventos que no se convierten no los ve nadie
              más que la persona que conectó su calendario.
            </li>
            <li>
              <strong>Supabase</strong> (Supabase Inc.), como encargado del
              tratamiento: aloja la base de datos y el sistema de acceso, en
              servidores de la Unión Europea. Trata los datos únicamente para
              prestar ese servicio a hitoo.
            </li>
            <li>
              <strong>Vercel</strong> (Vercel Inc.), como encargado del
              tratamiento: aloja y sirve la aplicación. Procesa las peticiones
              necesarias para que la web funcione; no guarda una copia propia
              de las horas ni de los datos del calendario.
            </li>
            <li>
              <strong>Google</strong>, únicamente en sentido contrario: hitoo
              le pide a Google los eventos de quien ha conectado su
              calendario. No se le envían a Google datos de hitoo más allá de
              lo imprescindible para hacer esa consulta con el permiso
              concedido.
            </li>
          </ul>
          <p className="mt-3">
            Los datos obtenidos de las APIs de Google no se transfieren a
            ningún otro tercero salvo que sea imprescindible para prestar el
            servicio a quien los cedió, por obligación legal o por una orden
            de una autoridad competente. En particular, no se comparten con
            anunciantes, ni con proveedores de analítica, ni con intermediarios
            de datos, ni se usan para crear perfiles.
          </p>
        </section>

        <section id="como-se-protegen">
          <h2 className="text-lg font-semibold text-ink">Cómo se protegen</h2>
          <p className="mt-3">
            Los datos que hitoo considera sensibles —los tokens de acceso a
            Google, el contenido de las horas y los importes— están protegidos
            con estas medidas:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>En tránsito:</strong> todo el tráfico va por HTTPS con
              TLS, forzado con HSTS. La aplicación no se sirve nunca por una
              conexión sin cifrar.
            </li>
            <li>
              <strong>En reposo:</strong> la base de datos está cifrada en
              disco por el proveedor, y el token de Google Calendar se guarda
              además cifrado por la propia aplicación con AES-256-GCM, con una
              clave que solo existe en las variables de entorno del servidor.
              Es un cifrado autenticado: si el valor guardado se altera, el
              descifrado falla en vez de devolver un dato manipulado.
            </li>
            <li>
              <strong>Control de acceso:</strong> cada tabla tiene reglas de
              seguridad a nivel de fila que se aplican en la propia base de
              datos, no solo en la aplicación. Nadie puede leer las horas de un
              espacio al que no pertenece, ni el token de otra persona, aunque
              intente saltarse la interfaz.
            </li>
            <li>
              <strong>Mínimo privilegio con Google:</strong> se pide el permiso
              de solo lectura del calendario y ningún otro. hitoo no puede
              crear, editar ni borrar eventos aunque quisiera.
            </li>
            <li>
              <strong>Al desconectar:</strong> el permiso se revoca contra los
              servidores de Google en el momento y el token se borra de la base
              de datos.
            </li>
            <li>
              <strong>En el navegador:</strong> cabeceras de seguridad
              (política de contenido, bloqueo de incrustación en marcos,
              <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-xs">nosniff</code>
              ) y cookies de sesión gestionadas por Supabase Auth.
            </li>
            <li>
              <strong>Quién puede acceder por detrás:</strong> el acceso
              administrativo a la base de datos lo tiene únicamente la persona
              que ofrece hitoo, y solo se usa para mantener el servicio.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            Cuánto tiempo se conservan y cómo pedir que se borren
          </h2>
          <p className="mt-3">
            Los datos se conservan mientras la cuenta o el espacio de trabajo
            sigan activos. Para pedir la baja de una cuenta, la salida de un
            espacio o el borrado completo de los propios datos, basta con
            escribir a{" "}
            <a href="mailto:hitooclock@gmail.com" className="underline hover:text-muted">
              hitooclock@gmail.com
            </a>
            .
          </p>
          <p className="mt-3">
            Los datos que vienen de Google tienen su propio plazo, más corto:
            los eventos del calendario no se conservan —se piden a Google cada
            vez que hace falta pintarlos— y el token de acceso se borra en el
            momento en que se desconecta el calendario, se borra la cuenta o
            se revoca el permiso desde la cuenta de Google.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Cookies</h2>
          <p className="mt-3">
            hitoo usa únicamente las cookies imprescindibles para mantener la
            sesión iniciada (gestionadas por Supabase Auth). No hay cookies de
            publicidad ni de analítica de terceros.
          </p>
        </section>
      </div>
    </main>
  )
}
