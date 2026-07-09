import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  produccion,
  produccionSemanal,
  produccionCajasPalet,
  produccionVisibilidad,
  calidadesProduccion,
} from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2, Plus, ListTree, Download, FileSpreadsheet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso } from "@/lib/produccionCalc";
import { exportStyledWorkbook } from "@/utils/excelExport";
import { useAuth } from "@/lib/AuthContext";

// --- Tablas semanales (migradas desde la antigua página "Inventario
// Semanal", ahora integradas aquí en "Ingresar Datos") ---
// Las calidades (antes CODIGOS_SEMANA/CALIDAD_LABEL/CODIGO_CORTO/CAJ_DEFAULT
// fijas en produccionConstantes.js) ahora viven en la tabla Supabase
// calidades_produccion y son editables desde "Configuración".

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
  // modoEdicion: true mientras el usuario edita un registro ya guardado.
  // false = lectura (formulario deshabilitado, botones Editar+Eliminar visibles).
  const [modoEdicion, setModoEdicion] = useState(false);

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

  // Si la fecha elegida ya tiene un registro guardado, precargar el
  // formulario con sus valores (antes siempre quedaba vacío y "Guardar"
  // creaba un duplicado). Si no existe, el formulario queda vacío para
  // crear uno nuevo.
  useEffect(() => {
    if (ultimo) {
      const inicial = { calibre: ultimo.calibre ?? "" };
      NUMERIC_FIELDS.forEach((f) => {
        inicial[f] = ultimo[f] ?? "";
      });
      setForm(inicial);
    } else {
      setForm(emptyForm);
    }
    // Salir de modo edición al cambiar de fecha (el registro cambia).
    setModoEdicion(false);
  }, [ultimo?.id, fechaSeleccionada]);

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

  // Calidades ocultadas desde Configuración (produccion_visibilidad, grupo
  // 'ingresar_calidades'). Solo afecta qué filas se muestran/exportan en
  // las tablas de abajo — los datos guardados de una calidad oculta no se
  // borran, y los TOTALES siguen sumando todas las calidades (decisión
  // confirmada con el cliente: ocultar es solo visual/exportación).
  const { data: visibilidad = [] } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const codigosOcultos = new Set(
    visibilidad
      .filter((v) => v.grupo === "ingresar_calidades" && v.visible === false)
      .map((v) => v.clave)
  );

  // Calidades de "Ingresar Datos" — antes lista fija (CODIGOS_SEMANA), ahora
  // editable desde Configuración (tabla calidades_produccion).
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const calidadPorCodigo = Object.fromEntries(calidades.map((c) => [c.codigo, c]));
  const todosCodigos = calidades.map((c) => c.codigo);
  const codigosVisibles = todosCodigos.filter((c) => !codigosOcultos.has(c));

  const [valoresGrid, setValoresGrid] = useState({});
  useEffect(() => {
    const inicial = {};
    todosCodigos.forEach((codigo) => {
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
  }, [filasSemana, semana, calidades]);

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
    todosCodigos.reduce((suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.[diaKey]), 0);

  const granTotalSemana = todosCodigos.reduce((suma, codigo) => suma + totalPorCodigo(codigo), 0);

  // TOTAL PALETAS por calidad = Total Cajas (semanal) / Cajas por Paleta (caj_default).
  // Sigue existiendo para el acumulado semanal (exportación, etc.).
  const totalPaletasPorCodigo = (codigo) => {
    const total = totalPorCodigo(codigo);
    const cajDefault = Number(calidadPorCodigo[codigo]?.caj_default);
    if (!cajDefault) return null;
    return total / cajDefault;
  };
  const granTotalPaletas = codigosVisibles.reduce(
    (s, c) => s + (totalPaletasPorCodigo(c) ?? 0),
    0
  );

  // TOTAL PALETAS solo del día seleccionado (confirmado por cliente PDF:
  // la columna PALETAS de la tabla semanal y "Total Paletas" en Resumen
  // deben mostrar el día, no el acumulado de la semana).
  const totalPaletasPorCodigoDia = (codigo) => {
    if (!diaActual) return null;
    const cajas = numeroSemana(valoresGrid[codigo]?.[diaActual]);
    const cajDefault = Number(calidadPorCodigo[codigo]?.caj_default);
    if (!cajDefault || !cajas) return null;
    return cajas / cajDefault;
  };
  const granTotalPaletasDia = diaActual
    ? codigosVisibles.reduce((s, c) => s + (totalPaletasPorCodigoDia(c) ?? 0), 0)
    : 0;

  // Total de Caj.Prog del día (tabla "Resumen de Producción"). Independiente
  // de totalPorDia, que suma la columna "Total".
  const totalCajProgPorDia = (diaKey) =>
    todosCodigos.reduce(
      (suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.[`caj_prog_${diaKey}`]),
      0
    );

  const inputClaseSemana =
    "w-16 text-center rounded-md border border-input bg-background px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40";

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
    // Si la fecha ya tiene registro, actualizarlo en vez de crear un duplicado.
    const { error } = ultimo
      ? await produccion.update(ultimo.id, payload)
      : await produccion.create(payload);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success(ultimo ? "Registro actualizado" : "Registro de producción guardado");
    setModoEdicion(false);
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  // Borra el registro de la fecha seleccionada. Acción irreversible: se
  // confirma antes de ejecutar.
  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar el registro de este día? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    const { error } = await produccion.delete(id);
    setDeletingId(null);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Registro eliminado");
    setModoEdicion(false);
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  // Guarda explícitamente todas las celdas del día (cajas + caj_prog) para
  // todos los códigos de la tabla semanal y del Resumen de Producción.
  const [savingGrid, setSavingGrid] = useState(false);

  // false = solo-lectura, true = celdas editables. Independiente para cada tabla.
  const [modoEdicionSemanal, setModoEdicionSemanal] = useState(false);
  const [modoEdicionResumen, setModoEdicionResumen] = useState(false);

  // Estado de guardado independiente para cada tabla.
  const [savingResumen, setSavingResumen] = useState(false);

  // Hay CAJAS guardadas hoy en Supabase. Se basa en filasSemana (datos
  // persistidos), NO en valoresGrid (estado local), para que tipear un solo
  // dígito no active prematuramente el modo "ya guardado".
  const tieneDataHoy = diaActual
    ? filasSemana.some((f) => {
        const v = f[diaActual];
        return v !== null && v !== undefined;
      })
    : false;

  // Hay CAJ.PROG guardado hoy. Controla el Resumen de Producción de forma
  // independiente a la tabla de cajas de arriba.
  const tieneProgHoy = diaActual
    ? filasSemana.some((f) => {
        const v = f[`caj_prog_${diaActual}`];
        return v !== null && v !== undefined;
      })
    : false;

  // Guarda solo la columna CAJAS del día (Producción Semanal por Código).
  // Caj.Prog tiene su propio handleGuardarResumen.
  const handleGuardarGrid = async () => {
    if (!diaActual) {
      toast.error("Selecciona una fecha de lunes a sábado");
      return;
    }
    setSavingGrid(true);
    // Secuencial para evitar race condition en CREATE (un registro por código).
    for (const codigo of todosCodigos) {
      await handleBlurGrid(codigo, diaActual);
    }
    setSavingGrid(false);
    toast.success("Cajas guardadas");
    setModoEdicionSemanal(false);
  };

  // Guarda solo la columna CAJ.PROG del día (Resumen de Producción).
  const handleGuardarResumen = async () => {
    if (!diaActual) {
      toast.error("Selecciona una fecha de lunes a sábado");
      return;
    }
    setSavingResumen(true);
    for (const codigo of todosCodigos) {
      await handleBlurGrid(codigo, `caj_prog_${diaActual}`);
    }
    setSavingResumen(false);
    toast.success("Caj.Prog guardado");
    setModoEdicionResumen(false);
  };

  // Limpia solo las CAJAS del día (Producción Semanal por Código).
  const handleLimpiarDia = async () => {
    if (!diaActual) return;
    if (!confirm(`¿Limpiar las CAJAS del ${diaActualLabel}? Esta acción no se puede deshacer.`)) return;
    setSavingGrid(true);
    await Promise.all(
      todosCodigos.map(async (codigo) => {
        const fila = valoresGrid[codigo];
        if (!fila?.id) return;
        const { error } = await produccionSemanal.update(fila.id, { [diaActual]: null });
        if (error) toast.error(`Error al limpiar ${codigo}: ${error.message}`);
      })
    );
    setSavingGrid(false);
    toast.success("Cajas del día limpiadas");
    queryClient.invalidateQueries({ queryKey: ["produccion-semanal", semana] });
  };

  // Limpia Caj.Prog del día (Resumen de Producción).
  const handleLimpiarResumen = async () => {
    if (!diaActual) return;
    if (!confirm(`¿Limpiar Caj.Prog del ${diaActualLabel}? Esta acción no se puede deshacer.`)) return;
    setSavingResumen(true);
    await Promise.all(
      todosCodigos.map(async (codigo) => {
        const fila = valoresGrid[codigo];
        if (!fila?.id) return;
        const { error } = await produccionSemanal.update(fila.id, {
          [`caj_prog_${diaActual}`]: null,
        });
        if (error) toast.error(`Error al limpiar ${codigo}: ${error.message}`);
      })
    );
    setSavingResumen(false);
    toast.success("Caj.Prog limpiado");
    queryClient.invalidateQueries({ queryKey: ["produccion-semanal", semana] });
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
      <td className="py-1 pr-2 text-muted-foreground text-xs">{label}</td>
      <td className="py-1 text-right font-medium text-xs">{valor ?? "—"}</td>
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
          ["DESPERDICIO RAC. RECH.", porcentaje(calculado?.desperdicioMonte) ?? ""],
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
        headers: ["Código", "TOTAL CAJAS", "TOTAL PALETAS"],
        rows: codigosVisibles.map((codigo) => [
          codigo,
          valoresGrid[codigo]?.[diaActual] ?? "",
          totalPaletasPorCodigoDia(codigo)?.toFixed(2) || "",
        ]),
        totalsRow: ["TOTAL", totalPorDia(diaActual) || "", granTotalPaletasDia > 0 ? granTotalPaletasDia.toFixed(2) : ""],
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

      {/* Grid de 3 columnas iguales: sin overflow horizontal, cada columna
          se comprime a 1/3 del ancho disponible (min-w-0 permite shrink). */}
      <div className="pb-2">
      <div className="grid grid-cols-3 gap-4 mb-4 items-start">
      <div className="space-y-4 min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {ultimo && !modoEdicion ? "Registro Diario (solo lectura)" : "Nuevo Registro Diario"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Wrapper de solo lectura: deshabilita todos los inputs cuando hay
              un registro guardado y el usuario no ha pulsado Editar. */}
          <div className={ultimo && !modoEdicion ? "pointer-events-none opacity-60 select-none" : ""}>
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
          </div>{/* fin wrapper solo-lectura */}

          {/* Botones: Guardar (solo cuando no hay registro o estamos editando),
              Editar (solo cuando existe un registro en readonly) y
              Eliminar (solo cuando existe un registro). */}
          <div className="flex flex-wrap gap-2 mt-2">
            {(!ultimo || modoEdicion) && (
              <Button onClick={handleSave} disabled={saving || !fechaSeleccionada} className="w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar Registro"}
              </Button>
            )}
            {ultimo && !modoEdicion && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setModoEdicion(true)}
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            {ultimo && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => handleDelete(ultimo.id)}
                disabled={deletingId === ultimo?.id}
              >
                <Trash2 className="w-4 h-4" />
                {deletingId === ultimo?.id ? "Eliminando..." : "Eliminar"}
              </Button>
            )}
          </div>
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
            <div>
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-1.5 px-2 text-left">Calidad</th>
                    <th className="py-1.5 px-1">CAJ/PAL</th>
                    <th className="py-1.5 px-1">Cod</th>
                    <th className="py-1.5 px-1">CAJAS</th>
                    <th className="py-1.5 px-1">PALETAS</th>
                  </tr>
                </thead>
                <tbody>
                  {codigosVisibles.map((codigo) => (
                    <tr key={codigo} className="border-b last:border-0">
                      <td className="py-1 px-2 font-medium">{calidadPorCodigo[codigo]?.label ?? codigo}</td>
                      <td className="py-1 px-1 text-center text-muted-foreground">
                        {calidadPorCodigo[codigo]?.caj_default ?? "—"}
                      </td>
                      <td className="py-1 px-1 text-center text-muted-foreground">
                        {calidadPorCodigo[codigo]?.codigo_corto ?? "—"}
                      </td>
                      <td className="py-0.5 px-1">
                        <input
                          type="number"
                          step="1"
                          className={inputClaseSemana}
                          value={valoresGrid[codigo]?.[diaActual] ?? ""}
                          onChange={(e) => handleChangeGrid(codigo, diaActual, e.target.value)}
                          onBlur={() => handleBlurGrid(codigo, diaActual)}
                          disabled={tieneDataHoy && !modoEdicionSemanal}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1 px-1 text-center">
                        {(() => {
                          const p = totalPaletasPorCodigoDia(codigo);
                          return p !== null && p > 0 ? p.toFixed(2) : "—";
                        })()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="py-1.5 px-2" colSpan={3}>TOTAL</td>
                    <td className="py-1.5 px-1 text-center">{totalPorDia(diaActual) || "—"}</td>
                    <td className="py-1.5 px-1 text-center">{granTotalPaletasDia > 0 ? granTotalPaletasDia.toFixed(2) : "—"}</td>
                  </tr>
                </tbody>
              </table>

              {/* Botones al fondo — mismo patrón que "Nuevo Registro Diario" */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {(!tieneDataHoy || modoEdicionSemanal) && (
                  <Button onClick={handleGuardarGrid} disabled={savingGrid || !diaActual}>
                    <Plus className="w-4 h-4" />
                    {savingGrid ? "Guardando..." : "Guardar"}
                  </Button>
                )}
                {tieneDataHoy && !modoEdicionSemanal && (
                  <>
                    <Button variant="outline" onClick={() => setModoEdicionSemanal(true)}>
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button variant="destructive" onClick={handleLimpiarDia} disabled={savingGrid}>
                      <Trash2 className="w-4 h-4" />
                      Limpiar Día
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      </div>

      <div className="space-y-4 min-w-0">
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
            <table className="text-xs w-full leading-tight">
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
                <FilaProceso label="DESPERDICIO RAC. RECH." valor={porcentaje(calculado?.desperdicioMonte)} />
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
        </CardContent>
      </Card>

      </div>

      {/* Columna 3: Resumen de Producción */}
      <div className="space-y-4 min-w-0">
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
          <table className="text-xs mb-4 border rounded-md overflow-hidden w-full">
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="py-1 px-2 font-semibold w-16">Finca</td>
                <td className="py-1 px-2">{currentUser?.finca?.nombre || "—"}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 font-semibold w-16">Fecha</td>
                <td className="py-1 px-2">{fechaSeleccionada}</td>
              </tr>
            </tbody>
          </table>

          {!diaActual ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Elige una fecha de lunes a sábado para ver este resumen.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr className="text-center text-muted-foreground border-b bg-muted/30">
                      <th className="py-1.5 px-1">Caj.Prog</th>
                      <th className="py-1.5 px-1 text-left">Cód</th>
                      <th className="py-1.5 px-1 text-left">Calidad</th>
                      <th className="py-1.5 px-1">Total</th>
                      <th className="py-1.5 px-1">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codigosVisibles.map((calidad) => {
                      const campoCajProg = `caj_prog_${diaActual}`;
                      const total = numeroSemana(valoresGrid[calidad]?.[diaActual]);
                      const cajProg = numeroSemana(valoresGrid[calidad]?.[campoCajProg]);
                      const dif = total - cajProg;
                      return (
                        <tr key={calidad} className="border-b last:border-0">
                          <td className="py-0.5 px-1 text-center">
                            <input
                              type="number"
                              className={inputClaseSemana}
                              value={valoresGrid[calidad]?.[campoCajProg] ?? ""}
                              onChange={(e) => handleChangeGrid(calidad, campoCajProg, e.target.value)}
                              onBlur={() => handleBlurGrid(calidad, campoCajProg)}
                              disabled={tieneProgHoy && !modoEdicionResumen}
                            />
                          </td>
                          <td className="py-1 px-1 font-medium">
                            {calidadPorCodigo[calidad]?.codigo_corto ?? "—"}
                          </td>
                          <td className="py-1 px-1">{calidadPorCodigo[calidad]?.label ?? calidad}</td>
                          <td className="py-1 px-1 text-center font-semibold">{total || "—"}</td>
                          <td className="py-1 px-1 text-center">{dif || "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-1.5 px-1 text-center">{totalCajProgPorDia(diaActual) || "—"}</td>
                      <td className="py-1.5 px-1" colSpan={2}>TOTAL</td>
                      <td className="py-1.5 px-1"></td>
                      <td className="py-1.5 px-1"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table className="text-xs w-full">
                <tbody>
                  <FilaProceso label="Total Cajas" valor={redondear(calculado?.cajasTotal)} />
                  <FilaProceso label="Total Paletas" valor={granTotalPaletasDia > 0 ? granTotalPaletasDia.toFixed(2) : "—"} />
                  <FilaProceso label="Cajas Tercera" valor={ultimo?.cajas_tercera ?? "—"} />
                  <FilaProceso label="Rac. Cosechados" valor={ultimo?.racimos_cosechados ?? "—"} />
                  <FilaProceso label="Racimos Rechazados" valor={ultimo?.racimos_rechazados ?? "—"} />
                  <FilaProceso label="Racimos Procesados" valor={calculado?.racimosProcesados ?? "—"} />
                  <FilaProceso label="Área Cosecha Día" valor={ultimo?.acres ?? "—"} />
                  <FilaProceso label="% Área Cosecha Día" valor={porcentaje(areaCosechaPct) ?? "—"} />
                  <FilaProceso label="Factor Primera" valor={redondear(calculado?.factorPrimera)} />
                  <FilaProceso label="Factor General" valor={redondear(calculado?.factorGeneral)} />
                  <FilaProceso label="DESPERDICIO RAC. RECH." valor={porcentaje(calculado?.desperdicioMonte)} />
                  <FilaProceso label="Desperdicio Real" valor={porcentaje(calculado?.desperdicioGeneral)} />
                  <FilaProceso label="Rechazo en Camión (Quintal)" valor={ultimo?.quintales_rechazo ?? "—"} />
                </tbody>
              </table>

              {/* Botones Resumen — independientes de la tabla Producción Semanal */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {(!tieneProgHoy || modoEdicionResumen) && (
                  <Button onClick={handleGuardarResumen} disabled={savingResumen || !diaActual}>
                    <Plus className="w-4 h-4" />
                    {savingResumen ? "Guardando..." : "Guardar"}
                  </Button>
                )}
                {tieneProgHoy && !modoEdicionResumen && (
                  <>
                    <Button variant="outline" onClick={() => setModoEdicionResumen(true)}>
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button variant="destructive" onClick={handleLimpiarResumen} disabled={savingResumen}>
                      <Trash2 className="w-4 h-4" />
                      Limpiar Día
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

        </CardContent>
      </Card>
      </div>
      </div>{/* cierra grid-cols-3 */}
      </div>{/* cierra pb-2 */}
    </div>
  );
}
