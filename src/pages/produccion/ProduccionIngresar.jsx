import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion, produccionSemanal, produccionCajasPalet } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2, Plus, ListTree, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso } from "@/lib/produccionCalc";
import { exportStyledWorkbook } from "@/utils/excelExport";
import { useAuth } from "@/lib/AuthContext";

// --- Tablas semanales (migradas desde la antigua página "Inventario
// Semanal", ahora integradas aquí en "Ingresar Datos") ---
const CODIGOS_SEMANA = [
  "DMD", "DM9", "PRIM", "PREM", "3LB", "IP", "24COUNT",
  "ROSY NORMAL", "ROSY CONSUMER", "DM BANABAC", "DM BANABAC MINI", "3LBS",
];

// Código corto (columna "CODIGO" de la hoja real) que corresponde a cada
// calidad de CODIGOS_SEMANA (columna "CALIDAD"). Tomado tal cual del Excel
// del cliente (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12). "24COUNT"
// tenía 2 códigos en el Excel (C39 y G39); se deja un único código porque
// la app maneja 12 calidades, no 13 (decisión confirmada con el cliente).
const CODIGO_CORTO = {
  DMD: "C68",
  DM9: "C23",
  PRIM: "CH1",
  PREM: "G01",
  "3LB": "CQ2",
  IP: "CH7",
  "24COUNT": "C39",
  "ROSY NORMAL": "G05",
  "ROSY CONSUMER": "GQ5",
  "DM BANABAC": "GP7",
  "DM BANABAC MINI": "GP7",
  "3LBS": "CP9",
};

// Valor "CAJ." por default de cada calidad (columna fija de la hoja real,
// junto a "CODIGO"). Confirmado por el cliente sobre la imagen del Excel
// (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12).
const CAJ_DEFAULT = {
  DMD: 48,
  DM9: 48,
  PRIM: 48,
  PREM: 48,
  "3LB": 45,
  IP: 48,
  "24COUNT": 45,
  "ROSY NORMAL": 48,
  "ROSY CONSUMER": 48,
  "DM BANABAC": 54,
  "DM BANABAC MINI": 32,
  "3LBS": 48,
};

// Área total de la finca (en acres), usada como denominador de
// "% Área Cosecha Día" = Área Cosecha Día / ÁREA_TOTAL_FINCA_ACRES.
// Valor confirmado por el cliente (Excel: +"AREA COSECHA DIA ACRES"/260.6).
const AREA_TOTAL_FINCA_ACRES = 260.6;

const DIAS_SEMANA = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
];

// Devuelve la fecha (YYYY-MM-DD) del lunes de la semana que contiene
// `fechaStr`. Si no se pasa fechaStr, usa la semana actual.
function lunesDeSemanaDe(fechaStr) {
  const fecha = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  const diaSemana = fecha.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

// Día de la semana (clave de DIAS_SEMANA) correspondiente a `fechaStr`.
// Devuelve null si cae en domingo (no hay columna para ese día).
const DIA_INDICE_A_CLAVE = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
function diaKeyDeFecha(fechaStr) {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr + "T00:00:00");
  return DIA_INDICE_A_CLAVE[fecha.getDay()] ?? null;
}

const numeroSemana = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Campos de "DATO BÁSICOS" tal como aparecen en la hoja real del cliente
// (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12). Los campos calculados
// ("DATOS DE PROCESO") NO se guardan aquí: se derivan en ProduccionHome.jsx
// y ProduccionReporteria.jsx a partir de estos valores.
const emptyForm = {
  hora_inicio: "",
  hora_salida: "",
  tiempo_perdido: "",
  cuadrilla: "",
  empaque: "",
  acres: "",
  racimos_cosechados: "",
  racimos_rechazados: "",
  no_manos: "",
  peso_pinzote: "",
  calibre: "",
  quintales_rechazo: "",
  cajas_tercera: "",
  cajas_primera: "",
  cajas_segunda: "",
};

const NUMERIC_FIELDS = [
  "hora_inicio", "hora_salida", "tiempo_perdido", "cuadrilla", "empaque", "acres",
  "racimos_cosechados", "racimos_rechazados", "no_manos", "peso_pinzote",
  "quintales_rechazo", "cajas_tercera", "cajas_primera", "cajas_segunda",
];

