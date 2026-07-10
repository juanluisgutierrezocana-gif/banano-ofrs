import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, produccionSemanal, calidadesProduccion, settings } from "@/api/supabaseClient";
import { calcularDatosProceso } from "@/lib/produccionCalc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Factory, FileSpreadsheet, ClipboardList, PieChart as PieIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════
// ProduccionHome — Panel Resumen de Producción
//
// ANTES: tablas independientes (resumen_home y produccion_resumen).
// AHORA: lee exactamente las mismas tablas que "Ingresar Datos":
//   • "Datos del Día"  → registros_produccion (calcularDatosProceso)
//   • "Calidades"      → produccion_semanal para el día seleccionado
//
// Ambas secciones son SOLO LECTURA. Para ingresar o editar datos,
// ir a "Ingresar Datos" (/produccion/ingresar).
// ═══════════════════════════════════════════════════════════════════════════

// ── Helpers de semana y día (misma lógica que ProduccionIngresar) ─────────
function lunesDeSemanaDe(fechaStr) {
  const fecha = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  const diaSemana = fecha.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

const DIA_INDICE_A_CLAVE = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
function diaKeyDeFecha(fechaStr) {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr + "T00:00:00");
  return DIA_INDICE_A_CLAVE[fecha.getDay()] ?? null;
}

// ── Paleta de colores para el pie chart ───────────────────────────────────
const PIE_COLORS = [
  "#16a34a", "#22c55e", "#4ade80", "#86efac",
  "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd",
  "#f59e0b", "#fbbf24", "#ef4444", "#f97316", "#a855f7",
];

// ── Filas de la tabla "Datos del Día" ────────────────────────────────────
const STATS_FILAS = [
  { campo: "total_cajas",         label: "TOTAL CAJAS",             tipo: "calc" },
  { campo: "total_paletas",       label: "TOTAL PALETAS",           tipo: "paletas" },
  { campo: "cajas_tercera",       label: "CAJAS TERCERA",           tipo: "raw" },
  { campo: "racimos_cosechados",  label: "RAC. COSECHADOS",         tipo: "raw" },
  { campo: "racimos_rechazados",  label: "RACIMOS RECHAZADOS",      tipo: "raw" },
  { campo: "racimos_procesados",  label: "RACIMOS PROCESADOS",      tipo: "calc" },
  { campo: "acres",               label: "AREA COSECHA DIA ACRES",  tipo: "raw" },
  { campo: "_pct_area",           label: "% AREA COSECHA DIA",      tipo: "pct_area" },
  { campo: "factor_primera",      label: "FACTOR PRIMERA",          tipo: "calc" },
  { campo: "factor_general",      label: "FACTOR GENERAL",          tipo: "calc" },
  { campo: "desperdicio_monte",   label: "DESPERDICIO DM",          tipo: "pct" },
  { campo: "desperdicio_general", label: "DESPERDICIO REAL",        tipo: "pct" },
  { campo: "quintales_rechazo",   label: "RECHAZO EN CAMION QUINTAL", tipo: "raw" },
];

