import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  resumenHome,
  calidadesProduccion,
  produccionVisibilidad,
} from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, FileSpreadsheet, BarChart2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Paleta de colores para el gráfico de calidades
const COLORES = [
  "#16a34a", "#22c55e", "#4ade80", "#f59e0b",
  "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899",
  "#06b6d4", "#d97706", "#84cc16", "#f97316",
  "#6366f1",
];

// Clase compartida para los inputs editables de la tabla
const INPUT_CLASE =
  "w-16 text-center text-sm h-7 px-1 rounded border border-transparent " +
  "focus:border-input bg-transparent hover:bg-muted/50 focus:bg-background " +
  "transition-colors [appearance:textfield] " +
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export default function ProduccionHome() {
  // Fecha activa — controla toda la vista
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  // Estado local de edición (antes de hacer blur → guardar)
  const [valoresLocales, setValoresLocales] = useState({});
  const queryClient = useQueryClient();

  // ── Calidades configuradas (fuente de verdad de las filas) ────────────────
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Visibilidad (qué calidades están ocultas en "ingresar_calidades") ─────
  const { data: visibilidad = [] } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const codigosOcultos = useMemo(
    () =>
      new Set(
        visibilidad
          .filter((v) => v.grupo === "ingresar_calidades" && v.visible === false)
          .map((v) => v.clave)
      ),
    [visibilidad]
  );
  const codigosVisibles = useMemo(
    () => calidades.map((c) => c.codigo).filter((c) => !codigosOcultos.has(c)),
    [calidades, codigosOcultos]
  );
  const calidadPorCodigo = useMemo(
    () => Object.fromEntries(calidades.map((c) => [c.codigo, c])),
    [calidades]
  );

  // ── Datos del Resumen (tabla resumen_home — 100 % independiente) ──────────
  const { data: filasResumen = [], isLoading: cargando } = useQuery({
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

  // ── Helpers de valor (estado local tiene prioridad sobre servidor) ────────
  const getValor = (codigo, campo) => {
    const key = `${codigo}_${campo}`;
    return valoresLocales[key] !== undefined
      ? valoresLocales[key]
      : (resumenPorCodigo[codigo]?.[campo] ?? "");
  };

  const handleChange = (codigo, campo, valor) => {
    setValoresLocales((prev) => ({ ...prev, [`${codigo}_${campo}`]: valor }));
  };

  // Al salir del campo: upsert a Supabase y refrescar
  const handleBlur = useCallback(
    async (codigo, campo) => {
      const key = `${codigo}_${campo}`;
      if (valoresLocales[key] === undefined) return; // sin cambios

      const rawCajProg =
        campo === "caj_prog"
          ? valoresLocales[key]
          : (resumenPorCodigo[codigo]?.caj_prog ?? null);
      const rawTotal =
        campo === "total"
          ? valoresLocales[key]
          : (resumenPorCodigo[codigo]?.total ?? null);

      const cajProg = rawCajProg === "" || rawCajProg === null ? null : Number(rawCajProg);
      const total = rawTotal === "" || rawTotal === null ? null : Number(rawTotal);

      await resumenHome.upsert(fechaSeleccionada, codigo, cajProg, total);

      // Limpiar valor local ya procesado
      setValoresLocales((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ["resumen-home", fechaSeleccionada] });
    },
    [valoresLocales, resumenPorCodigo, fechaSeleccionada, queryClient]
  );

  // ── Totales de la fila de totales ─────────────────────────────────────────
  const totalCajProg = useMemo(
    () =>
      codigosVisibles.reduce(
        (s, c) => s + (Number(resumenPorCodigo[c]?.caj_prog) || 0),
        0
      ),
    [codigosVisibles, resumenPorCodigo]
  );
  const totalTotal = useMemo(
    () =>
      codigosVisibles.reduce(
        (s, c) => s + (Number(resumenPorCodigo[c]?.total) || 0),
        0
      ),
    [codigosVisibles, resumenPorCodigo]
  );

  // ── Datos para el gráfico de calidades ───────────────────────────────────
  const datosGrafico = useMemo(
    () =>
      codigosVisibles
        .map((codigo) => ({
          name: calidadPorCodigo[codigo]?.codigo_corto ?? codigo,
          value: Number(resumenPorCodigo[codigo]?.total) || 0,
        }))
        .filter((d) => d.value > 0),
    [codigosVisibles, resumenPorCodigo, calidadPorCodigo]
  );

  // ── Helpers de formateo de diferencia ────────────────────────────────────
  const renderDif = (total, cajProg) => {
    if (!cajProg && !total) return <span className="text-muted-foreground">—</span>;
    const dif = total - cajProg;
    if (dif === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={dif < 0 ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
        {dif > 0 ? `+${dif}` : dif}
      </span>
    );
  };

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
              setValoresLocales({}); // limpiar ediciones pendientes al cambiar fecha
            }}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver o editar el resumen de ese día.
          </p>
        </CardContent>
      </Card>

      {/* Layout 2 columnas: Resumen editable | Gráfico de calidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Col 1: Resumen de Producción (editable, independiente) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Resumen de Producción
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Edita los valores directamente — no afectan otras tablas ni secciones.
            </p>
          </CardHeader>
          <CardContent>
            {cargando ? (
              <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-2 text-center whitespace-nowrap">Caj.Prog</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codigosVisibles.map((codigo) => {
                      const cajProg = Number(resumenPorCodigo[codigo]?.caj_prog) || 0;
                      const total = Number(resumenPorCodigo[codigo]?.total) || 0;
                      return (
                        <tr key={codigo} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-1 px-1 text-center">
                            <input
                              type="number"
                              className={INPUT_CLASE}
                              value={getValor(codigo, "caj_prog")}
                              onChange={(e) => handleChange(codigo, "caj_prog", e.target.value)}
                              onBlur={() => handleBlur(codigo, "caj_prog")}
                              placeholder="—"
                            />
                          </td>
                          <td className="py-1.5 px-3 font-medium whitespace-nowrap">
                            {calidadPorCodigo[codigo]?.codigo_corto ?? "—"}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap text-muted-foreground">
                            {calidadPorCodigo[codigo]?.label ?? codigo}
                          </td>
                          <td className="py-1 px-1 text-center">
                            <input
                              type="number"
                              className={INPUT_CLASE}
                              value={getValor(codigo, "total")}
                              onChange={(e) => handleChange(codigo, "total", e.target.value)}
                              onBlur={() => handleBlur(codigo, "total")}
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

        {/* ── Col 2: Gráfico de calidades ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Distribución de Calidades
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Distribución del total de cajas por calidad para {fechaSeleccionada}.
            </p>
          </CardHeader>
          <CardContent>
            {datosGrafico.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">
                Ingresa valores en "Total" para ver el gráfico.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={datosGrafico}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine
                  >
                    {datosGrafico.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORES[index % COLORES.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} cajas`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
