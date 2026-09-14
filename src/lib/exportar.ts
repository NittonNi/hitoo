/**
 * Descargas del informe.
 *
 * El Excel es el formato que de verdad se usa después, así que va pensado para
 * trabajar con él sin arreglar nada antes:
 * - **Detalle**, una fila por hora y en orden de cuándo pasó, con las mismas
 *   columnas que el informe detallado de Clockify (fecha y hora de inicio y de
 *   fin), más área, categoría, edición y etiquetas. Cada celda con su tipo: la
 *   fecha es fecha, las horas son horas de reloj y la duración suma.
 * - **Resumen**, con el periodo, lo filtrado y los totales, y las horas por
 *   proyecto, por persona y por área.
 * - **Persona y proyecto**, cuánto puso cada uno en cada proyecto: lo primero
 *   que se pregunta al repartir.
 *
 * El CSV lleva las mismas columnas que el detalle y el PDF, el resumen y el
 * detalle, para mandarlo o imprimirlo.
 */

import Papa from "papaparse"

import type { CellObject, Row, SheetData } from "write-excel-file/browser"

import { formatDateShort, formatDurationShort, formatMoney } from "@/lib/time"
import type { EntradaVista } from "@/lib/tipos"

export type OpcionesDescarga = {
  nombre: string
  desde: string
  hasta: string
  /** Solo quien ve importes y con tarifas puestas: si no, serían ceros. */
  conImportes: boolean
  /** Lo filtrado, escrito («Proyectos: TLT, CARE TEAM»). Vacío, sin filtros. */
  filtros: string[]
  /** Nombre del espacio, para la cabecera. */
  espacio?: string
  /** El huso del espacio: las horas de inicio y fin son las de allí. */
  timeZone?: string
}

function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

/* ----------------------------------------------------------- lo compartido */

/** De la más antigua a la más reciente, que es como se lee una hoja de horas. */
function enOrden(entradas: EntradaVista[]) {
  return [...entradas]
    .filter((e) => e.end_at)
    .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id))
}

const formateadores = new Map<string, Intl.DateTimeFormat>()

/** Fecha y hora de pared de un instante en el huso del espacio. */
function enZona(iso: string, timeZone: string) {
  let f = formateadores.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formateadores.set(timeZone, f)
  }
  const partes = f.formatToParts(new Date(iso))
  const n = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00"
  return {
    fecha: `${n("year")}-${n("month")}-${n("day")}`,
    hora: `${n("hour")}:${n("minute")}`,
    segundosDelDia: Number(n("hour")) * 3600 + Number(n("minute")) * 60 + Number(n("second")),
  }
}

type Fila = {
  fecha: string
  inicio: ReturnType<typeof enZona>
  fin: ReturnType<typeof enZona>
  segundos: number
  persona: string
  area: string
  categoria: string
  proyecto: string
  edicion: string
  tarea: string
  descripcion: string
  etiquetas: string
  facturable: boolean
  importe: number | null
}

function filas(entradas: EntradaVista[], timeZone: string): Fila[] {
  return enOrden(entradas).map((e) => ({
    fecha: e.local_date,
    inicio: enZona(e.start_at, timeZone),
    fin: enZona(e.end_at!, timeZone),
    segundos: e.duration_seconds ?? 0,
    persona: e.user_name,
    area: e.category_name ?? "",
    categoria: e.subcategory_name ?? "",
    proyecto: e.project_name ?? "",
    edicion: e.edition_name ?? "",
    tarea: e.task_name ?? "",
    descripcion: e.description,
    etiquetas: e.tags.join(", "),
    facturable: e.billable,
    importe: e.amount != null ? Number(e.amount) : null,
  }))
}

type Suma = { clave: string; segundos: number; facturables: number; importe: number; apuntes: number }

function sumarPor(lista: Fila[], clave: (f: Fila) => string): Suma[] {
  const mapa = new Map<string, Suma>()
  for (const f of lista) {
    const k = clave(f)
    const s = mapa.get(k) ?? { clave: k, segundos: 0, facturables: 0, importe: 0, apuntes: 0 }
    s.segundos += f.segundos
    s.apuntes += 1
    if (f.facturable) {
      s.facturables += f.segundos
      s.importe += f.importe ?? 0
    }
    mapa.set(k, s)
  }
  return [...mapa.values()].sort((a, b) => b.segundos - a.segundos)
}

function totalDe(lista: Fila[]): Suma {
  return sumarPor(lista, () => "Total")[0] ?? {
    clave: "Total",
    segundos: 0,
    facturables: 0,
    importe: 0,
    apuntes: 0,
  }
}