export default function ProduccionHome() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  // ── Semana y día derivados de la fecha ───────────────────────────────────
  const semana    = lunesDeSemanaDe(fechaSeleccionada);
  const diaActual = diaKeyDeFecha(fechaSeleccionada);

  // ── Total acres finca (para % Área) ─────────────────────────────────────
  const { data: acresConfig } = useQuery({
    queryKey: ["settings-acres-finca"],
    queryFn: async () => {
      const { data } = await settings.filter({ key: "area_total_finca_acres" });
      return data?.[0] ?? null;
    },
  });
  const totalAcresFinca = acresConfig ? Number(acresConfig.value) : 260.6;

  // ── Registro diario (fuente: registros_produccion) ───────────────────────
  const { data: registroDia = null, isLoading: cargandoRegistro } = useQuery({
    queryKey: ["produccion-registro-home", fechaSeleccionada],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_produccion")
        .select("*")
        .eq("fecha", fechaSeleccionada)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 0,
  });
  const calculado = registroDia ? calcularDatosProceso(registroDia) : null;

  // ── Calidades del día (fuente: produccion_semanal) ───────────────────────
  const { data: filasSemana = [], isLoading: cargandoSemanal } = useQuery({
    queryKey: ["produccion-semanal-home", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  // ── Configuración de calidades (para labels y caj_default) ───────────────
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const calidadPorCodigo = useMemo(
    () => Object.fromEntries(calidades.map((c) => [c.codigo, c])),
    [calidades]
  );

  // ── Grid de valores para el día seleccionado ─────────────────────────────
  const valoresDia = useMemo(() => {
    if (!diaActual) return {};
    const result = {};
    filasSemana.forEach((f) => {
      result[f.codigo_producto] = {
        total:   f[diaActual] ?? null,
        cajProg: f[`caj_prog_${diaActual}`] ?? null,
      };
    });
    return result;
  }, [filasSemana, diaActual]);

  // ── Total general de cajas del día ───────────────────────────────────────
  const totalTotal = useMemo(
    () => calidades.reduce((s, c) => s + (Number(valoresDia[c.codigo]?.total) || 0), 0),
    [calidades, valoresDia]
  );

  // ── Total paletas del día (cajas_dia / caj_default por calidad) ──────────
  const totalPaletas = useMemo(
    () =>
      calidades.reduce((s, c) => {
        const cajas     = Number(valoresDia[c.codigo]?.total) || 0;
        const cajDefault = Number(c.caj_default) || 0;
        return s + (cajDefault > 0 ? cajas / cajDefault : 0);
      }, 0),
    [calidades, valoresDia]
  );

  // ── % Área ────────────────────────────────────────────────────────────────
  const pctArea = useMemo(() => {
    const acres = Number(registroDia?.acres) || 0;
    if (!acres || !totalAcresFinca) return null;
    return ((acres / totalAcresFinca) * 100).toFixed(1) + "%";
  }, [registroDia, totalAcresFinca]);

  // ── Helper: porcentaje desde valor decimal (0.1257 → "12.57%") ───────────
  const porcentaje = (valor) =>
    valor === null || valor === undefined || Number.isNaN(valor)
      ? "—"
      : `${(valor * 100).toFixed(2)}%`;

  const redondear2 = (valor) =>
    valor === null || valor === undefined || Number.isNaN(valor)
      ? "—"
      : (Math.round(valor * 100) / 100).toLocaleString("es-EC");

  // ── Resolver un valor de STATS_FILAS según su tipo ───────────────────────
  const resolverValor = (fila) => {
    switch (fila.tipo) {
      case "raw":
        return registroDia?.[fila.campo] ?? "—";
      case "calc": {
        if (!calculado) return "—";
        const map = {
          total_cajas:         calculado.cajasTotal,
          racimos_procesados:  calculado.racimosProcesados,
          factor_primera:      redondear2(calculado.factorPrimera),
          factor_general:      redondear2(calculado.factorGeneral),
        };
        return map[fila.campo] ?? "—";
      }
      case "paletas":
        return totalPaletas > 0 ? totalPaletas.toFixed(2) : "—";
      case "pct_area":
        return pctArea ?? "—";
      case "pct": {
        if (!calculado) return "—";
        const mapPct = {
          desperdicio_monte:   calculado.desperdicioMonte,
          desperdicio_general: calculado.desperdicioGeneral,
        };
        return porcentaje(mapPct[fila.campo]);
      }
      default:
        return "—";
    }
  };

  // ── Datos pie chart (calidades con total > 0) ─────────────────────────────
  const datosGraficaPie = useMemo(
    () =>
      calidades
        .map((c) => ({
          name:  c.codigo_corto || c.codigo,
          value: Number(valoresDia[c.codigo]?.total) || 0,
        }))
        .filter((d) => d.value > 0),
    [calidades, valoresDia]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Resumen del día</p>
        </div>
      </div>

      {/* Selector de fecha */}
      <Card className="mb-6">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Label htmlFor="fecha-home" className="text-sm font-medium whitespace-nowrap">
            Fecha
          </Label>
          <Input
            id="fecha-home"
            type="date"
            className="sm:w-48"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver el resumen de ese día.
          </p>
        </CardContent>
      </Card>

      {/* Aviso si es domingo */}
      {!diaActual && (
        <p className="text-sm text-muted-foreground text-center mb-6">
          La fecha seleccionada es domingo — no hay columna de datos para ese día.
        </p>
      )}

      {/* ── Layout 3 columnas: stats | calidades | pie chart ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6 items-start min-w-max">

          {/* ── Col 1: Datos del Día (solo lectura, desde registros_produccion) ── */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Datos del Día
              </CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Datos ingresados en "Ingresar Datos"
              </p>
            </CardHeader>
            <CardContent>
              {cargandoRegistro ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : (
                <table className="text-sm w-full">
                  <tbody>
                    {STATS_FILAS.map(({ campo, label, tipo }) => (
                      <tr key={campo} className="border-b last:border-0">
                        <td className="py-1.5 pr-6 text-muted-foreground whitespace-nowrap">{label}</td>
                        <td className="py-1.5 text-right font-medium">
                          {resolverValor({ campo, tipo })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* ── Col 2: Calidades (solo lectura, desde produccion_semanal) ── */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Calidades
              </CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Refleja los datos de "Resumen de Producción" en Ingresar Datos
              </p>
            </CardHeader>
            <CardContent>
              {cargandoSemanal ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : !diaActual ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Sin columna para domingo.
                </p>
              ) : (
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="py-2 px-2 text-center whitespace-nowrap">Caj.Prog</th>
                      <th className="py-2 px-2 text-left whitespace-nowrap">Cód</th>
                      <th className="py-2 px-2 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calidades.map((c) => {
                      const total   = Number(valoresDia[c.codigo]?.total)   || 0;
                      const cajProg = Number(valoresDia[c.codigo]?.cajProg) || 0;
                      const dif     = total - cajProg;
                      return (
                        <tr key={c.codigo} className="border-b last:border-0">
                          <td className="py-1.5 px-2 text-center text-muted-foreground">
                            {cajProg || "—"}
                          </td>
                          <td className="py-1.5 px-2 font-semibold whitespace-nowrap">
                            {c.codigo_corto || c.codigo}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">{c.label || c.codigo}</td>
                          <td className="py-1.5 px-2 text-center font-semibold">
                            {total || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {total || cajProg ? dif || "0" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="py-2 px-2 text-center text-muted-foreground">
                        {calidades.reduce((s, c) => s + (Number(valoresDia[c.codigo]?.cajProg) || 0), 0) || "—"}
                      </td>
                      <td className="py-2 px-2" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-2 text-center">{totalTotal || "—"}</td>
                      <td className="py-2 px-2 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* ── Col 3: Pie chart de calidades ── */}
          <Card className="flex-shrink-0 w-96">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="w-4 h-4" />
                Distribución de Calidades
              </CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Cajas producidas por calidad · {fechaSeleccionada}
              </p>
            </CardHeader>
            <CardContent>
              {cargandoSemanal ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : datosGraficaPie.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Sin datos para este día.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={datosGraficaPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      outerRadius={130}
                    >
                      {datosGraficaPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} cajas`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
