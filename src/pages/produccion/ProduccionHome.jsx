import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resumenHome, produccionResumen, settings } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, FileSpreadsheet, ClipboardList, PieChart as PieIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════
// LISTA FIJA DE CALIDADES — 100 % independiente de calidades_produccion,
// de Configuraciones y de cualquier otra tabla de la app.
// ═══════════════════════════════════════════════════════════════════════════
const FILAS_HOME = [
  { codigo: "DMD",             codigoCorto: "C68",  calidad: "DMD" },
  { codigo: "DM9",             codigoCorto: "C23",  calidad: "DM9" },
  { codigo: "PRIM",            codigoCorto: "CH1",  calidad: "PRIM." },
  { codigo: "PREM",            codigoCorto: "G01",  calidad: "PREM." },
  { codigo: "3LB",             codigoCorto: "CQ2",  calidad: "3LB" },
  { codigo: "IP",              codigoCorto: "CH7",  calidad: "IP" },
  { codigo: "24COUNT",         codigoCorto: "C39",  calidad: "24 COUNT" },
  { codigo: "24COUNT_G39",     codigoCorto: "G39",  calidad: "24 COUNT" },
  { codigo: "ROSY NORMAL",     codigoCorto: "G05",  calidad: "ROSY NORMAL" },
  { codigo: "ROSY CONSUMER",   codigoCorto: "GQ5",  calidad: "ROSY CONSUMER" },
  { codigo: "DM BANABAC",      codigoCorto: "GP7",  calidad: "DM BANABAC" },
  { codigo: "DM BANABAC MINI", codigoCorto: "GP7",  calidad: "DM BANABAC MINI" },
  { codigo: "3LBS",            codigoCorto: "CP9",  calidad: "3 LBS" },
];

// ── Paleta de colores para el pie chart ───────────────────────────────────
const PIE_COLORS = [
  "#16a34a", "#22c55e", "#4ade80", "#86efac",
  "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd",
  "#f59e0b", "#fbbf24", "#ef4444", "#f97316", "#a855f7",
];

// ── Clase compartida para celdas numéricas editables ──────────────────────
const INP =
  "w-16 text-center text-sm h-7 px-1 rounded border border-transparent " +
  "focus:border-input bg-transparent hover:bg-muted/50 focus:bg-background " +
  "transition-colors [appearance:textfield] " +
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// ── Filas de la tabla "Datos del Día" ────────────────────────────────────
const STATS_FILAS = [
  { campo: "total_cajas",         label: "TOTAL CAJAS" },
  { campo: "total_paletas",       label: "TOTAL PALETAS" },
  { campo: "cajas_tercera",       label: "CAJAS TERCERA" },
  { campo: "racimos_cosechados",  label: "RAC. COSECHADOS" },
  { campo: "racimos_rechazados",  label: "RACIMOS RECHAZADOS" },
  { campo: "racimos_procesados",  label: "RACIMOS PROCESADOS" },
  { campo: "area_acres",          label: "AREA COSECHA DIA ACRES" },
  { campo: "_pct_area",           label: "% AREA COSECHA DIA", calc: true },
  { campo: "factor_primera",      label: "FACTOR PRIMERA" },
  { campo: "factor_general",      label: "FACTOR GENERAL" },
  { campo: "desperdicio_monte",   label: "DESPERDICIO DM" },
  { campo: "desperdicio_general", label: "DESPERDICIO REAL" },
  { campo: "quintales_rechazo",   label: "RECHAZO EN CAMION QUINTAL" },
];