const decimal = (segundos: number) => Math.round((segundos / 3600) * 100) / 100
const porcentaje = (parte: number, total: number) => (total > 0 ? parte / total : 0)
const huso = (o: OpcionesDescarga) =>
  o.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

/* --------------------------------------------------------------------- csv */

export function exportarCsv(
  entradas: EntradaVista[],
  nombre: string,
  opciones: { conImportes: boolean; timeZone?: string },
) {
  const lista = filas(entradas, opciones.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const coma = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

  const datos = lista.map((f) => ({
    Fecha: formatDateShort(f.fecha),
    Inicio: f.inicio.hora,
    "Fecha de fin": formatDateShort(f.fin.fecha),
    Fin: f.fin.hora,
    Duración: formatDurationShort(f.segundos),
    "Horas (decimal)": coma(f.segundos / 3600),
    Persona: f.persona,
    Área: f.area,
    Categoría: f.categoria,
    Proyecto: f.proyecto,
    Edición: f.edicion,
    Tarea: f.tarea,
    Descripción: f.descripcion,
    Etiquetas: f.etiquetas,
    Facturable: f.facturable ? "Sí" : "No",
    ...(opciones.conImportes ? { Importe: f.importe != null ? coma(f.importe) : "" } : {}),
  }))

  // Punto y coma y BOM: es lo que espera un Excel en español
  const csv = Papa.unparse(datos, { delimiter: ";" })
  descargar(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${nombre}.csv`)
}

/* ------------------------------------------------------------------- excel */

const EUROS = '#,##0.00\\ "€"'
const DURACION = "[h]:mm:ss"
const GRIS = "#69737F"

function cabecera(texto: string, derecha = false): CellObject {
  return {
    value: texto,
    type: String,
    fontWeight: "bold",
    backgroundColor: "#0F1419",
    textColor: "#FFFFFF",
    align: derecha ? "right" : "left",
  }
}

const texto = (value: string, extra: Partial<CellObject> = {}): CellObject => ({
  value,
  type: String,
  ...extra,
})
const duracion = (segundos: number, extra: Partial<CellObject> = {}): CellObject => ({
  value: segundos / 86400,
  type: Number,
  format: DURACION,
  ...extra,
})
const horas = (segundos: number, extra: Partial<CellObject> = {}): CellObject => ({
  value: decimal(segundos),
  type: Number,
  format: "0.00",
  ...extra,
})
const euros = (valor: number, extra: Partial<CellObject> = {}): CellObject => ({
  value: Math.round(valor * 100) / 100,
  type: Number,
  format: EUROS,
  ...extra,
})
const fecha = (clave: string): CellObject => {
  const [a, m, d] = clave.split("-").map(Number)
  return { value: new Date(Date.UTC(a, m - 1, d)), type: Date, format: "dd/mm/yyyy" }
}
const reloj = (segundosDelDia: number): CellObject => ({
  value: segundosDelDia / 86400,
  type: Number,
  format: "hh:mm",
})

/** Una tabla de sumas con su fila de total, lista para ir debajo de otra. */
function tablaDeSumas(
  titulo: string,
  columna: string,
  grupos: Suma[],
  total: Suma,
  conImportes: boolean,
): SheetData {
  const negrita = { fontWeight: "bold" as const }
  return [
    [texto(titulo, { fontWeight: "bold", fontSize: 12 })],
    [
      cabecera(columna),
      cabecera("Duración", true),
      cabecera("Horas", true),
      cabecera("% del total", true),
      cabecera("Facturable", true),
      ...(conImportes ? [cabecera("Importe", true)] : []),
    ],
    ...grupos.map(
      (g): Row => [
        texto(g.clave || "(sin nombre)"),
        duracion(g.segundos),
        horas(g.segundos),
        { value: porcentaje(g.segundos, total.segundos), type: Number, format: "0.0%" },
        duracion(g.facturables),
        ...(conImportes ? [euros(g.importe)] : []),
      ],
    ),
    [
      texto("Total", negrita),
      duracion(total.segundos, negrita),
      horas(total.segundos, negrita),
      { value: 1, type: Number, format: "0.0%", ...negrita },
      duracion(total.facturables, negrita),
      ...(conImportes ? [euros(total.importe, negrita)] : []),
    ],
  ]
}

export async function exportarExcel(entradas: EntradaVista[], opciones: OpcionesDescarga) {
  // El paquete no tiene entrada raiz: hay que pedir la versión de navegador
  const { default: writeXlsxFile } = await import("write-excel-file/browser")

  const lista = filas(entradas, huso(opciones))
  const total = totalDe(lista)
  const { conImportes } = opciones

  /* ---------------------------------------------------------------- detalle */
  const columnasDetalle = [
    { titulo: "Fecha", ancho: 11 },
    { titulo: "Inicio", ancho: 7, derecha: true },
    { titulo: "Fecha de fin", ancho: 11 },
    { titulo: "Fin", ancho: 7, derecha: true },
    { titulo: "Duración", ancho: 10, derecha: true },
    { titulo: "Horas", ancho: 8, derecha: true },
    { titulo: "Persona", ancho: 22 },
    { titulo: "Área", ancho: 16 },
    { titulo: "Categoría", ancho: 16 },
    { titulo: "Proyecto", ancho: 26 },
    { titulo: "Edición", ancho: 14 },
    { titulo: "Tarea", ancho: 22 },
    { titulo: "Descripción", ancho: 48 },
    { titulo: "Etiquetas", ancho: 20 },
    { titulo: "Facturable", ancho: 10 },
    ...(conImportes ? [{ titulo: "Importe", ancho: 12, derecha: true }] : []),
  ]

  const detalle: SheetData = [
    columnasDetalle.map((c) => cabecera(c.titulo, c.derecha)),
    ...lista.map((f): Row => [
      fecha(f.fecha),
      reloj(f.inicio.segundosDelDia),
      fecha(f.fin.fecha),
      reloj(f.fin.segundosDelDia),
      duracion(f.segundos),
      horas(f.segundos),
      texto(f.persona),
      texto(f.area),
      texto(f.categoria),
      texto(f.proyecto),
      texto(f.edicion),
      texto(f.tarea),
      texto(f.descripcion),
      texto(f.etiquetas),
      texto(f.facturable ? "Sí" : "No", { align: "center" }),
      ...(conImportes ? [f.importe != null ? euros(f.importe) : null] : []),
    ]),
  ]

  /* ---------------------------------------------------------------- resumen */
  const dato = (etiqueta: string, valor: CellObject): Row => [
    texto(etiqueta, { textColor: GRIS }),
    valor,
  ]

  const resumen: SheetData = [
    [
      texto(opciones.espacio ? `Informe de horas · ${opciones.espacio}` : "Informe de horas", {
        fontWeight: "bold",
        fontSize: 14,
      }),
    ],
    dato("Periodo", texto(`${formatDateShort(opciones.desde)} - ${formatDateShort(opciones.hasta)}`)),
    dato(
      "Generado",
      texto(
        new Date().toLocaleString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ),
    dato("Filtros", texto(opciones.filtros.length > 0 ? opciones.filtros.join(" · ") : "Ninguno: todas las horas del periodo")),
    [],
    dato("Horas", duracion(total.segundos, { fontWeight: "bold", align: "left" })),
    dato("En decimal", horas(total.segundos, { align: "left" })),
    dato("Facturable", duracion(total.facturables, { align: "left" })),
    dato("Apuntes", { value: total.apuntes, type: Number, format: "#,##0", align: "left" }),
    ...(conImportes ? [dato("Importe", euros(total.importe, { align: "left" }))] : []),
    [],
    ...tablaDeSumas("Por proyecto", "Proyecto", sumarPor(lista, (f) => f.proyecto || "Sin proyecto"), total, conImportes),
    [],
    ...tablaDeSumas("Por persona", "Persona", sumarPor(lista, (f) => f.persona), total, conImportes),
    [],
    ...tablaDeSumas("Por área", "Área", sumarPor(lista, (f) => f.area || "Sin área"), total, conImportes),
  ]

  /* ------------------------------------------------------ persona y proyecto */
  const cruce = sumarPor(lista, (f) => `${f.persona}\u001f${f.proyecto || "Sin proyecto"}`).sort(
    (a, b) => a.clave.localeCompare(b.clave, "es") || b.segundos - a.segundos,
  )
  const personaProyecto: SheetData = [
    [
      cabecera("Persona"),
      cabecera("Proyecto"),
      cabecera("Duración", true),
      cabecera("Horas", true),
      cabecera("Apuntes", true),
      cabecera("Facturable", true),
      ...(conImportes ? [cabecera("Importe", true)] : []),
    ],
    ...cruce.map((g): Row => {
      const [persona, proyecto] = g.clave.split("\u001f")
      return [
        texto(persona),
        texto(proyecto),
        duracion(g.segundos),
        horas(g.segundos),
        { value: g.apuntes, type: Number, format: "#,##0" },
        duracion(g.facturables),
        ...(conImportes ? [euros(g.importe)] : []),
      ]
    }),
  ]

  await writeXlsxFile([
    {
      data: resumen,
      sheet: "Resumen",
      columns: [{ width: 34 }, { width: 14 }, { width: 10 }, { width: 11 }, { width: 12 }, { width: 14 }],
    },
    {
      data: detalle,
      sheet: "Detalle",
      columns: columnasDetalle.map((c) => ({ width: c.ancho })),
      // La cabecera se queda fija al bajar por las filas
      stickyRowsCount: 1,
    },
    {
      data: personaProyecto,
      sheet: "Persona y proyecto",
      columns: [{ width: 24 }, { width: 30 }, { width: 11 }, { width: 9 }, { width: 9 }, { width: 11 }, { width: 13 }],
      stickyRowsCount: 1,
    },
  ]).toFile(`${opciones.nombre}.xlsx`)
}

/* --------------------------------------------------------------------- pdf */

export async function exportarPdf(entradas: EntradaVista[], opciones: OpcionesDescarga) {
  // jsPDF pesa: solo se carga cuando alguien pide el PDF de verdad
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const lista = filas(entradas, huso(opciones))
  const total = totalDe(lista)
  const { conImportes } = opciones

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const margen = { left: 40, right: 40 }
  const estiloTabla = {
    styles: { fontSize: 8, cellPadding: 3.5 },
    headStyles: { fillColor: [15, 20, 25] as [number, number, number], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 243, 245] as [number, number, number] },
    margin: margen,
  }
  const siguienteY = () =>
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 18

  doc.setFontSize(16)
  doc.text(opciones.espacio ? `Informe de horas · ${opciones.espacio}` : "Informe de horas", 40, 44)
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(`${formatDateShort(opciones.desde)} - ${formatDateShort(opciones.hasta)}`, 40, 62)
  if (opciones.filtros.length > 0) {
    doc.text(doc.splitTextToSize(opciones.filtros.join(" · "), 760), 40, 76)
  }

  doc.setTextColor(30)
  doc.setFontSize(11)
  const cifras = [
    `Horas: ${formatDurationShort(total.segundos)}`,
    `Facturable: ${formatDurationShort(total.facturables)}`,
    `Apuntes: ${total.apuntes.toLocaleString("es-ES")}`,
    ...(conImportes ? [`Importe: ${formatMoney(total.importe)}`] : []),
  ]
  const yCifras = opciones.filtros.length > 0 ? 100 : 84
  doc.text(cifras.join("      "), 40, yCifras)

  const tabla = (titulo: string, columna: string, grupos: Suma[], startY: number) => {
    autoTable(doc, {
      ...estiloTabla,
      startY,
      head: [[columna, "Duración", "%", "Facturable", ...(conImportes ? ["Importe"] : [])]],
      body: grupos.map((g) => [
        g.clave,
        formatDurationShort(g.segundos),
        `${Math.round(porcentaje(g.segundos, total.segundos) * 100)}%`,
        formatDurationShort(g.facturables),
        ...(conImportes ? [formatMoney(g.importe)] : []),
      ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      showHead: "firstPage",
      tableWidth: 360,
    })
    doc.setFontSize(10)
    doc.text(titulo, 40, startY - 6)
  }

  let y = yCifras + 24
  tabla("Por proyecto", "Proyecto", sumarPor(lista, (f) => f.proyecto || "Sin proyecto"), y)
  y = siguienteY()
  tabla("Por persona", "Persona", sumarPor(lista, (f) => f.persona), y + 10)

  doc.addPage()
  doc.setFontSize(12)
  doc.text("Detalle", 40, 40)
  autoTable(doc, {
    ...estiloTabla,
    startY: 50,
    head: [
      [
        "Fecha",
        "Horario",
        "Duración",
        "Persona",
        "Proyecto",
        "Tarea",
        "Descripción",
        ...(conImportes ? ["Importe"] : []),
      ],
    ],
    body: lista.map((f) => [
      formatDateShort(f.fecha),
      `${f.inicio.hora}–${f.fin.hora}`,
      formatDurationShort(f.segundos),
      f.persona,
      f.proyecto,
      f.tarea,
      f.descripcion,
      ...(conImportes ? [f.importe != null ? formatMoney(f.importe) : ""] : []),
    ]),
    columnStyles: { 2: { halign: "right" }, 6: { cellWidth: 230 } },
  })

  doc.save(`${opciones.nombre}.pdf`)
}
