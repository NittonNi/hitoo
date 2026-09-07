import { EMPRESA, PRECIO } from "@/lib/empresa"
import { PaginaLegal, Apartado } from "@/components/pagina-legal"

export const metadata = { title: "Condiciones de contratación" }
export const viewport = { themeColor: "#f5f5f7" }

/**
 * Lo que se acuerda al pagar hitoo. Escrito para leerse: si alguien tiene que
 * ir a un abogado para saber qué pasa cuando deja de pagar, está mal escrito.
 */
export default function PaginaCondiciones() {
  return (
    <PaginaLegal
      titulo="Condiciones de contratación"
      actualizado="1 de septiembre de 2026"
    >
      <Apartado titulo="Quién contrata con quién">
        <p>
          Estas condiciones regulan la suscripción a hitoo entre {EMPRESA.nombre}{" "}
          (CIF {EMPRESA.cif}, domicilio en {EMPRESA.domicilio}) y el equipo que
          contrata el servicio.
        </p>
        <p>
          Quien suscribe un espacio de trabajo declara que puede hacerlo en
          nombre de ese equipo. La suscripción es del espacio, no de la persona:
          si quien la contrató se va del equipo, la suscripción se queda.
        </p>
      </Apartado>

      <Apartado titulo="Qué se contrata y cuánto cuesta">
        <p>
          Un espacio de trabajo en hitoo cuesta{" "}
          <strong>
            {PRECIO.euros} € al mes más IVA ({PRECIO.conIvaTexto} € con el{" "}
            {PRECIO.iva}% incluido)
          </strong>
          , y da acceso a todas las funciones de la aplicación para hasta{" "}
          {PRECIO.personas} personas. No hay funciones reservadas a un plan
          superior ni cargos por persona.
        </p>
        <p>
          El precio se cobra por adelantado, cada mes, el mismo día en que se
          contrató. Se renueva solo hasta que se cancele.
        </p>
      </Apartado>

      <Apartado titulo="La prueba">
        <p>
          Todo espacio nuevo dispone de {PRECIO.diasPrueba} días de prueba sin
          pagar y sin dar ninguna tarjeta. Los equipos de LEINN con código de
          invitación disponen de {PRECIO.diasPruebaLeinn} días.
        </p>
        <p>
          Durante la prueba la aplicación funciona entera, sin recortes. Si la
          prueba termina sin suscribir el espacio, no se cobra nada: simplemente
          deja de poderse apuntar horas nuevas, como se explica abajo.
        </p>
      </Apartado>

      <Apartado titulo="Cómo se paga y cómo se factura">
        <p>
          El cobro lo gestiona Stripe Payments Europe, Ltd., que trata los datos
          de la tarjeta. {EMPRESA.marca} no ve ni guarda el número de ninguna
          tarjeta en ningún momento.
        </p>
        <p>
          Por cada cobro se emite una factura a nombre del equipo, con los datos
          fiscales que se indiquen al contratar. Todas las facturas quedan
          disponibles desde Gestión → Cuota, en el portal de pago.
        </p>
      </Apartado>

      <Apartado titulo="Cancelar, y qué pasa después">
        <p>
          La suscripción se cancela desde la propia aplicación, en Gestión →
          Cuota, sin llamar ni escribir a nadie y sin permanencia. El mes ya
          pagado se disfruta hasta el final: no se corta a mitad ni se devuelve
          la parte proporcional.
        </p>
        <p>
          <strong>Cancelar no borra nada.</strong> Al terminar el periodo
          pagado, el espacio queda en solo lectura: todo lo apuntado se sigue
          viendo, filtrando y descargando en Excel; lo único que no se puede es
          apuntar horas nuevas. En cuanto se vuelve a suscribir, sigue donde
          estaba.
        </p>
        <p>
          Si se prefiere el borrado completo, basta pedirlo por correo y se
          borra, como recoge la política de privacidad.
        </p>
      </Apartado>

      <Apartado titulo="Si un cobro falla">
        <p>
          Cuando un cobro no sale —una tarjeta caducada, casi siempre—, Stripe lo
          reintenta durante unos días y la aplicación avisa dentro. El espacio
          sigue funcionando mientras tanto. Si al final no se puede cobrar, la
          suscripción se cancela y el espacio pasa a solo lectura, con lo
          apuntado intacto.
        </p>
      </Apartado>

      <Apartado titulo="Derecho de desistimiento">
        <p>
          Cuando quien contrata es un consumidor, dispone de 14 días naturales
          para desistir sin dar explicaciones, escribiendo a{" "}
          <a href={`mailto:${EMPRESA.correo}`} className="underline hover:text-muted">
            {EMPRESA.correo}
          </a>
          . Al contratar se pide el acceso inmediato al servicio, de modo que si
          se desiste después de haberlo usado se descuenta la parte
          proporcional a lo ya prestado.
        </p>
        <p>
          En la práctica esto casi nunca hace falta: la prueba permite ver la
          aplicación entera antes de pagar nada.
        </p>
      </Apartado>

      <Apartado titulo="Cambios de precio y del servicio">
        <p>
          El precio puede cambiar, y cualquier cambio se avisa con al menos 30
          días de antelación por correo y dentro de la aplicación, con derecho a
          cancelar antes de que se aplique. Ningún cambio afecta a un mes ya
          pagado.
        </p>
        <p>
          hitoo se mejora de continuo: se añaden funciones y a veces se retiran
          las que nadie usa. No se retirará nada que deje sin acceso a lo ya
          apuntado.
        </p>
      </Apartado>

      <Apartado titulo="Los datos del equipo">
        <p>
          Los datos que un equipo mete en hitoo son suyos. {EMPRESA.marca} los
          trata por su cuenta y para prestarle el servicio, nunca para venderlos
          ni para entrenar modelos de inteligencia artificial. El detalle de qué
          se guarda, con quién se comparte y cuánto dura está en la{" "}
          <a href="/privacidad" className="underline hover:text-muted">
            política de privacidad
          </a>
          , que forma parte de estas condiciones.
        </p>
      </Apartado>

      <Apartado titulo="Ley aplicable">
        <p>
          Se aplica la ley española. Para cualquier discrepancia, las partes se
          someten a los juzgados de {EMPRESA.provincia}, salvo cuando la ley
          imponga otro fuero por tratarse de un consumidor.
        </p>
      </Apartado>
    </PaginaLegal>
  )
}
