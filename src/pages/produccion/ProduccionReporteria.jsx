import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion, produccionCajasPalet, produccionCostos } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { BarChart3, Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso, calcularDatosProcesoAgregado } from "@/lib/produccionCalc";
import { exportStyledExcel } from "@/utils/excelExport";

// Reportería v2: UNA sola tabla (esquema de 18 columnas confirmado por el
// cliente) que se "transforma" entre Diario / Semanal / Mensual según el
// botón elegido — ya no son 3 layouts distintos, sino la misma config de
// columnas (ver COLUMNAS) alimentada por filas normalizadas según la vista.

// Lunes de la semana que contiene `fechaStr` — mismo criterio que usa
// "Ingresar Datos" (lunesDeSemanaDe en ProduccionIngresar.jsx), para que
// las semanas calcen exactamente con esa página.
function lunesDeSemanaDe(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  const diaSemana = fecha.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

// Número de semana calendario (ISO 8601) del lunes recibido.
function numeroSemanaISO(lunesStr) {
  const d = new Date(lunesStr + "T00:00:00");
  const diaNum = d.getDay() || 7; // lunes=1 ... domingo=7
  d.setDate(d.getDate() + 4 - diaNum); // jueves de esa misma semana
  const inicioAno = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - inicioAno) / 86400000 + 1) / 7);
}

// Clave de día (lunes..sabado, igual que produccion_cajas_palet.dia) para
// la fecha recibida. Devuelve null en domingo (no hay columna ese día).
const DIA_INDICE_A_CLAVE = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
function diaKeyDeFecha(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  return DIA_INDICE_A_CLAVE[fecha.getDay()] ?? null;
}

// Agrupa los registros diarios por semana (lunes a sábado) y suma el
// Total Palet correspondiente desde produccion_cajas_palet.
function agruparPorSemana(registros, filasCajasPalet) {
  const grupos = {};
  registros.forEach((r) => {
    if (!r.fecha) return;
    const lunes = lunesDeSemanaDe(r.fecha);
    if (!grupos[lunes]) grupos[lunes] = [];
    grupos[lunes].push(r);
  });

  return Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunes, filas]) => {
      const totalPalet = filasCajasPalet
        .filter((cp) => cp.fecha_semana === lunes)
        .reduce((acc, cp) => acc + (Number(cp.palet) || 0), 0);
      return {
        lunes,
        semanaNum: numeroSemanaISO(lunes),
        totalPalet,
        ...calcularDatosProcesoAgregado(filas),
      };
    });
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Agrupa los registros diarios por mes calendario de `anio`. SIEMPRE
// devuelve los 12 meses (en cero si no hay datos todavía), más una fila
// TOTAL recalculada sobre el año completo (no es la suma de los factores
// mensuales — mismo criterio "recalcular sobre sumas" del resto del archivo).
function agruparPorMes(registros, filasCajasPalet, anio) {
  const anioStr = String(anio);
  const registrosDelAno = registros.filter((r) => r.fecha?.slice(0, 4) === anioStr);

  const filas = MESES.map((nombre, idx) => {
    const mesNum = idx + 1;
    const mesStr = String(mesNum).padStart(2, "0");
    const registrosDelMes = registrosDelAno.filter((r) => r.fecha.slice(5, 7) === mesStr);
    // Total Palet del mes: semanas cuyo lunes (fecha_semana) cae en este
    // mes/año (una semana que cruza fin de mes se atribuye completa al
    // mes de su lunes — mismo criterio simplificado de Ingresar Datos).
    const totalPalet = filasCajasPalet
      .filter((cp) => cp.fecha_semana?.slice(0, 4) === anioStr && cp.fecha_semana?.slice(5, 7) === mesStr)
      .reduce((acc, cp) => acc + (Number(cp.palet) || 0), 0);
    return {
      mes: nombre,
      mesNum,
      anio: anioStr,
      totalPalet,
      ...calcularDatosProcesoAgregado(registrosDelMes),
    };
  });

  const totalPaletAno = filasCajasPalet
    .filter((cp) => cp.fecha_semana?.slice(0, 4) === anioStr)
    .reduce((acc, cp) => acc + (Number(cp.palet) || 0), 0);

  const totalAno = {
    mes: "TOTAL",
    mesNum: null,
    anio: anioStr,
    totalPalet: totalPaletAno,
    ...calcularDatosProcesoAgregado(registrosDelAno),
  };

  return { filas, totalAno };
}