export default function ProduccionHome() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [localesResumen, setLocalesResumen] = useState({});
  const [localesStats,   setLocalesStats]   = useState({});
  const queryClient = useQueryClient();

  // ── Total acres finca (para calcular % Área) ─────────────────────────────
  const { data: acresConfig } = useQuery({
    queryKey: ["settings-acres-finca"],
    queryFn: async () => {
      const { data } = await settings.filter({ key: "area_total_finca_acres" });
      return data?.[0] ?? null;
    },
  });
  const totalAcresFinca = acresConfig ? Number(acresConfig.value) : 260.6;

  // ── resumen_home — total por calidad (col 2: tabla calidades) ────────────
  const { data: filasResumen = [], isLoading: cargandoResumen } = useQuery({
    queryKey: ["resumen-home", fechaSeleccionada],
    queryFn: async () => {
      const { data, error } = await resumenHome.filter({ fecha: fechaSeleccionada });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });
  const resumenPorCodigo = useMemo(
    () => Object.fromEntries(filasResumen.map((f) => [f.codigo, f])),
    [filasResumen]
  );

  // ── produccion_resumen — stats del día (col 1: datos del día) ────────────
  const { data: filasStats = [], isLoading: cargandoStats } = useQuery({
    queryKey: ["produccion-resumen-home", fechaSeleccionada],
    queryFn: async () => {
      const { data, error } = await produccionResumen.filter({ fecha: fechaSeleccionada });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });
  const statsHoy = filasStats[0] ?? null;

  // ── Helpers de valor ─────────────────────────────────────────────────────
  const getTotal = (codigo) => {
    const k = `${codigo}_total`;
    return localesResumen[k] !== undefined
      ? localesResumen[k]
      : (resumenPorCodigo[codigo]?.total ?? "");
  };
  const getS = (campo) =>
    localesStats[campo] !== undefined ? localesStats[campo] : (statsHoy?.[campo] ?? "");

  // ── Handler calidades (solo campo "total") ────────────────────────────────
  const handleChangeTotal = (codigo, valor) =>
    setLocalesResumen((p) => ({ ...p, [`${codigo}_total`]: valor }));

  const handleBlurTotal = useCallback(
    async (codigo) => {
      const k = `${codigo}_total`;
      if (localesResumen[k] === undefined) return;
      const rawTot = localesResumen[k];
      const cajProg = resumenPorCodigo[codigo]?.caj_prog ?? null;
      const total   = rawTot === "" || rawTot === null ? null : Number(rawTot);
      await resumenHome.upsert(fechaSeleccionada, codigo, cajProg, total);
      setLocalesResumen((p) => { const n = { ...p }; delete n[k]; return n; });
      queryClient.invalidateQueries({ queryKey: ["resumen-home", fechaSeleccionada] });
    },
    [localesResumen, resumenPorCodigo, fechaSeleccionada, queryClient]
  );

  // ── Handlers stats (produccion_resumen) ──────────────────────────────────
  const handleChangeS = (campo, valor) =>
    setLocalesStats((p) => ({ ...p, [campo]: valor }));

  const handleBlurS = useCallback(
    async (campo) => {
      if (localesStats[campo] === undefined) return;
      const valor = localesStats[campo] === "" ? null : Number(localesStats[campo]);
      if (statsHoy) {
        await produccionResumen.update(statsHoy.id, { [campo]: valor });
      } else {
        await produccionResumen.create({ fecha: fechaSeleccionada, [campo]: valor });
      }
      setLocalesStats((p) => { const n = { ...p }; delete n[campo]; return n; });
      queryClient.invalidateQueries({ queryKey: ["produccion-resumen-home", fechaSeleccionada] });
    },
    [localesStats, statsHoy, fechaSeleccionada, queryClient]
  );

  // ── Total general de cajas (pie del pie chart y tabla) ───────────────────
  const totalTotal = useMemo(
    () => FILAS_HOME.reduce((s, { codigo }) => s + (Number(resumenPorCodigo[codigo]?.total) || 0), 0),
    [resumenPorCodigo]
  );

  // ── % Área ────────────────────────────────────────────────────────────────
  const pctArea = useMemo(() => {
    const acres = Number(statsHoy?.area_acres) || 0;
    if (!acres || !totalAcresFinca) return null;
    return ((acres / totalAcresFinca) * 100).toFixed(1) + "%";
  }, [statsHoy, totalAcresFinca]);

  // ── Datos pie chart (solo calidades con total > 0) ────────────────────────
  const datosGraficaPie = useMemo(
    () =>
      FILAS_HOME
        .map(({ codigo, codigoCorto }) => ({
          name:  codigoCorto,
          value: Number(resumenPorCodigo[codigo]?.total) || 0,
        }))
        .filter((d) => d.value > 0),
    [resumenPorCodigo]
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
            onChange={(e) => {
              setFechaSeleccionada(e.target.value);
              setLocalesResumen({});
              setLocalesStats({});
            }}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver o editar el resumen de ese día.
          </p>
        </CardContent>
      </Card>

      {/* ── Layout 3 columnas: stats | calidades | pie chart ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6 items-start min-w-max">

          {/* ── Col 1: Datos del Día (stats verticales) ── */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Datos del Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cargandoStats ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : (
                <table className="text-sm w-full">
                  <tbody>
                    {STATS_FILAS.map(({ campo, label, calc }) => {
                      if (calc) {
                        return (
                          <tr key={campo} className="border-b last:border-0">
                            <td className="py-1.5 pr-6 text-muted-foreground whitespace-nowrap">{label}</td>
                            <td className="py-1.5 text-right font-medium">{pctArea ?? "—"}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={campo} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-1 pr-6 text-muted-foreground whitespace-nowrap">{label}</td>
                          <td className="py-1 text-right">
                            <input
                              type="number"
                              className={`${INP} w-24`}
                              value={getS(campo)}
                              onChange={(e) => handleChangeS(campo, e.target.value)}
                              onBlur={() => handleBlurS(campo)}
                              placeholder="—"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* ── Col 2: Calidades (Código | Calidad | Total) ── */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Calidades
              </CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Independiente — no afecta ni es afectada por otras secciones.
              </p>
            </CardHeader>
            <CardContent>
              {cargandoResumen ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : (
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-3 text-center whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FILAS_HOME.map(({ codigo, codigoCorto, calidad }) => (
                      <tr key={codigo} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-1.5 px-3 font-semibold whitespace-nowrap">{codigoCorto}</td>
                        <td className="py-1.5 px-3 whitespace-nowrap">{calidad}</td>
                        <td className="py-0.5 px-2 text-center">
                          <input
                            type="number"
                            className={INP}
                            value={getTotal(codigo)}
                            onChange={(e) => handleChangeTotal(codigo, e.target.value)}
                            onBlur={() => handleBlurTotal(codigo)}
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-3 text-center">{totalTotal || "—"}</td>
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
              {cargandoResumen ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : datosGraficaPie.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Sin datos para este día.
                </p>
              ) : (
                /* Labels eliminados del pie (se amontonaban con muchas calidades).
                   Los datos se leen en el Legend y en el Tooltip al pasar el cursor. */
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
