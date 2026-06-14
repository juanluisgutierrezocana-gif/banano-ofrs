import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { seccionAgricola, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CycleProgressCharts() {
  const { data: labores = [] } = useQuery({
    queryKey: ["labores-agricolas"],
    queryFn: async () => {
      const { data, error } = await laborAgricola.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  // FIXED: tabla correcta es "registros_labor" (con 's'), accedida via entity reports
  const { data: registros = [] } = useQuery({
    queryKey: ["registros-labor"],
    queryFn: async () => {
      const { data, error } = await reports.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: secciones = [] } = useQuery({
    queryKey: ["secciones-agricolas"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalAcresFinca = useMemo(
    () => secciones.reduce((sum, s) => sum + (s.acres || 0), 0),
    [secciones]
  );

  const activeLaborFiltered = labores
    .filter((l) => l.activa !== false)
    .sort((a, b) => (a.num_ciclos || 9) - (b.num_ciclos || 9));

  // Acres, matas (para embolse) y unidad_extra por labor y ciclo
  const dataByLaborAndCycle = useMemo(() => {
    const result = {};
    activeLaborFiltered.forEach((labor) => {
      result[labor.id] = {};
    });
    registros.forEach((reg) => {
      if (!result[reg.labor_id]) return;
      const c = reg.ciclo;
      if (!result[reg.labor_id][c]) {
        result[reg.labor_id][c] = { acres: 0, extra: 0, extra_tipo: null };
      }
      result[reg.labor_id][c].acres += reg.acres || 0;
      result[reg.labor_id][c].extra += reg.unidad_extra_valor || 0;
      if (reg.unidad_extra_tipo) result[reg.labor_id][c].extra_tipo = reg.unidad_extra_tipo;
    });
    return result;
  }, [registros, labores]);

  // Totales por minifinca y ciclo para labores de tipo Embolse
  const embolsePorMinifinca = useMemo(() => {
    const minifincas = [...new Set(secciones.map(s => s.minifinca).filter(Boolean))].sort();
    const result = {};
    activeLaborFiltered.forEach(labor => {
      if (!labor.nombre.toLowerCase().includes("embolse")) return;
      result[labor.id] = {};
      minifincas.forEach(m => { result[labor.id][m] = {}; });
      registros.forEach(reg => {
        if (reg.labor_id !== labor.id) return;
        const seccion = secciones.find(s => s.id === reg.seccion_id);
        const mf = seccion?.minifinca;
        if (!mf) return;
        if (!result[labor.id][mf]) result[labor.id][mf] = {};
        if (!result[labor.id][mf][reg.ciclo]) result[labor.id][mf][reg.ciclo] = 0;
        result[labor.id][mf][reg.ciclo] += reg.acres || 0;
      });
    });
    return { result, minifincas };
  }, [registros, activeLaborFiltered, secciones]);

  const getCellStyle = (pct) => {
    if (pct <= 0) return { bg: "bg-muted/40", text: "text-muted-foreground/40" };
    if (pct >= 100) return { bg: "bg-red-100 border border-red-400", text: "text-red-700" };
    if (pct >= 75) return { bg: "bg-green-200 border border-green-500", text: "text-green-800" };
    if (pct >= 40) return { bg: "bg-green-100 border border-green-300", text: "text-green-700" };
    return { bg: "bg-yellow-50 border border-yellow-300", text: "text-yellow-700" };
  };

  const getEmbolseStyle = (total) => {
    if (total <= 0) return { bg: "bg-muted/40", text: "text-muted-foreground/40" };
    return { bg: "bg-blue-100 border border-blue-400", text: "text-blue-800" };
  };

  return (
    <div className="space-y-4">
      {activeLaborFiltered.map((labor) => {
        const numCiclos = labor.num_ciclos || 9;
        const ciclos = Array.from({ length: numCiclos }, (_, i) => i + 1);
        const laborData = dataByLaborAndCycle[labor.id] || {};
        const hasData = ciclos.some((c) => (laborData[c]?.acres || 0) > 0);
        const isEmbolse = labor.nombre.toLowerCase().includes("embolse");

        return (
          <Card key={labor.id} className="overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                {isEmbolse ? "Racimos Embolsados por Sección y Ciclo" : labor.nombre}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {!hasData ? (
                <p className="text-muted-foreground text-xs text-center py-2">Sin datos registrados</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                {ciclos.map((c) => {
                  const d = laborData[c] || { acres: 0, extra: 0, extra_tipo: null };
                  const pct = totalAcresFinca > 0 ? (d.acres / totalAcresFinca) * 100 : 0;
                  const style = isEmbolse ? getEmbolseStyle(d.acres) : getCellStyle(pct);
                  const racimos = Math.round(d.acres);

                  return (
                    <div
                      key={c}
                      className={`flex flex-col items-center justify-center rounded-lg ${style.bg} transition-colors px-1`}
                      style={{ width: "60px", minHeight: "68px" }}
                      title={`Ciclo ${c}: ${isEmbolse ? `${racimos} racimos` : `${pct.toFixed(1)}% | ${d.acres.toFixed(1)} ac`}${d.extra > 0 && d.extra_tipo ? ` | ${d.extra.toFixed(1)} ${d.extra_tipo}` : ""}`}
                    >
                      <span className="text-xs text-muted-foreground font-medium leading-none mb-0.5">C{c}</span>
                      <span className={`text-sm font-bold leading-none ${style.text}`}>
                        {isEmbolse
                          ? (racimos > 0 ? `${racimos.toLocaleString()}` : "—")
                          : (pct > 0 ? `${pct.toFixed(0)}%` : "—")}
                      </span>
                      {d.acres > 0 && (
                        <span className="leading-none text-muted-foreground mt-0.5" style={{ fontSize: "9px" }}>
                          {isEmbolse ? "rac." : `${d.acres.toFixed(1)}ac`}
                        </span>
                      )}
                      {d.extra > 0 && d.extra_tipo && (
                        <span className="leading-none text-muted-foreground mt-0.5" style={{ fontSize: "8px" }}>
                          {d.extra % 1 === 0 ? d.extra : d.extra.toFixed(1)} {d.extra_tipo.slice(0, 3)}
                        </span>
                      )}
                    </div>
                  );
                })}
                </div>
              )}

              {/* Totales por Minifinca (solo Embolse) */}
              {isEmbolse && hasData && (() => {
                const mfData = embolsePorMinifinca.result[labor.id] || {};
                const minifincas = embolsePorMinifinca.minifincas.filter(mf => {
                  return ciclos.some(c => (mfData[mf]?.[c] || 0) > 0);
                });
                if (minifincas.length === 0) return null;
                return (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Totales por Minifinca</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs border-collapse w-full">
                        <thead>
                          <tr style={{ backgroundColor: "#1e4d2b" }}>
                            <th className="px-3 py-1.5 text-left font-bold text-white border border-gray-400" style={{ minWidth: "100px" }}>Minifinca</th>
                            {ciclos.map(c => (
                              <th key={c} className="px-2 py-1.5 text-center font-bold text-white border border-gray-400" style={{ minWidth: "45px" }}>C{c}</th>
                            ))}
                            <th className="px-2 py-1.5 text-center font-bold text-white border border-gray-400" style={{ minWidth: "55px" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {minifincas.map((mf, idx) => {
                            const totalMf = ciclos.reduce((sum, c) => sum + (mfData[mf]?.[c] || 0), 0);
                            return (
                              <tr key={mf} style={{ backgroundColor: idx % 2 === 0 ? "#f5f5f5" : "#ffffff" }}>
                                <td className="px-3 py-1.5 border border-gray-300 font-medium">{mf}</td>
                                {ciclos.map(c => {
                                  const val = Math.round(mfData[mf]?.[c] || 0);
                                  return (
                                    <td key={c} className="px-2 py-1.5 border border-gray-300 text-center" style={{ backgroundColor: val > 0 ? "#E3F2FD" : undefined }}>
                                      {val > 0 ? val.toLocaleString() : "—"}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5 border border-gray-400 text-center font-bold" style={{ backgroundColor: "#BBDEFB" }}>
                                  {Math.round(totalMf).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: "#1e4d2b" }}>
                            <td className="px-3 py-1.5 font-bold text-white border border-gray-400">TOTAL</td>
                            {ciclos.map(c => {
                              const tot = minifincas.reduce((sum, mf) => sum + (mfData[mf]?.[c] || 0), 0);
                              return (
                                <td key={c} className="px-2 py-1.5 text-center font-bold text-white border border-gray-400">
                                  {tot > 0 ? Math.round(tot).toLocaleString() : "—"}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-center font-bold text-white border border-gray-400">
                              {Math.round(minifincas.reduce((sum, mf) => sum + ciclos.reduce((s2, c) => s2 + (mfData[mf]?.[c] || 0), 0), 0)).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {hasData && !isEmbolse && totalAcresFinca > 0 && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-yellow-100 border border-yellow-300 inline-block"/>1–39%</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-green-100 border border-green-300 inline-block"/>40–74%</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-green-200 border border-green-500 inline-block"/>75–99%</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-400 inline-block"/>≥100%</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
