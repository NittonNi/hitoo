import { EMPRESA } from "@/lib/empresa"
import { PaginaLegal, Apartado } from "@/components/pagina-legal"

export const metadata = { title: "Aviso legal" }
export const viewport = { themeColor: "#f5f5f7" }

/**
 * Lo que exige el artículo 10 de la LSSI a cualquiera que tenga una web con
 * actividad económica: quién está detrás, con nombre, CIF, domicilio y una
 * forma de contacto directa.
 */
export default function PaginaAvisoLegal() {
  return (
    <PaginaLegal titulo="Aviso legal" actualizado="1 de septiembre de 2026">
      <Apartado titulo="Quién está detrás de hitoo">
        <p>
          hitoo es un servicio de {EMPRESA.nombre}, con CIF {EMPRESA.cif} y
          domicilio en {EMPRESA.domicilio} ({EMPRESA.provincia}, España).
        </p>
        <p>
          Para cualquier cosa —dudas, incidencias, bajas, facturas o
          reclamaciones— se puede escribir a{" "}
          <a href={`mailto:${EMPRESA.correo}`} className="underline hover:text-muted">
            {EMPRESA.correo}
          </a>
          , y se contesta al mismo correo desde el que se escriba.
        </p>
      </Apartado>

      <Apartado titulo="Qué es este sitio">
        <p>
          En {EMPRESA.web} se explica y se usa hitoo, una aplicación para que un
          equipo apunte sus horas y vea lo que cada proyecto cuesta y deja. El
          uso de la aplicación exige darse de alta y aceptar las{" "}
          <a href="/condiciones" className="underline hover:text-muted">
            condiciones de contratación
          </a>
          .
        </p>
      </Apartado>

      <Apartado titulo="De quién es lo que se ve">
        <p>
          El código, el diseño, los textos y la marca hitoo son de{" "}
          {EMPRESA.marca}. Se pueden usar dentro de la aplicación y para lo que
          la aplicación sirve, pero no copiarse, revenderse ni presentarse como
          propios.
        </p>
        <p>
          Lo que un equipo apunta dentro —sus horas, sus proyectos, sus
          importes— es suyo, no nuestro. Puede bajárselo en Excel cuando quiera
          y pedir que se borre, como se explica en la{" "}
          <a href="/privacidad" className="underline hover:text-muted">
            política de privacidad
          </a>
          .
        </p>
      </Apartado>

      <Apartado titulo="Hasta dónde respondemos">
        <p>
          hitoo se ofrece tal y como está y se cuida para que funcione, pero no
          se promete que no vaya a fallar nunca ni que esté disponible sin
          interrupción: depende también de terceros —el alojamiento y la base de
          datos— y de mantenimientos que a veces son necesarios.
        </p>
        <p>
          Lo que sí se garantiza es que los datos apuntados no se pierden por
          una baja ni por un impago: siguen accesibles y exportables, como
          detallan las condiciones.
        </p>
      </Apartado>

      <Apartado titulo="Qué ley se aplica">
        <p>
          Este aviso se rige por la ley española. Para cualquier discrepancia,
          las partes se someten a los juzgados de {EMPRESA.provincia}, salvo
          cuando la ley imponga otro fuero por tratarse de un consumidor.
        </p>
      </Apartado>
    </PaginaLegal>
  )
}
