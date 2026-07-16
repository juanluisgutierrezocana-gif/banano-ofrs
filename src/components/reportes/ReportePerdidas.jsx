import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { losses } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { exportStyledExcel } from "@/utils/excelExport";

export default function ReportePerdidas() {
  // Cargar todos los registros de pérdidas
  const { data: perdidas = [], isLoading } = useQuery({
    queryKey: ["perdidas-reporte"],
    queryFn: async () => {
      const { data, error } = await losses.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Semanas de cosecha únicas (no_semana), ordenadas
  const semanasUnicas = useMemo(() => {
    const s = new Set(perdidas.map(r => r.no_semana).filter(n => n != null));
    return Array.from(s).sort((a, b) => a - b);
  }, [perdidas]);

  // Agrupar por (semana_embolse, color_name): fila de la tabla
  // Cada celda = { cantidad, causa } para la semana de cosecha X
  const grupos = useMemo(() => {
    const mapa = {};
    perdidas.forEach(r => {
      const key = `${r.semana}||${r.color_name || "—"}`;
      if (!mapa[key]) {
        mapa[key] = {
          semana: r.semana,
          color_name: r.color_name || "—",
          celdas: {}, // no_semana → { cantidad, causa }
        };
      }
      const ns = r.no_semana;
      if (ns != null) {
        if (!mapa[key].celdas[ns]) {
          mapa[key].celdas[ns] = { cantidad: 0, causa: r.causa || "" };
        }
        mapa[key].celdas[ns].cantidad += r.cantidad || 0;
        // Si hay múltiples causas para la misma semana de cosecha, concatenar
        if (r.causa && !mapa[key].celdas[ns].causa.includes(r.causa)) {
          mapa[key].celdas[ns].causa = mapa[key].celdas[ns].causa
            ? `${mapa[key].celdas[ns].causa}, ${r.causa}`
            : r.causa;
        }
      }
    });
    // Ordenar por semana_embolse desc, luego color
    return Object.values(mapa).sort((a, b) => {
      if (b.semana !== a.semana) return b.semana - a.semana;
      return (a.color_name || "").localeCompare(b.color_name || "");
    });
  }, [perdidas]);

  // Total general de pérdidas por semana de cosecha
  const totalesPorSemana = useMemo(() => {
    const t = {};
    perdidas.forEach(r => {
      if (r.no_semana != null) {
        t[r.no_semana] = (t[r.no_semana] || 0) + (r.cantidad || 0);
      }
    });
    return t;
  }, [perdidas]);

  const totalGeneral = perdidas.reduce((s, r) => s + (r.cantidad || 0), 0);

  // ── Export Excel ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const encSem = semanasUnicas.flatMap(s => [`SEM ${s}`, "CAUSA"]);
    const headers = ["Sem. Embolse", "Color", ...encSem, "Total"];

    const rows = grupos.map(g => {
      const semCols = semanasUnicas.flatMap(s => {
        const c = g.celdas[s];
        return c ? [c.cantidad, c.causa || "—"] : ["", ""];
      });
      const totalFila = Object.values(g.celdas).reduce((s, c) => s + c.cantidad, 0);
      return [`S${g.semana}`, g.color_name, ...semCols, totalFila];
    });

    const totalsRow = [
      "TOTAL", "",
      ...semanasUnicas.flatMap(s => [totalesPorSemana[s] || 0, ""]),
      totalGeneral,
    ];

    exportStyledExcel({
      title: "Reporte de Pérdidas",
      headers,
      rows,
      totalsRow,
      sheetName: "Pérdidas",
      fileName: `reporte-perdidas-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="font-heading">Reporte de Pérdidas</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!perdidas.length}
          >
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : !perdidas.length ? (
          <p className="text-center text-muted-foreground py-8">No hay registros de pérdidas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/80 sticky top-0 z-10">
                  <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">
                    Sem. Embolse
                  </th>
                  <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">
                    Color
                  </th>
                  {semanasUnicas.map(s => (
                    <React.Fragment key={s}>
                      <th className="py-2 px-2 text-center font-semibold border border-border whitespace-nowrap bg-destructive/10 text-destructive">
                        SEM {s}
                      </th>
                      <th className="py-2 px-2 text-center font-semibold border border-border whitespace-nowrap text-muted-foreground">
                        CAUSA
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap text-destructive">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g, idx) => {
                  const totalFila = Object.values(g.celdas).reduce((s, c) => s + c.cantidad, 0);
                  return (
                    <tr
                      key={`${g.semana}-${g.color_name}`}
                      className={`border-b ${idx % 2 === 0 ? "bg-muted/20" : "bg-background"} hover:bg-muted/40 transition-colors`}
                    >
                      <td className="py-2 px-3 font-semibold border border-border whitespace-nowrap">
                        S{g.semana}
                      </td>
                      <td className="py-2 px-3 border border-border whitespace-nowrap">
                        {g.color_name}
                      </td>
                      {semanasUnicas.map(s => {
                        const celda = g.celdas[s];
                        return (
                          <React.Fragment key={s}>
                            <td className="py-2 px-2 text-center border border-border">
                              {celda ? (
                                <span className="font-semibold text-destructive">{celda.cantidad}</span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center border border-border text-muted-foreground text-xs">
                              {celda?.causa || ""}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="py-2 px-3 text-center border border-border font-bold text-destructive">
                        {totalFila > 0 ? totalFila : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Fila de totales */}
                <tr className="bg-destructive/10 font-bold border-t-2 border-destructive/30">
                  <td className="py-2 px-3 border border-border font-bold" colSpan={2}>
                    TOTAL
                  </td>
                  {semanasUnicas.map(s => (
                    <React.Fragment key={s}>
                      <td className="py-2 px-2 text-center border border-border font-bold text-destructive">
                        {totalesPorSemana[s] || 0}
                      </td>
                      <td className="py-2 px-2 border border-border" />
                    </React.Fragment>
                  ))}
                  <td className="py-2 px-3 text-center border border-border font-bold text-destructive">
                    {totalGeneral}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
