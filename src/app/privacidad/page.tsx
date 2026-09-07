import Link from "next/link"

import { EMPRESA } from "@/lib/empresa"

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
      <p className="mt-2 text-sm text-muted">Última actualización: 7 de septiembre de 2026.</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink">
        <section>
          <p>
            hitoo es una aplicación de control de horas para equipos LEINN:
            cronómetro, hoja semanal, calendario e informes con importes. La
            ofrece la{" "}
            <a href="/aviso-legal" className="underline hover:text-muted">
              Asociación estudiantil junior empresa NITTON
            </a>
            , responsable del tratamiento de los datos, y se puede escribir en
            cualquier momento a{" "}
            <a href={`mailto:${EMPRESA.correo}`} className="underline hover:text-muted">
              {EMPRESA.correo}
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
              <strong>Si el espacio se suscribe:</strong> el nombre, el correo
              y los datos fiscales necesarios para facturar, y un
              identificador del cliente y de la suscripción en Stripe. Los
              datos de la tarjeta no pasan por hitoo en ningún momento: se
              escriben directamente en la pasarela de Stripe.
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
            ninguno más —y los que vienen de Google Calendar, solo a los tres
            primeros—:
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
              <strong>Stripe</strong> (Stripe Payments Europe, Ltd.), como
              encargado del tratamiento, y <strong>solo si el espacio está
              suscrito</strong>: cobra la cuota y emite las facturas, así que
              recibe el nombre, el correo y los datos fiscales de quien
              contrata, además de los de la tarjeta, que trata directamente
              —hitoo nunca los ve—. No recibe ninguna hora apuntada, ningún
              proyecto ni ningún dato venido de Google Calendar.
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
            <strong>Sobre salir de Europa.</strong> Los datos se guardan en
            servidores de la Unión Europea (Irlanda). Pero Supabase Inc. y
            Vercel Inc. son empresas estadounidenses, así que su personal de
            soporte puede llegar a acceder a ellos desde fuera del Espacio
            Económico Europeo. Esos accesos están cubiertos por las cláusulas
            contractuales tipo aprobadas por la Comisión Europea, que forman
            parte del contrato de encargo firmado con cada proveedor. Stripe
            contrata desde Irlanda (Stripe Payments Europe, Ltd.).
          </p>
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
            <a href={`mailto:${EMPRESA.correo}`} className="underline hover:text-muted">
              {EMPRESA.correo}
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
          <p className="mt-3">
            Hay una excepción, y es de ley: <strong>las facturas</strong>. Si
            el espacio llegó a pagar, los datos de facturación —quién contrató,
            su NIF, su dirección y los importes— se conservan aunque se pida el
            borrado, porque Hacienda y el Código de Comercio obligan a
            guardarlos. Se quedan solo para eso, no se usan para nada más, y se
            borran cuando vence el plazo. Todo lo demás —las horas, los
            proyectos, la cuenta— sí se borra cuando lo pides.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            Con qué derecho se tratan
          </h2>
          <p className="mt-3">
            No todo se trata por el mismo motivo, y conviene decir cuál es
            cada uno:
          </p>
          <ul className="mt-3 space-y-3">
            <li>
              <strong>Para que la aplicación funcione</strong> —tu cuenta, tu
              espacio, tus horas, tus proyectos— el motivo es el{" "}
              <strong>contrato</strong>: es lo que hay que tratar para darte el
              servicio que has contratado. Sin esos datos no hay aplicación.
            </li>
            <li>
              <strong>Para cobrar y facturar</strong> el motivo es doble: el
              contrato, y la <strong>obligación legal</strong> de emitir y
              conservar facturas.
            </li>
            <li>
              <strong>Para leer tu Google Calendar</strong> el motivo es tu{" "}
              <strong>consentimiento</strong>, que das al conectarlo y retiras
              al desconectarlo. Es opcional y va por persona: quien no lo
              conecta, no tiene ese tratamiento.
            </li>
            <li>
              <strong>Para mantener el servicio en pie</strong> —copias de
              seguridad, registros de error, seguridad— el motivo es el{" "}
              <strong>interés legítimo</strong> en que esto funcione y no se
              pierda nada.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">
            Qué puedes exigir, y a quién
          </h2>
          <p className="mt-3">
            Sobre tus datos tienes estos derechos, y ejercerlos es gratis:
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <strong>Acceso:</strong> que te digamos qué tenemos tuyo.
            </li>
            <li>
              <strong>Rectificación:</strong> que corrijamos lo que esté mal.
            </li>
            <li>
              <strong>Supresión:</strong> que lo borremos, con los límites que
              se explican abajo.
            </li>
            <li>
              <strong>Limitación:</strong> que lo guardemos pero dejemos de
              usarlo mientras se resuelve una discusión.
            </li>
            <li>
              <strong>Portabilidad:</strong> que te lo demos en un formato que
              puedas llevarte a otro sitio. Esto no hace falta ni pedirlo: la
              descarga en Excel está dentro de la aplicación y es tuya cuando
              quieras.
            </li>
            <li>
              <strong>Oposición:</strong> que dejemos de tratar tus datos
              cuando el motivo sea el interés legítimo.
            </li>
            <li>
              <strong>Retirar el consentimiento</strong> que hayas dado —el de
              Google Calendar— sin que eso afecte a lo hecho hasta entonces.
            </li>
          </ul>
          <p className="mt-3">
            Se ejercen escribiendo a{" "}
            <a href={`mailto:${EMPRESA.correo}`} className="underline hover:text-muted">
              {EMPRESA.correo}
            </a>
            , y se contesta en el plazo de un mes.
          </p>
          <p className="mt-3">
            Si crees que no lo hemos hecho bien, puedes reclamar ante la{" "}
            <strong>Agencia Española de Protección de Datos</strong> (
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-muted"
            >
              www.aepd.es
            </a>
            ), que es la autoridad de control. No hace falta que hables antes
            con nosotros, aunque se agradece.
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
