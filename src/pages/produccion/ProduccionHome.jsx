import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccionResumen, produccionVisibilidad, produccionSemanal, calidadesProduccion } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, Save, Download, Trash2, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { exportStyledExcel } from "@/utils/excelExport";
import { CAMPOS_RESUMEN as CAMPOS } from "@/lib/produccionConstantes";

// Tabla 100% independiente, tal cual la pidió el cliente (imagen de
// referencia): sin valores predefinidos, sin fórmulas, sin enlace a
// "Ingresar Datos" ni a registros_produccion. Cada campo se llena a
// mano y se guarda en su propia tabla (produccion_resumen), un
// registro por fecha. La lista de columnas vive en produccionConstantes.js
// (CAMPOS_RESUMEN) para que "Configuración" pueda generar sus botones de
// mostrar/ocultar sobre la misma lista, sin duplicarla.

const formularioVacio = () =>
  CAMPOS.reduce((acc, { field }) => ({ ...acc, [field]: "" }), {});

// Helpers de semana (mismo criterio que Ingresar Datos)
function lunesDeSemanaDe(fechaStr) {
  const fecha = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  const diaSemana = fecha.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}
const DIA_A_CLAVE = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
function diaKeyDeFecha(fechaStr) {
  if (!fechaStr) return null;
  return DIA_A_CLAVE[new Date(fechaStr + "T00:00:00").getDay()] ?? null;
}