// ============================================================
// ESQUEMA ÚNICO DE 18 COLUMNAS (transcripción exacta dada por el cliente,
// corregida: sin la columna "Total General" duplicada, con Cajas 2da
// como columna propia).
// ============================================================
const COLUMNAS = [
  { key: "racimosCosechados", label: "Racimos Cosechados", formato: "int" },
  { key: "racimosRechazados", label: "Racimos Rechazados", formato: "int" },
  { key: "pctRecorrido", label: "% Recorrido", formato: "pct" },
  { key: "cajasTotal", label: "Total Cajas 1ra y 2da", formato: "int" },
  { key: "cajasPrimera", label: "Cajas 1ra", formato: "int" },
  { key: "cajasSegunda", label: "Cajas 2da", formato: "int" },
  { key: "cajasTercera", label: "Cajas Tercera", formato: "int" },
  { key: "totalPalet", label: "Total Palet", formato: "int" },
  { key: "factorPrimera", label: "Factor Primera", formato: "dec2" },
  { key: "factorGeneral", label: "Factor General", formato: "dec2" },
  { key: "factorAprovechamiento", label: "Factor Aprovch.", formato: "dec2" },
  { key: "factorPotencial", label: "Factor Potencial", formato: "dec2" },
  { key: "quintalesRechazo", label: "QQ Rechazo", formato: "dec2" },
  { key: "pesoRacimo", label: "Peso de Racimo", formato: "dec2" },
  { key: "desperdicioGeneral", label: "% Desperdicio", formato: "pct" },
  { key: "horasTrabajadas", label: "Horas Planta", formato: "dec1" },
  { key: "horasPerdidas", label: "Horas Perdidas Planta", formato: "dec1" },
  { key: "costoCaja", label: "Costo Caja", formato: "costo" },
];

function formatearColumna(valor, formato, key) {
  if (key === "totalPalet" && !valor) return "—";
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  switch (formato) {
    case "int": return Math.round(valor).toLocaleString("es-EC");
    case "dec1": return Number(valor).toFixed(1);
    case "dec2": return Number(valor).toFixed(2);
    case "pct": return (Number(valor) * 100).toFixed(2) + "%";
    default: return String(valor);
  }
}

// Campos básicos editables de un registro diario (registros_produccion) —
// mismo set que el formulario "Nuevo Registro Diario" de Ingresar Datos
// (ver NUMERIC_FIELDS en ProduccionIngresar.jsx). Solo aplica a la vista
// Diario: cada fila ahí corresponde a 1 registro real. Semanal y Mensual
// son agregados de varios días y quedan de solo lectura.
const CAMPOS_EDITAR_DIARIO = [
  { field: "hora_inicio", label: "Hora Inicio" },
  { field: "hora_salida", label: "Hora Salida" },
  { field: "tiempo_perdido", label: "Tiempo Perdido (hrs)" },
  { field: "cuadrilla", label: "Cuadrilla" },
  { field: "empaque", label: "Empaque" },
  { field: "acres", label: "Acres" },
  { field: "racimos_cosechados", label: "Racimos Cosechados" },
  { field: "racimos_rechazados", label: "Racimos Rechazados" },
  { field: "no_manos", label: "No. Manos" },
  { field: "peso_pinzote", label: "Peso Pinzote" },
  { field: "calibre", label: "Calibre", texto: true },
  { field: "quintales_rechazo", label: "Quintales Rechazo" },
  { field: "cajas_primera", label: "Cajas 1ra" },
  { field: "cajas_segunda", label: "Cajas 2da" },
  { field: "cajas_tercera", label: "Cajas Tercera" },
];