export default function ProduccionIngresar() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Fecha única que controla TODA la sección "Ingresar Datos": el registro
  // diario, la producción semanal por código y cajas/palet por día. Antes
  // existían 2 selectores de fecha independientes; ahora solo hay uno.
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  // El registro que coincide con la fecha seleccionada (no siempre el más
  // reciente): así "Datos de Proceso" cambia junto con la fecha de arriba.
  const ultimo = registros.find((r) => r.fecha === fechaSeleccionada) ?? null;
  const calculado = ultimo ? calcularDatosProceso(ultimo) : null;

  // % Área Cosecha Día = Área Cosecha Día (acres) / área total de la finca.
  // Fórmula confirmada por el cliente sobre el Excel real.
  const areaCosechaPct =
    ultimo?.acres != null && ultimo.acres !== ""
      ? Number(ultimo.acres) / AREA_TOTAL_FINCA_ACRES
      : null;

  // --- Tablas semanales (migradas desde "Inventario Semanal") ---
  // La semana y el día visible se derivan de fechaSeleccionada; ya no son
  // selectores independientes.
  const semana = lunesDeSemanaDe(fechaSeleccionada);
  const diaActual = diaKeyDeFecha(fechaSeleccionada);
  const diaActualLabel = DIAS_SEMANA.find((d) => d.key === diaActual)?.label ?? null;

  const { data: filasSemana = [], isLoading: cargandoGrid } = useQuery({
    queryKey: ["produccion-semanal", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: filasCajasPalet = [], isLoading: cargandoCajasPalet } = useQuery({
    queryKey: ["produccion-cajas-palet", semana],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [valoresGrid, setValoresGrid] = useState({});
  useEffect(() => {
    const inicial = {};
    CODIGOS_SEMANA.forEach((codigo) => {
      const fila = filasSemana.find((f) => f.codigo_producto === codigo);
      inicial[codigo] = {
        id: fila?.id ?? null,
        lunes: fila?.lunes ?? "",
        martes: fila?.martes ?? "",
        miercoles: fila?.miercoles ?? "",
        jueves: fila?.jueves ?? "",
        viernes: fila?.viernes ?? "",
        sabado: fila?.sabado ?? "",
        meta: fila?.meta ?? "",
        // Caj.Prog: igual patrón que lunes..sabado, una columna por día
        // (decisión confirmada con el cliente: debe guardarse permanente
        // y distinto cada día, no una sola meta semanal).
        caj_prog_lunes: fila?.caj_prog_lunes ?? "",
        caj_prog_martes: fila?.caj_prog_martes ?? "",
        caj_prog_miercoles: fila?.caj_prog_miercoles ?? "",
        caj_prog_jueves: fila?.caj_prog_jueves ?? "",
        caj_prog_viernes: fila?.caj_prog_viernes ?? "",
        caj_prog_sabado: fila?.caj_prog_sabado ?? "",
      };
    });
    setValoresGrid(inicial);
  }, [filasSemana, semana]);

  const [valoresCajasPalet, setValoresCajasPalet] = useState({});
  useEffect(() => {
    const inicial = {};
    DIAS_SEMANA.forEach(({ key }) => {
      const fila = filasCajasPalet.find((f) => f.dia === key);
      inicial[key] = {
        id: fila?.id ?? null,
        cajas: fila?.cajas ?? "",
        palet: fila?.palet ?? "",
      };
    });
    setValoresCajasPalet(inicial);
  }, [filasCajasPalet, semana]);

  const handleChangeGrid = (codigo, campo, valor) => {
    setValoresGrid((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], [campo]: valor },
    }));
  };

  const handleBlurGrid = async (codigo, campo) => {
    const fila = valoresGrid[codigo];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filasSemana.find((f) => f.codigo_producto === codigo);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionSemanal.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      const { data, error } = await produccionSemanal.create({
        fecha_semana: semana,
        codigo_producto: codigo,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresGrid((prev) => ({
        ...prev,
        [codigo]: { ...prev[codigo], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-semanal", semana] });
  };

  const handleChangeCajasPalet = (dia, campo, valor) => {
    setValoresCajasPalet((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: valor },
    }));
  };

  const handleBlurCajasPalet = async (dia, campo) => {
    const fila = valoresCajasPalet[dia];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filasCajasPalet.find((f) => f.dia === dia);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionCajasPalet.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      const { data, error } = await produccionCajasPalet.create({
        fecha_semana: semana,
        dia,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresCajasPalet((prev) => ({
        ...prev,
        [dia]: { ...prev[dia], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-cajas-palet", semana] });
  };

  // Totales calculados en pantalla (no se guardan en la base de datos).
  const totalPorCodigo = (codigo) =>
    DIAS_SEMANA.reduce((suma, { key }) => suma + numeroSemana(valoresGrid[codigo]?.[key]), 0);

  const totalPorDia = (diaKey) =>
    CODIGOS_SEMANA.reduce((suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.[diaKey]), 0);

  const granTotalSemana = CODIGOS_SEMANA.reduce((suma, codigo) => suma + totalPorCodigo(codigo), 0);

  // Total de Caj.Prog del día (tabla "Resumen de Producción"). Independiente
  // de totalPorDia, que suma la columna "Total".
  const totalCajProgPorDia = (diaKey) =>
    CODIGOS_SEMANA.reduce(
      (suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.[`caj_prog_${diaKey}`]),
      0
    );

  const inputClaseSemana =
    "w-20 text-center rounded-md border border-input bg-background px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!fechaSeleccionada) {
      toast.error("La fecha es obligatoria");
      return;
    }
    setSaving(true);
    const payload = { fecha: fechaSeleccionada, calibre: form.calibre || null };
    NUMERIC_FIELDS.forEach((f) => {
      payload[f] = form[f] === "" ? null : parseFloat(form[f]);
    });
    const { error } = await produccion.create(payload);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Registro de producción guardado");
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await produccion.delete(id);
    setDeletingId(null);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  // Redondea valores calculados a 2 decimales, sin tocar null/undefined.
  const redondear = (valor) =>
    valor === null || valor === undefined || Number.isNaN(valor)
      ? null
      : Math.round(valor * 100) / 100;

  // Formatea un valor decimal (0.1257) como porcentaje con 2 decimales (12.57%).
  const porcentaje = (valor) =>
    valor === null || valor === undefined || Number.isNaN(valor)
      ? null
      : `${(valor * 100).toFixed(2)}%`;

  // Fila de solo lectura para el panel "Datos de Proceso".
  const FilaProceso = ({ label, valor }) => (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-right font-medium">{valor ?? "—"}</td>
    </tr>
  );

  // Exporta todas las tablas visibles de esta página (Datos de Proceso,
  // Producción Semanal, Cajas/Palet, Últimos Registros) a un solo Excel
  // con varias hojas, todas con formato profesional.
  const handleExportar = () => {
    const sheets = [];

    if (ultimo) {
      sheets.push({
        sheetName: "Datos de Proceso",
        title: `Datos de Proceso — ${ultimo.fecha}`,
        headers: ["Campo", "Valor"],
        rows: [
          ["Hora Inicio", ultimo.hora_inicio ?? ""],
          ["Hora Salida", ultimo.hora_salida ?? ""],
          ["Hrs. Trabajadas", redondear(calculado?.horasTrabajadas) ?? ""],
          ["Cuadrilla", ultimo.cuadrilla ?? ""],
          ["Empaque", ultimo.empaque ?? ""],
          ["Cajas Hora", redondear(calculado?.cajasHora) ?? ""],
          ["Cajas Persona", redondear(calculado?.cajasPersona) ?? ""],
          ["Cajas Empaque", redondear(calculado?.cajasEmpaque) ?? ""],
          ["Acres", ultimo.acres ?? ""],
          ["Hectáreas", redondear(calculado?.hectareas) ?? ""],
          ["Racimos Cosechados", ultimo.racimos_cosechados ?? ""],
          ["Racimos Rechazados", ultimo.racimos_rechazados ?? ""],
          ["Racimos Procesados", calculado?.racimosProcesados ?? ""],
          ["Factor 1ra", redondear(calculado?.factorPrimera) ?? ""],
          ["Factor General", redondear(calculado?.factorGeneral) ?? ""],
          ["Factor Potencial", redondear(calculado?.factorPotencial) ?? ""],
          ["Desperdicio del Monte", porcentaje(calculado?.desperdicioMonte) ?? ""],
          ["Desperdicio Real", porcentaje(calculado?.desperdicioGeneral) ?? ""],
          ["Peso Pinzote", ultimo.peso_pinzote ?? ""],
          ["Peso Racimo", redondear(calculado?.pesoRacimo) ?? ""],
          ["Número de Manos", ultimo.no_manos ?? ""],
          ["Calibre", ultimo.calibre ?? ""],
          ["Total Cajas", redondear(calculado?.cajasTotal) ?? ""],
          ["Libras Procesadas", redondear(calculado?.librasProcesadas) ?? ""],
          ["Quintales", ultimo.quintales_rechazo ?? ""],
          ["Tiempo Perdido", ultimo.tiempo_perdido ?? ""],
          ["Tercera", ultimo.cajas_tercera ?? ""],
        ],
      });
    }

    if (diaActual) {
      sheets.push({
        sheetName: "Produccion Semanal",
        title: `Producción Semanal por Código — semana del ${semana}`,
        headers: ["Código", diaActualLabel, "Total Semana"],
        rows: CODIGOS_SEMANA.map((codigo) => [
          codigo,
          valoresGrid[codigo]?.[diaActual] ?? "",
          totalPorCodigo(codigo) || "",
        ]),
        totalsRow: ["TOTAL", totalPorDia(diaActual) || "", granTotalSemana || ""],
      });

      sheets.push({
        sheetName: "Cajas y Palet",
        title: `Cajas / Palet — ${diaActualLabel}`,
        headers: ["Día", "Cajas", "Palet"],
        rows: [[
          diaActualLabel,
          valoresCajasPalet[diaActual]?.cajas ?? "",
          valoresCajasPalet[diaActual]?.palet ?? "",
        ]],
      });
    }

    if (registros.length > 0) {
      sheets.push({
        sheetName: "Ultimos Registros",
        title: "Últimos Registros",
        headers: ["Fecha", "Cuadrilla", "Racimos Cosech.", "Racimos Rechaz.", "Cajas 1ra", "Cajas 2da"],
        rows: registros.map((r) => [
          r.fecha,
          r.cuadrilla ?? "",
          r.racimos_cosechados ?? "",
          r.racimos_rechazados ?? "",
          r.cajas_primera ?? "",
          r.cajas_segunda ?? "",
        ]),
      });
    }

    if (sheets.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    exportStyledWorkbook({
      fileName: `ingresar_datos_${fechaSeleccionada}.xlsx`,
      sheets,
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Ingresar Datos</h1>
            <p className="text-muted-foreground text-sm">Datos básicos diarios de proceso</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportar}>
          <Download className="w-4 h-4" />
          Exportar a Excel
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Label htmlFor="fecha" className="text-sm font-medium whitespace-nowrap">
            Fecha de trabajo
          </Label>
          <Input
            id="fecha"
            type="date"
            className="sm:w-48"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Esta fecha controla todas las tablas de esta página.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
      <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nuevo Registro Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="hora_inicio" className="text-xs">Hora Inicio</Label>
              <Input id="hora_inicio" name="hora_inicio" type="number" min="0" max="23" placeholder="Ej: 7"
                value={form.hora_inicio} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora_salida" className="text-xs">Hora Salida</Label>
              <Input id="hora_salida" name="hora_salida" type="number" min="0" max="23" placeholder="Ej: 17"
                value={form.hora_salida} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tiempo_perdido" className="text-xs">Tiempo Perdido (hrs)</Label>
              <Input id="tiempo_perdido" name="tiempo_perdido" type="number" min="0" step="0.1" placeholder="Ej: 0.5"
                value={form.tiempo_perdido} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuadrilla" className="text-xs">Cuadrilla (personas)</Label>
              <Input id="cuadrilla" name="cuadrilla" type="number" min="0" placeholder="Ej: 17"
                value={form.cuadrilla} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empaque" className="text-xs">Empaque (personas)</Label>
              <Input id="empaque" name="empaque" type="number" min="0" placeholder="Ej: 3"
                value={form.empaque} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acres" className="text-xs">Acres</Label>
              <Input id="acres" name="acres" type="number" min="0" step="0.1" placeholder="Ej: 80.4"
                value={form.acres} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="racimos_cosechados" className="text-xs">Racimos Cosechados</Label>
              <Input id="racimos_cosechados" name="racimos_cosechados" type="number" min="0" placeholder="Ej: 1367"
                value={form.racimos_cosechados} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="racimos_rechazados" className="text-xs">Racimos Rechazados</Label>
              <Input id="racimos_rechazados" name="racimos_rechazados" type="number" min="0" placeholder="Ej: 49"
                value={form.racimos_rechazados} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="no_manos" className="text-xs">No. Manos</Label>
              <Input id="no_manos" name="no_manos" type="number" min="0" placeholder="Ej: 8"
                value={form.no_manos} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="peso_pinzote" className="text-xs">Peso Pinzote</Label>
              <Input id="peso_pinzote" name="peso_pinzote" type="number" min="0" placeholder="Ej: 8"
                value={form.peso_pinzote} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calibre" className="text-xs">Calibre</Label>
              <Input id="calibre" name="calibre" placeholder="Ej: 40/41"
                value={form.calibre} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quintales_rechazo" className="text-xs">Quintales Rechazo</Label>
              <Input id="quintales_rechazo" name="quintales_rechazo" type="number" min="0" placeholder="Ej: 25"
                value={form.quintales_rechazo} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_tercera" className="text-xs">Cajas Tercera</Label>
              <Input id="cajas_tercera" name="cajas_tercera" type="number" min="0" placeholder="Ej: 226"
                value={form.cajas_tercera} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_primera" className="text-xs">Cajas 1ra</Label>
              <Input id="cajas_primera" name="cajas_primera" type="number" min="0" placeholder="Ej: 1518"
                value={form.cajas_primera} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_segunda" className="text-xs">Cajas 2da</Label>
              <Input id="cajas_segunda" name="cajas_segunda" type="number" min="0" placeholder="Ej: 48"
                value={form.cajas_segunda} onChange={handleChange} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !fechaSeleccionada} className="w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Registro"}
          </Button>
        </CardContent>
      </Card>

      {/* Tablas semanales migradas desde "Inventario Semanal" */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Producción Semanal por Código</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            {diaActualLabel
              ? `Mostrando: ${diaActualLabel} (semana del ${semana}) — según la fecha de arriba.`
              : "La fecha seleccionada cae en domingo, día sin columna en esta tabla."}
          </p>
        </CardHeader>
        <CardContent>
          {cargandoGrid ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : !diaActual ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Elige una fecha de lunes a sábado para ver esta tabla.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                    <th className="py-2 px-2 whitespace-nowrap">Caj.</th>
                    <th className="py-2 px-2 whitespace-nowrap">Cod</th>
                    <th className="py-2 px-2 whitespace-nowrap">{diaActualLabel}</th>
                    <th className="py-2 px-3 whitespace-nowrap">Total Semana</th>
                  </tr>
                </thead>
                <tbody>
                  {CODIGOS_SEMANA.map((codigo) => (
                    <tr key={codigo} className="border-b last:border-0">
                      <td className="py-1.5 px-3 font-medium whitespace-nowrap">{codigo}</td>
                      <td className="py-1.5 px-2 text-center text-muted-foreground">
                        {CAJ_DEFAULT[codigo] ?? "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center text-muted-foreground">
                        {CODIGO_CORTO[codigo] ?? "—"}
                      </td>
                      <td className="py-1 px-1">
                        <input
                          type="number"
                          step="1"
                          className={inputClaseSemana}
                          value={valoresGrid[codigo]?.[diaActual] ?? ""}
                          onChange={(e) => handleChangeGrid(codigo, diaActual, e.target.value)}
                          onBlur={() => handleBlurGrid(codigo, diaActual)}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-center font-semibold">{totalPorCodigo(codigo) || "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="py-2 px-3 whitespace-nowrap" colSpan={3}>TOTAL</td>
                    <td className="py-2 px-2 text-center">{totalPorDia(diaActual) || "—"}</td>
                    <td className="py-2 px-3 text-center">{granTotalSemana || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            La celda de {diaActualLabel ?? "cada día"} se escribe a mano y se
            guarda automáticamente al salir del campo. Total Semana y TOTAL se calculan sobre
            los 6 días de la semana, aunque aquí solo se vea uno a la vez.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cajas / Palet por Día</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            {diaActualLabel
              ? `Mostrando: ${diaActualLabel} — según la fecha de arriba.`
              : "La fecha seleccionada cae en domingo, día sin fila en esta tabla."}
          </p>
        </CardHeader>
        <CardContent>
          {cargandoCajasPalet ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : !diaActual ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Elige una fecha de lunes a sábado para ver esta tabla.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Día</th>
                    <th className="py-2 px-3 whitespace-nowrap">Cajas</th>
                    <th className="py-2 px-3 whitespace-nowrap">Palet</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b last:border-0">
                    <td className="py-1.5 px-3 font-medium whitespace-nowrap">{diaActualLabel}</td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        step="1"
                        className={inputClaseSemana}
                        value={valoresCajasPalet[diaActual]?.cajas ?? ""}
                        onChange={(e) => handleChangeCajasPalet(diaActual, "cajas", e.target.value)}
                        onBlur={() => handleBlurCajasPalet(diaActual, "cajas")}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        step="1"
                        className={inputClaseSemana}
                        value={valoresCajasPalet[diaActual]?.palet ?? ""}
                        onChange={(e) => handleChangeCajasPalet(diaActual, "palet", e.target.value)}
                        onBlur={() => handleBlurCajasPalet(diaActual, "palet")}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Se escribe a mano (sin fórmula confirmada todavía) y se guarda automáticamente
            al salir del campo.
          </p>
        </CardContent>
      </Card>
      </div>

      <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTree className="w-4 h-4" />
            Datos de Proceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ultimo ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Aún no hay registros. Guarda el primero para ver aquí los datos calculados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {/* Orden exacto del boceto Excel del cliente (INF. PROCESO E INVENTARIOS) */}
                <FilaProceso label="Hora Inicio" valor={ultimo.hora_inicio} />
                <FilaProceso label="Hora Salida" valor={ultimo.hora_salida} />
                <FilaProceso label="Hrs. Trabajadas" valor={redondear(calculado?.horasTrabajadas)} />
                <FilaProceso label="Cuadrilla" valor={ultimo.cuadrilla} />
                <FilaProceso label="Empaque" valor={ultimo.empaque} />
                <FilaProceso label="Cajas Hora" valor={redondear(calculado?.cajasHora)} />
                <FilaProceso label="Cajas Persona" valor={redondear(calculado?.cajasPersona)} />
                <FilaProceso label="Cajas Empaque" valor={redondear(calculado?.cajasEmpaque)} />
                <FilaProceso label="Acres" valor={ultimo.acres} />
                <FilaProceso label="Hectáreas" valor={redondear(calculado?.hectareas)} />
                <FilaProceso label="Racimos Cosechados" valor={ultimo.racimos_cosechados} />
                <FilaProceso label="Racimos Rechazados" valor={ultimo.racimos_rechazados} />
                <FilaProceso label="Racimos Procesados" valor={calculado?.racimosProcesados} />
                <FilaProceso label="Factor 1ra" valor={redondear(calculado?.factorPrimera)} />
                <FilaProceso label="Factor General" valor={redondear(calculado?.factorGeneral)} />
                <FilaProceso label="Factor Potencial" valor={redondear(calculado?.factorPotencial)} />
                <FilaProceso label="Desperdicio del Monte" valor={porcentaje(calculado?.desperdicioMonte)} />
                <FilaProceso label="Desperdicio Real" valor={porcentaje(calculado?.desperdicioGeneral)} />
                <FilaProceso label="Peso Pinzote" valor={ultimo.peso_pinzote} />
                <FilaProceso label="Peso Racimo" valor={redondear(calculado?.pesoRacimo)} />
                <FilaProceso label="Número de Manos" valor={ultimo.no_manos} />
                <FilaProceso label="Calibre" valor={ultimo.calibre} />
                <FilaProceso label="Total Cajas" valor={redondear(calculado?.cajasTotal)} />
                <FilaProceso label="Libras Procesadas" valor={redondear(calculado?.librasProcesadas)} />
                <FilaProceso label="Quintales" valor={ultimo.quintales_rechazo} />
                <FilaProceso label="Tiempo Perdido" valor={ultimo.tiempo_perdido} />
                <FilaProceso label="Tercera" valor={ultimo.cajas_tercera} />
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Día: <span className="font-medium text-foreground">{ultimo?.fecha ?? "—"}</span>.
            Todos los valores de "Datos de Proceso" se calculan automáticamente a partir de
            los datos básicos ingresados arriba.
          </p>
        </CardContent>
      </Card>

      {/* Tabla "FINCA / SEMANA" estilo reporte (boceto Excel, hoja LA
          GRACIA12). CAJ.PROG y DIF quedan pendientes a propósito: el Excel
          no tiene fórmula para CAJ.PROG (se escribe a mano) y la app
          todavía no tiene dónde guardarlo — decisión confirmada con el
          cliente. El resto de los campos sigue las fórmulas reales del
          Excel, relacionadas con datos que la app ya carga arriba. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Resumen de Producción
          </CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            {diaActualLabel
              ? `Mostrando: ${diaActualLabel} (semana del ${semana}) — según la fecha de arriba.`
              : "La fecha seleccionada cae en domingo, día sin datos en este resumen."}
          </p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm mb-4 border rounded-md overflow-hidden">
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="py-1.5 px-3 font-semibold w-28">Finca</td>
                <td className="py-1.5 px-3">{currentUser?.finca?.nombre || "—"}</td>
              </tr>
              <tr>
                <td className="py-1.5 px-3 font-semibold w-28">Semana</td>
                <td className="py-1.5 px-3">Semana del {semana}</td>
              </tr>
            </tbody>
          </table>

          {!diaActual ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Elige una fecha de lunes a sábado para ver este resumen.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="text-center text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-2 whitespace-nowrap">Caj.Prog</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-2 whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 whitespace-nowrap">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CODIGOS_SEMANA.map((calidad) => {
                      const campoCajProg = `caj_prog_${diaActual}`;
                      const total = numeroSemana(valoresGrid[calidad]?.[diaActual]);
                      const cajProg = numeroSemana(valoresGrid[calidad]?.[campoCajProg]);
                      const dif = total - cajProg;
                      return (
                        <tr key={calidad} className="border-b last:border-0">
                          <td className="py-1 px-2 text-center">
                            <input
                              type="number"
                              className={inputClaseSemana}
                              value={valoresGrid[calidad]?.[campoCajProg] ?? ""}
                              onChange={(e) => handleChangeGrid(calidad, campoCajProg, e.target.value)}
                              onBlur={() => handleBlurGrid(calidad, campoCajProg)}
                            />
                          </td>
                          <td className="py-1.5 px-3 font-medium whitespace-nowrap">
                            {CODIGO_CORTO[calidad] ?? "—"}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{calidad}</td>
                          <td className="py-1.5 px-2 text-center font-semibold">{total || "—"}</td>
                          <td className="py-1.5 px-2 text-center">{dif || "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 px-2 text-center">{totalCajProgPorDia(diaActual) || "—"}</td>
                      <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  <FilaProceso label="Total Cajas" valor={redondear(calculado?.cajasTotal)} />
                  <FilaProceso label="Total Paletas" valor={valoresCajasPalet[diaActual]?.palet || "—"} />
                  <FilaProceso label="Cajas Tercera" valor={ultimo?.cajas_tercera ?? "—"} />
                  <FilaProceso label="Rac. Cosechados" valor={ultimo?.racimos_cosechados ?? "—"} />
                  <FilaProceso label="Racimos Rechazados" valor={ultimo?.racimos_rechazados ?? "—"} />
                  <FilaProceso label="Racimos Procesados" valor={calculado?.racimosProcesados ?? "—"} />
                  <FilaProceso label="Área Cosecha Día" valor={ultimo?.acres ?? "—"} />
                  <FilaProceso label="% Área Cosecha Día" valor={porcentaje(areaCosechaPct) ?? "—"} />
                  <FilaProceso label="Factor Primera" valor={redondear(calculado?.factorPrimera)} />
                  <FilaProceso label="Factor General" valor={redondear(calculado?.factorGeneral)} />
                  <FilaProceso label="Desperdicio DM" valor={porcentaje(calculado?.desperdicioMonte)} />
                  <FilaProceso label="Desperdicio Real" valor={porcentaje(calculado?.desperdicioGeneral)} />
                  <FilaProceso label="Rechazo en Camión (Quintal)" valor={ultimo?.quintales_rechazo ?? "—"} />
                </tbody>
              </table>
            </>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            Caj.Prog se guarda por día (lunes a sábado) y Dif = Total - Caj.Prog. El resto sigue
            las fórmulas reales de "INF. PROCESO E INVENTARIOS" y se calcula con los datos que ya
            cargas arriba.
          </p>
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