// Genera sectores de un pie chart SVG simple a partir de un array { label, value, color }
function PieChart({ datos, size = 160 }) {
  const total = datos.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-muted-foreground text-xs text-center py-4">Sin datos</p>;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  let startAngle = -Math.PI / 2;
  const COLORES = ["#16a34a","#2563eb","#dc2626","#d97706","#7c3aed","#0891b2","#be185d","#059669","#4f46e5","#b45309"];
  const sectores = datos.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const endAngle = startAngle + angle;
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const sector = { path, color: d.color || COLORES[i % COLORES.length], label: d.label, value: d.value };
    startAngle = endAngle;
    return sector;
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {sectores.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {sectores.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span>{s.label}: {s.value.toLocaleString("es-EC")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProduccionHome() {
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  // Fecha que controla esta tabla. Cambiarla muestra el registro guardado
  // de ese día (si existe) o la tabla vacía y rellenable (si no existe).
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const { data: filasFecha = [], isLoading } = useQuery({
    queryKey: ["produccion-resumen", fechaSeleccionada],
    queryFn: async () => {
      const { data, error } = await produccionResumen.filter({ fecha: fechaSeleccionada });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Historial completo, solo para el botón "Exportar a Excel".
  const { data: historial = [] } = useQuery({
    queryKey: ["produccion-resumen-historial"],
    queryFn: async () => {
      const { data, error } = await produccionResumen.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Columnas ocultadas desde Configuración (produccion_visibilidad, grupo
  // 'produccion_columnas'). Solo afecta qué se muestra/exporta — los datos
  // ya guardados de una columna oculta no se borran ni dejan de cargarse.
  const { data: visibilidad = [] } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const ocultos = new Set(
    visibilidad
      .filter((v) => v.grupo === "produccion_columnas" && v.visible === false)
      .map((v) => v.clave)
  );
  const camposVisibles = CAMPOS.filter((c) => !ocultos.has(c.field));

  // Semana y día para las tablas de calidades
  const semana = lunesDeSemanaDe(fechaSeleccionada);
  const diaActual = diaKeyDeFecha(fechaSeleccionada);

  // Calidades configuradas
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  // Producción semanal de la semana seleccionada (para tabla de calidades)
  const { data: filasSemana = [] } = useQuery({
    queryKey: ["produccion-semanal-home", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  const calidadPorCodigo = Object.fromEntries(calidades.map((c) => [c.codigo, c]));

  // Datos para la tabla y pie chart: valor del día actual por calidad
  const datosCalidades = useMemo(() => {
    if (!diaActual) return [];
    return calidades.map((c) => {
      const fila = filasSemana.find((f) => f.codigo_producto === c.codigo);
      return {
        codigo: c.codigo,
        label: c.label,
        codigo_corto: c.codigo_corto,
        caj_default: c.caj_default,
        valor: Number(fila?.[diaActual]) || 0,
        total_semana: ["lunes","martes","miercoles","jueves","viernes","sabado"].reduce(
          (s, d) => s + (Number(fila?.[d]) || 0), 0
        ),
      };
    }).filter((d) => d.total_semana > 0 || d.valor > 0);
  }, [calidades, filasSemana, diaActual]);

  const filaActual = filasFecha[0] ?? null;

  // Valores locales del formulario. Se llenan con la fila guardada de la
  // fecha elegida, o quedan vacíos si esa fecha todavía no tiene datos.
  const [valores, setValores] = useState(formularioVacio());

  useEffect(() => {
    if (filaActual) {
      const inicial = {};
      CAMPOS.forEach(({ field }) => {
        inicial[field] = filaActual[field] ?? "";
      });
      setValores(inicial);
    } else {
      setValores(formularioVacio());
    }
  }, [filaActual?.id, fechaSeleccionada]);

  const handleChange = (field, value) => {
    setValores((prev) => ({ ...prev, [field]: value }));
  };

  // Guardado explícito (botón), no automático al salir del campo: el
  // cliente pidió un botón de Guardar que funcione para esta tabla.
  const handleGuardar = async () => {
    setGuardando(true);
    const payload = { fecha: fechaSeleccionada };
    CAMPOS.forEach(({ field }) => {
      const raw = valores[field];
      payload[field] = raw === "" || raw === null || raw === undefined ? null : parseFloat(raw);
    });

    const { error } = filaActual
      ? await produccionResumen.update(filaActual.id, payload)
      : await produccionResumen.create(payload);

    setGuardando(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Datos guardados");
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen", fechaSeleccionada] });
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen-historial"] });
  };

  // Borra el resumen guardado de la fecha seleccionada (produccion_resumen).
  // Acción irreversible: se confirma antes de ejecutar.
  const handleBorrar = async () => {
    if (!filaActual) return;
    if (!confirm(`¿Eliminar el resumen de producción del ${fechaSeleccionada}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBorrando(true);
    const { error } = await produccionResumen.delete(filaActual.id);
    setBorrando(false);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Registro eliminado");
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen", fechaSeleccionada] });
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen-historial"] });
  };

  const handleExportar = () => {
    if (historial.length === 0) {
      toast.error("No hay datos guardados para exportar");
      return;
    }
    const headers = ["Fecha", ...camposVisibles.map((c) => c.label)];
    const rows = historial.map((fila) => [
      fila.fecha,
      ...camposVisibles.map((c) => fila[c.field] ?? ""),
    ]);
    exportStyledExcel({
      title: "Producción — Resumen por Día",
      headers,
      rows,
      sheetName: "Produccion",
      fileName: `produccion_resumen_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Tabla de resumen por día</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Label htmlFor="fecha-produccion" className="text-sm font-medium whitespace-nowrap">
            Fecha
          </Label>
          <Input
            id="fecha-produccion"
            type="date"
            className="sm:w-48"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver el resumen guardado de ese día. Si no tiene datos
            guardados, la tabla aparece vacía y lista para llenar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-center text-muted-foreground border-b bg-muted/30">
                  {camposVisibles.map(({ field, label }) => (
                    <th key={field} className="py-2 px-3 whitespace-nowrap">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {camposVisibles.map(({ field }) => (
                    <td key={field} className="py-1 px-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 text-center rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={valores[field] ?? ""}
                        onChange={(e) => handleChange(field, e.target.value)}
                        placeholder="—"
                        disabled={isLoading}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 mt-4">
        <Button onClick={handleGuardar} disabled={guardando}>
          <Save className="w-4 h-4" />
          {guardando ? "Guardando..." : "Guardar"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleBorrar}
          disabled={!filaActual || borrando}
        >
          <Trash2 className="w-4 h-4" />
          {borrando ? "Eliminando..." : "Borrar Registro"}
        </Button>
        <Button variant="outline" onClick={handleExportar}>
          <Download className="w-4 h-4" />
          Exportar a Excel
        </Button>
      </div>

      {/* ── Tabla de calidades + pie chart ──────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                Producción de Calidades
                {diaActual ? ` — ${fechaSeleccionada}` : ""}
              </h2>
            </div>
            {!diaActual ? (
              <p className="text-muted-foreground text-xs text-center py-6">
                Selecciona una fecha de lunes a sábado.
              </p>
            ) : datosCalidades.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-6">
                Sin datos para esta semana.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/30 text-xs">
                      <th className="py-2 px-3 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Cajas Día</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Total Semana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosCalidades.map((d) => (
                      <tr key={d.codigo} className="border-b last:border-0">
                        <td className="py-1.5 px-3 font-medium whitespace-nowrap">{d.label}</td>
                        <td className="py-1.5 px-2 text-center">{d.valor || "—"}</td>
                        <td className="py-1.5 px-2 text-center font-semibold">{d.total_semana || "—"}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 px-3">TOTAL</td>
                      <td className="py-2 px-2 text-center">
                        {datosCalidades.reduce((s, d) => s + d.valor, 0) || "—"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {datosCalidades.reduce((s, d) => s + d.total_semana, 0) || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Distribución Calidades (semana)</h2>
            </div>
            {datosCalidades.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-6">Sin datos.</p>
            ) : (
              <PieChart
                datos={datosCalidades.map((d) => ({
                  label: d.codigo_corto || d.codigo,
                  value: d.total_semana,
                }))}
                size={180}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