// Construye la fila normalizada (mismas 18 claves) para cada granularidad.
function normalizarDiario(r, filasCajasPalet, costosMap) {
  const c = calcularDatosProceso(r);
  const lunes = r.fecha ? lunesDeSemanaDe(r.fecha) : null;
  const diaKey = r.fecha ? diaKeyDeFecha(r.fecha) : null;
  const filaPalet = filasCajasPalet.find((cp) => cp.fecha_semana === lunes && cp.dia === diaKey);
  const totalPalet = filaPalet ? Number(filaPalet.palet) || 0 : 0;
  const cajasTercera = Number(r.cajas_tercera) || 0;
  return {
    id: r.id,
    _raw: r, // registro original (registros_produccion), para Editar/Borrar
    label: r.fecha,
    racimosCosechados: Number(r.racimos_cosechados) || 0,
    racimosRechazados: Number(r.racimos_rechazados) || 0,
    pctRecorrido: c.pctRecorrido,
    cajasTotal: c.cajasTotal,
    cajasPrimera: Number(r.cajas_primera) || 0,
    cajasSegunda: Number(r.cajas_segunda) || 0,
    cajasTercera,
    totalPalet,
    factorPrimera: c.factorPrimera,
    factorGeneral: c.factorGeneral,
    factorAprovechamiento: c.factorAprovechamiento,
    factorPotencial: c.factorPotencial,
    quintalesRechazo: c.quintalesRechazo,
    pesoRacimo: c.pesoRacimo,
    desperdicioGeneral: c.desperdicioGeneral,
    horasTrabajadas: c.horasTrabajadas,
    horasPerdidas: c.horasPerdidas,
    periodoTipo: "diario",
    periodoKey: r.fecha,
    costoCaja: costosMap[`diario|${r.fecha}`] ?? "",
    editable: true,
    esTotal: false,
  };
}

function normalizarSemana(s, costosMap) {
  return {
    id: s.lunes,
    label: `Sem ${s.semanaNum}`,
    racimosCosechados: s.racimosCosechados,
    racimosRechazados: s.racimosRechazados,
    pctRecorrido: s.pctRecorrido,
    cajasTotal: s.cajasTotal,
    cajasPrimera: s.cajasPrimera,
    cajasSegunda: s.cajasSegunda,
    cajasTercera: s.cajasTercera,
    totalPalet: s.totalPalet,
    factorPrimera: s.factorPrimera,
    factorGeneral: s.factorGeneral,
    factorAprovechamiento: s.factorAprovechamiento,
    factorPotencial: s.factorPotencial,
    quintalesRechazo: s.quintalesRechazo,
    pesoRacimo: s.pesoRacimo,
    desperdicioGeneral: s.desperdicioGeneral,
    horasTrabajadas: s.horasTrabajadas,
    horasPerdidas: s.horasPerdidas,
    periodoTipo: "semanal",
    periodoKey: s.lunes,
    costoCaja: costosMap[`semanal|${s.lunes}`] ?? "",
    editable: true,
    esTotal: false,
  };
}

function normalizarMes(m, costosMap) {
  const esTotal = m.mesNum === null;
  const periodoKey = esTotal ? `${m.anio}-TOTAL` : `${m.anio}-${String(m.mesNum).padStart(2, "0")}`;
  return {
    id: periodoKey,
    label: m.mes,
    racimosCosechados: m.racimosCosechados,
    racimosRechazados: m.racimosRechazados,
    pctRecorrido: m.pctRecorrido,
    cajasTotal: m.cajasTotal,
    cajasPrimera: m.cajasPrimera,
    cajasSegunda: m.cajasSegunda,
    cajasTercera: m.cajasTercera,
    totalPalet: m.totalPalet,
    factorPrimera: m.factorPrimera,
    factorGeneral: m.factorGeneral,
    factorAprovechamiento: m.factorAprovechamiento,
    factorPotencial: m.factorPotencial,
    quintalesRechazo: m.quintalesRechazo,
    pesoRacimo: m.pesoRacimo,
    desperdicioGeneral: m.desperdicioGeneral,
    horasTrabajadas: m.horasTrabajadas,
    horasPerdidas: m.horasPerdidas,
    periodoTipo: "mensual",
    periodoKey,
    costoCaja: esTotal ? null : costosMap[`mensual|${periodoKey}`] ?? "",
    editable: !esTotal,
    esTotal,
  };
}

// Celda editable de Costo Caja — guarda en produccion_costos al perder foco.
function CostoCajaCell({ fila, onGuardado }) {
  const [valor, setValor] = useState(fila.costoCaja ?? "");

  useEffect(() => {
    setValor(fila.costoCaja ?? "");
  }, [fila.costoCaja, fila.periodoKey]);

  if (fila.esTotal) {
    return <td className="py-2 px-2 text-center">—</td>;
  }

  const guardar = async () => {
    const original = fila.costoCaja === "" || fila.costoCaja === null ? null : Number(fila.costoCaja);
    const nuevoValor = valor === "" ? null : parseFloat(valor);
    if (nuevoValor === original) return;
    const { error } = await produccionCostos.upsert(fila.periodoTipo, fila.periodoKey, nuevoValor);
    if (error) {
      toast.error("No se pudo guardar el costo: " + error.message);
      return;
    }
    onGuardado();
  };

  return (
    <td className="py-1 px-2 text-center">
      <input
        type="number"
        step="0.01"
        min="0"
        className="w-20 rounded border border-input bg-background px-1 py-0.5 text-sm text-center"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        placeholder="0.00"
      />
    </td>
  );
}

