import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  resumenHome,
  produccionResumen,
  calidadesProduccion,
  settings,
} from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, FileSpreadsheet, ClipboardList } from "lucide-react";

// ── Clase compartida para celdas editables de ambas tablas ────────────────
const INP =
  "w-16 text-center text-sm h-7 px-1 rounded border border-transparent " +
  "focus:border-input bg-transparent hover:bg-muted/50 focus:bg-background " +
  "transition-colors [appearance:textfield] " +
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// ── Filas de la tabla de estadísticas (imagen 2) ──────────────────────────
// campo: nombre de columna en produccion_resumen
// label: texto a mostrar
// tipo: "num" | "pct" | "calc" (no editable, se calcula)
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
  // Fecha activa
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  // Estado local de edición antes de blur (tabla 1)
  const [localesResumen, setLocalesResumen] = useState({});
  // Estado local de edición antes de blur (tabla 2 — stats)
  const [localesStats, setLocalesStats] = useState({});

  const queryClient = useQueryClient();

  // ── Calidades (fuente de verdad de las filas de imagen 1) ────────────────
  // NOTA: NO se filtra por visibilidad — las tablas de Producción son
  //       independientes y no deben ser afectadas por Configuraciones.
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const codigosVisibles = calidades.map((c) => c.codigo);
  const calidadPorCodigo = useMemo(
    () => Object.fromEntries(calidades.map((c) => [c.codigo, c])),
    [calidades]
  );

  // ── Total acres finca (para % Área Cosecha) ──────────────────────────────
  const { data: acresConfig } = useQuery({
    queryKey: ["settings-acres-finca"],
    queryFn: async () => {
      const { data } = await settings.filter({ key: "area_total_finca_acres" });
      return data?.[0] ?? null;
    },
  });
  const totalAcresFinca = acresConfig ? Number(acresConfig.value) : 260.6;

  // ── Imagen 1: datos de resumen_home (por fecha+codigo) ───────────────────
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

  // ── Imagen 2: datos de produccion_resumen (por fecha, una fila) ──────────
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
  const getS = (campo) => {
    return localesStats[campo] !== undefined
      ? localesStats[campo]
      : (statsHoy?.[campo] ?? "");
  };

  // ── Handlers Imagen 1 (resumen_home) ─────────────────────────────────────
  const handleChangeR = (codigo, campo, valor) => {
    setLocalesResumen((prev) => ({ ...prev, [`${codigo}_${campo}`]: valor }));
  };
  const handleBlurR = useCallback(
    async (codigo, campo) => {
      const k = `${codigo}_${campo}`;
      if (localesResumen[k] === undefined) return;

      const rawCaj = campo === "caj_prog"
        ? localesResumen[k]
        : (resumenPorCodigo[codigo]?.caj_prog ?? null);
      const rawTot = campo === "total"
        ? localesResumen[k]
        : (resumenPorCodigo[codigo]?.total ?? null);

      const cajProg = rawCaj === "" || rawCaj === null ? null : Number(rawCaj);
      const total = rawTot === "" || rawTot === null ? null : Number(rawTot);

      await resumenHome.upsert(fechaSeleccionada, codigo, cajProg, total);

      setLocalesResumen((prev) => { const n = { ...prev }; delete n[k]; return n; });
      queryClient.invalidateQueries({ queryKey: ["resumen-home", fechaSeleccionada] });
    },
    [localesResumen, resumenPorCodigo, fechaSeleccionada, queryClient]
  );

  // ── Handlers Imagen 2 (produccion_resumen) ───────────────────────────────
  const handleChangeS = (campo, valor) => {
    setLocalesStats((prev) => ({ ...prev, [campo]: valor }));
  };
  const handleBlurS = useCallback(
    async (campo) => {
      if (localesStats[campo] === undefined) return;
      const raw = localesStats[campo];
      const valor = raw === "" ? null : Number(raw);

      if (statsHoy) {
        await produccionResumen.update(statsHoy.id, { [campo]: valor });
      } else {
        await produccionResumen.create({ fecha: fechaSeleccionada, [campo]: valor });
      }

      setLocalesStats((prev) => { const n = { ...prev }; delete n[campo]; return n; });
      queryClient.invalidateQueries({ queryKey: ["produccion-resumen-home", fechaSeleccionada] });
    },
    [localesStats, statsHoy, fechaSeleccionada, queryClient]
  );

  // ── Totales fila resumen (imagen 1) ───────────────────────────────────────
  const totalCajProg = useMemo(
    () => codigosVisibles.reduce((s, c) => s + (Number(resumenPorCodigo[c]?.caj_prog) || 0), 0),
    [codigosVisibles, resumenPorCodigo]
  );
  const totalTotal = useMemo(
    () => codigosVisibles.reduce((s, c) => s + (Number(resumenPorCodigo[c]?.total) || 0), 0),
    [codigosVisibles, resumenPorCodigo]
  );

  // ── Formateo de DIF con color ─────────────────────────────────────────────
  const renderDif = (total, cajProg) => {
    if (!cajProg && !total) return <span className="text-muted-foreground">—</span>;
    const dif = Number(total) - Number(cajProg);
    if (dif === 0) return <span className="text-muted-foreground">0</span>;
    return (
      <span className={dif < 0 ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
        {dif > 0 ? `+${dif}` : dif}
      </span>
    );
  };

  // ── Calcular % Área ────────────────────────────────────────────────────────
  const pctArea = useMemo(() => {
    const acres = Number(statsHoy?.area_acres) || 0;
    if (!acres || !totalAcresFinca) return null;
    return ((acres / totalAcresFinca) * 100).toFixed(1) + "%";
  }, [statsHoy, totalAcresFinca]);

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Columna 1: Resumen de Producción (imagen 1) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Resumen de Producción
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Datos independientes — no afectan ni son afectados por otras secciones.
            </p>
          </CardHeader>
          <CardContent>
            {cargandoResumen ? (
              <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-2 text-center whitespace-nowrap">CAJ. PROG</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">CODIGO</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">CALIDAD</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">TOTAL</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">DIF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codigosVisibles.map((codigo) => {
                      const cajProg = Number(resumenPorCodigo[codigo]?.caj_prog) || 0;
                      const total = Number(resumenPorCodigo[codigo]?.total) || 0;
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
                          <td className="py-1.5 px-3 font-semibold whitespace-nowrap">
                            {calidadPorCodigo[codigo]?.codigo_corto ?? "—"}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {calidadPorCodigo[codigo]?.label ?? codigo}
                          </td>
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
                          <td className="py-1.5 px-2 text-center">
                            {renderDif(total, cajProg)}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Fila de totales */}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 px-2 text-center">{totalCajProg || "—"}</td>
                      <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-2 text-center">{totalTotal || "—"}</td>
                      <td className="py-2 px-2 text-center">
                        {renderDif(totalTotal, totalCajProg)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Columna 2: Estadísticas del día (imagen 2) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Datos del Día
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Datos independientes — edita directamente cada celda.
            </p>
          </CardHeader>
          <CardContent>
            {cargandoStats ? (
              <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {STATS_FILAS.map(({ campo, label, calc }) => {
                    // % Área es calculada (solo lectura)
                    if (calc) {
                      return (
                        <tr key={campo} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                            {label}
                          </td>
                          <td className="py-1.5 text-right font-medium">
                            {pctArea ?? "—"}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={campo} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">
                          {label}
                        </td>
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

      </div>
    </div>
  );
}
