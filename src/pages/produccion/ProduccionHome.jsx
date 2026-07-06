import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resumenHome, produccionResumen, settings } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, FileSpreadsheet, ClipboardList, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════
// LISTA FIJA DE CALIDADES — 100 % independiente de calidades_produccion,
// de Configuraciones y de cualquier otra tabla de la app.
// Solo cambia aquí si el equipo decide agregar/quitar una calidad en
// esta página específica.
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

// ── Clase compartida para celdas numéricas editables ──────────────────────
const INP =
  "w-16 text-center text-sm h-7 px-1 rounded border border-transparent " +
  "focus:border-input bg-transparent hover:bg-muted/50 focus:bg-background " +
  "transition-colors [appearance:textfield] " +
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// ── Filas de la tabla "Datos del Día" (imagen 2) ──────────────────────────
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

  // ── Imagen 1 — resumen_home (por fecha + codigo de FILAS_HOME) ────────────
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

  // ── Imagen 2 — produccion_resumen (una fila por fecha) ───────────────────
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
  const getR = (codigo, campo) => {
    const k = `${codigo}_${campo}`;
    return localesResumen[k] !== undefined
      ? localesResumen[k]
      : (resumenPorCodigo[codigo]?.[campo] ?? "");
  };
  const getS = (campo) =>
    localesStats[campo] !== undefined ? localesStats[campo] : (statsHoy?.[campo] ?? "");

  // ── Handlers Imagen 1 (resumen_home upsert) ───────────────────────────────
  const handleChangeR = (codigo, campo, valor) =>
    setLocalesResumen((p) => ({ ...p, [`${codigo}_${campo}`]: valor }));

  const handleBlurR = useCallback(
    async (codigo, campo) => {
      const k = `${codigo}_${campo}`;
      if (localesResumen[k] === undefined) return;

      const rawCaj = campo === "caj_prog" ? localesResumen[k] : (resumenPorCodigo[codigo]?.caj_prog ?? null);
      const rawTot = campo === "total"    ? localesResumen[k] : (resumenPorCodigo[codigo]?.total    ?? null);
      const cajProg = rawCaj === "" || rawCaj === null ? null : Number(rawCaj);
      const total   = rawTot === "" || rawTot === null ? null : Number(rawTot);

      await resumenHome.upsert(fechaSeleccionada, codigo, cajProg, total);
      setLocalesResumen((p) => { const n = { ...p }; delete n[k]; return n; });
      queryClient.invalidateQueries({ queryKey: ["resumen-home", fechaSeleccionada] });
    },
    [localesResumen, resumenPorCodigo, fechaSeleccionada, queryClient]
  );

  // ── Handlers Imagen 2 (produccion_resumen update/create) ─────────────────
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

  // ── Totales fila imagen 1 ─────────────────────────────────────────────────
  const totalCajProg = useMemo(
    () => FILAS_HOME.reduce((s, { codigo }) => s + (Number(resumenPorCodigo[codigo]?.caj_prog) || 0), 0),
    [resumenPorCodigo]
  );
  const totalTotal = useMemo(
    () => FILAS_HOME.reduce((s, { codigo }) => s + (Number(resumenPorCodigo[codigo]?.total) || 0), 0),
    [resumenPorCodigo]
  );

  // ── DIF con color ─────────────────────────────────────────────────────────
  const renderDif = (total, cajProg) => {
    const dif = Number(total) - Number(cajProg);
    if (!cajProg && !total) return <span className="text-muted-foreground">—</span>;
    if (dif === 0) return <span className="text-muted-foreground">0</span>;
    return (
      <span className={dif < 0 ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
        {dif > 0 ? `+${dif}` : dif}
      </span>
    );
  };

  // ── % Área ────────────────────────────────────────────────────────────────
  const pctArea = useMemo(() => {
    const acres = Number(statsHoy?.area_acres) || 0;
    if (!acres || !totalAcresFinca) return null;
    return ((acres / totalAcresFinca) * 100).toFixed(1) + "%";
  }, [statsHoy, totalAcresFinca]);

  // ── Datos para gráfica de calidades ──────────────────────────────────────
  const datosGrafica = useMemo(
    () =>
      FILAS_HOME.map(({ codigo, codigoCorto }) => ({
        nombre: codigoCorto,
        "Prog.": Number(resumenPorCodigo[codigo]?.caj_prog) || 0,
        "Total": Number(resumenPorCodigo[codigo]?.total)    || 0,
      })),
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

      {/* Layout horizontal siempre — 2 columnas lado a lado */}
      <div className="overflow-x-auto pb-2">
      <div className="flex gap-6 items-start min-w-max">

        {/* ── Col 1: Resumen de Producción — lista fija FILAS_HOME ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Resumen de Producción
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Tabla independiente — no se ve afectada por Configuraciones ni por otras secciones.
            </p>
          </CardHeader>
          <CardContent>
            {cargandoResumen ? (
              <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-3 text-center whitespace-nowrap">CAJ. PROG</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">CODIGO</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">CALIDAD</th>
                      <th className="py-2 px-3 text-center whitespace-nowrap">TOTAL</th>
                      <th className="py-2 px-3 text-center whitespace-nowrap">DIF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FILAS_HOME.map(({ codigo, codigoCorto, calidad }) => {
                      const cajProg = Number(resumenPorCodigo[codigo]?.caj_prog) || 0;
                      const total   = Number(resumenPorCodigo[codigo]?.total) || 0;
                      return (
                        <tr key={codigo} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-0.5 px-1 text-center">
                            <input
                              type="number"
                              className={INP}
                              value={getR(codigo, "caj_prog")}
                              onChange={(e) => handleChangeR(codigo, "caj_prog", e.target.value)}
                              onBlur={() => handleBlurR(codigo, "caj_prog")}
                              placeholder="—"
                            />
                          </td>
                          <td className="py-1.5 px-3 font-semibold whitespace-nowrap">{codigoCorto}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{calidad}</td>
                          <td className="py-0.5 px-1 text-center">
                            <input
                              type="number"
                              className={INP}
                              value={getR(codigo, "total")}
                              onChange={(e) => handleChangeR(codigo, "total", e.target.value)}
                              onBlur={() => handleBlurR(codigo, "total")}
                              placeholder="—"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            {renderDif(total, cajProg)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 px-3 text-center">{totalCajProg || "—"}</td>
                      <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-3 text-center">{totalTotal || "—"}</td>
                      <td className="py-2 px-3 text-center">{renderDif(totalTotal, totalCajProg)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Col 2: Datos del Día ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Datos del Día
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Tabla independiente — edita directamente cada celda.
            </p>
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
                          <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
                          <td className="py-1.5 text-right font-medium">{pctArea ?? "—"}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={campo} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
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

      </div>{/* cierra flex min-w-max */}
      </div>{/* cierra overflow-x-auto */}

      {/* ── Gráfica de Calidades ── */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            Cajas por Calidad
          </CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Cajas programadas vs. producidas por calidad · {fechaSeleccionada}
          </p>
        </CardHeader>
        <CardContent>
          {cargandoResumen ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={datosGrafica}
                margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 11 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend verticalAlign="top" height={28} />
                <Bar dataKey="Prog." fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Total" fill="#86efac" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