export default function ProduccionReporteria() {
  const queryClient = useQueryClient();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: filasCajasPalet = [] } = useQuery({
    queryKey: ["produccion-cajas-palet-historial"],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: costos = [] } = useQuery({
    queryKey: ["produccion-costos"],
    queryFn: async () => {
      const { data, error } = await produccionCostos.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const [vista, setVista] = useState("diario"); // "diario" | "semanal" | "mensual"

  // Edición/borrado de filas Diario (1 fila = 1 registro real en
  // registros_produccion). Semanal y Mensual son agregados, no se editan.
  const [editando, setEditando] = useState(null); // registro crudo en edición, o null
  const [formEdit, setFormEdit] = useState({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);

  const abrirEditar = (registro) => {
    const inicial = {};
    CAMPOS_EDITAR_DIARIO.forEach(({ field }) => {
      inicial[field] = registro[field] ?? "";
    });
    setFormEdit(inicial);
    setEditando(registro);
  };

  const handleChangeEdit = (field, value) => {
    setFormEdit((prev) => ({ ...prev, [field]: value }));
  };

  const handleGuardarEdit = async () => {
    if (!editando) return;
    setGuardandoEdit(true);
    const payload = {};
    CAMPOS_EDITAR_DIARIO.forEach(({ field, texto }) => {
      const raw = formEdit[field];
      payload[field] = raw === "" || raw === null || raw === undefined
        ? null
        : texto ? raw : parseFloat(raw);
    });
    const { error } = await produccion.update(editando.id, payload);
    setGuardandoEdit(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Registro actualizado");
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
    setEditando(null);
  };

  // Borra un registro diario. Acción irreversible: se confirma antes.
  const handleBorrarDiario = async (registro) => {
    if (!confirm(`¿Eliminar el registro del ${registro.fecha}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBorrandoId(registro.id);
    const { error } = await produccion.delete(registro.id);
    setBorrandoId(null);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Registro eliminado");
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  const resumenSemanal = useMemo(
    () => agruparPorSemana(registros, filasCajasPalet),
    [registros, filasCajasPalet]
  );

  // Años con datos (más el año actual, para que siempre haya algo que
  // elegir aunque todavía no se haya cargado producción).
  const aniosDisponibles = useMemo(() => {
    const anioActual = String(new Date().getFullYear());
    const anios = new Set([anioActual, ...registros.filter((r) => r.fecha).map((r) => r.fecha.slice(0, 4))]);
    return Array.from(anios).sort((a, b) => b.localeCompare(a));
  }, [registros]);

  const [anioSeleccionado, setAnioSeleccionado] = useState(() => String(new Date().getFullYear()));

  const resumenMensual = useMemo(
    () => agruparPorMes(registros, filasCajasPalet, anioSeleccionado),
    [registros, filasCajasPalet, anioSeleccionado]
  );

  const costosMap = useMemo(() => {
    const map = {};
    costos.forEach((c) => {
      map[`${c.periodo_tipo}|${c.periodo_key}`] = c.costo_caja;
    });
    return map;
  }, [costos]);

  const recargarCostos = () => queryClient.invalidateQueries({ queryKey: ["produccion-costos"] });

  const filasDiario = useMemo(
    () => registros.map((r) => normalizarDiario(r, filasCajasPalet, costosMap)),
    [registros, filasCajasPalet, costosMap]
  );
  const filasSemanal = useMemo(
    () => resumenSemanal.map((s) => normalizarSemana(s, costosMap)),
    [resumenSemanal, costosMap]
  );
  const filasMensual = useMemo(
    () => resumenMensual.filas.map((m) => normalizarMes(m, costosMap)),
    [resumenMensual, costosMap]
  );
  const filaTotalMensual = useMemo(
    () => normalizarMes(resumenMensual.totalAno, costosMap),
    [resumenMensual, costosMap]
  );

  const filasActuales = vista === "diario" ? filasDiario : vista === "semanal" ? filasSemanal : filasMensual;
  const etiquetaCol = vista === "diario" ? "Fecha" : vista === "semanal" ? "Semana" : "Mes";

  const handleExportar = () => {
    if (filasActuales.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = [etiquetaCol, ...COLUMNAS.map((c) => c.label)];
    const filasExport = vista === "mensual" ? [...filasActuales, filaTotalMensual] : filasActuales;
    const rows = filasExport.map((f) => [
      f.label,
      ...COLUMNAS.map((c) => {
        if (c.key === "costoCaja") return f.esTotal || f.costoCaja === "" || f.costoCaja == null ? "" : f.costoCaja;
        const valor = f[c.key];
        if (valor === null || valor === undefined) return "";
        if (c.formato === "pct") return (Number(valor) * 100).toFixed(2) + "%";
        if (c.formato === "int") return Math.round(Number(valor));
        if (c.formato === "dec1") return Number(valor).toFixed(1);
        if (c.formato === "dec2") return Number(valor).toFixed(2);
        return valor;
      }),
    ]);
    exportStyledExcel({
      title: `Reportería de Producción — ${vista === "diario" ? "Histórico Diario" : vista === "semanal" ? "Resumen Semanal" : "Resumen Mensual"}`,
      headers,
      rows,
      sheetName: "Reporteria",
      fileName: `reporteria_produccion_${vista}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Reportería de Producción</h1>
            <p className="text-muted-foreground text-sm">
              {vista === "diario" ? "Histórico diario" : vista === "semanal" ? "Resumen semanal" : "Resumen mensual"}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportar}>
          <Download className="w-4 h-4" />
          Exportar a Excel
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={vista === "diario" ? "default" : "outline"} onClick={() => setVista("diario")}>
          Diario
        </Button>
        <Button size="sm" variant={vista === "semanal" ? "default" : "outline"} onClick={() => setVista("semanal")}>
          Resumen Semanal
        </Button>
        <Button size="sm" variant={vista === "mensual" ? "default" : "outline"} onClick={() => setVista("mensual")}>
          Resumen Mensual
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            {vista === "diario" && `Registros (${filasActuales.length})`}
            {vista === "semanal" && `Resumen Semanal (${filasActuales.length} semanas)`}
            {vista === "mensual" && "Resumen Mensual"}
          </CardTitle>
          {vista === "mensual" && (
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
            >
              {aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : filasActuales.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hay datos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30 text-xs">
                    <th className="py-2 px-2 whitespace-nowrap text-left">{etiquetaCol}</th>
                    {COLUMNAS.map((col) => (
                      <th key={col.key} className="py-2 px-2 whitespace-nowrap">{col.label}</th>
                    ))}
                    {vista === "diario" && (
                      <th className="py-2 px-2 whitespace-nowrap">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filasActuales.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 text-center">
                      <td className="py-2 px-2 font-medium text-left whitespace-nowrap">{f.label}</td>
                      {COLUMNAS.map((col) => (
                        col.key === "costoCaja"
                          ? <CostoCajaCell key={col.key} fila={f} onGuardado={recargarCostos} />
                          : <td key={col.key} className="py-2 px-2">{formatearColumna(f[col.key], col.formato, col.key)}</td>
                      ))}
                      {vista === "diario" && (
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Editar"
                              onClick={() => abrirEditar(f._raw)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Eliminar"
                              disabled={borrandoId === f.id}
                              onClick={() => handleBorrarDiario(f._raw)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {vista === "mensual" && (
                    <tr className="text-center font-semibold bg-muted/40 border-t-2">
                      <td className="py-2 px-2 text-left">{filaTotalMensual.label}</td>
                      {COLUMNAS.map((col) => (
                        col.key === "costoCaja"
                          ? <td key={col.key} className="py-2 px-2">—</td>
                          : <td key={col.key} className="py-2 px-2">{formatearColumna(filaTotalMensual[col.key], col.formato, col.key)}</td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de edición — solo para filas de la vista Diario (1 fila =
          1 registro real en registros_produccion). */}
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar registro — {editando?.fecha}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2">
            {CAMPOS_EDITAR_DIARIO.map(({ field, label, texto }) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`edit_${field}`} className="text-xs">{label}</Label>
                <Input
                  id={`edit_${field}`}
                  type={texto ? "text" : "number"}
                  value={formEdit[field] ?? ""}
                  onChange={(e) => handleChangeEdit(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={handleGuardarEdit} disabled={guardandoEdit}>
              {guardandoEdit ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
