import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { exportStyledExcel } from "@/utils/excelExport";

export default function ReporteGeneral() {
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));

const { data: trenadaRecords = [], isLoading } = useQuery({
  queryKey: ["trenadas-report", fecha],
  queryFn: async () => {
    const { data, error } = await trenadas.filter({ fecha }, "correlativo");
    if (error) throw error;
    return data ?? [];
  },
});

const { data: buttons = [] } = useQuery({
  // FIXED: la queryKey ["buttons"] colisionaba con la de PanelDiario.jsx, que
  // cachea bajo la MISMA key un objeto { data: [...] } en vez de un array.
  // Al navegar a Reportería después de Panel Diario, React Query devolvía
  // primero ese valor cacheado con forma distinta, y buttons.forEach()
  // tronaba con TypeError (sin ErrorBoundary, esto deja toda la app en blanco
  // hasta que se hace refresh, que limpia el cache en memoria).
  queryKey: ["buttons-reporte-general"],
  queryFn: async () => {
    const { data, error } = await supabase.from("button_config").select("*").eq("active", true).order("position");
    if (error) throw error;
    return data ?? [];
  },
});

  const colorKeys = useMemo(() => {
    const keys = new Set();
    // Primero incluir todos los botones activos
    buttons.forEach(btn => keys.add(`${btn.color_name} S${btn.week_age}`));
    // Luego incluir los que vengan en trenadaRecords (por si hay datos de botones ya eliminados)
    trenadaRecords.forEach(t => (t.racimos || []).forEach(r => keys.add(`${r.color_name} S${r.week_age}`)));
    return Array.from(keys);
  }, [trenadaRecords, buttons]);

  const exportExcel = () => {
    const headers = ["No.", "Hora", "Cuadrilla", "Conchero", "Cortero", "Sección", "Línea", ...colorKeys, "Total", "Acumulado"];
    let acumulado = 0;
    const rows = trenadaRecords.map((t, idx) => {
      acumulado += t.total_racimos || 0;
      const colorCounts = {};
      (t.racimos || []).forEach(r => { colorCounts[`${r.color_name} S${r.week_age}`] = r.count; });
      return [
        idx + 1, t.hora, `#${t.cuadrilla}`, t.conchero, t.cortero, t.seccion, t.linea,
        ...colorKeys.map(k => colorCounts[k] || 0),
        t.total_racimos, acumulado
      ];
    });
    // Fila de totales
    const totalsRow = ["TOTAL", "", "", "", "", "", "",
      ...colorKeys.map(k => {
        let sum = 0;
        trenadaRecords.forEach(t => { const m = {}; (t.racimos||[]).forEach(r=>{m[`${r.color_name} S${r.week_age}`]=r.count;}); sum += m[k]||0; });
        return sum;
      }),
      trenadaRecords.reduce((s, t) => s + (t.total_racimos || 0), 0), ""
    ];
    exportStyledExcel({
      title: `Reporte General Diario — ${fecha}`,
      headers, rows, totalsRow,
      sheetName: "Reporte General",
      fileName: `reporte-general-${fecha}.xlsx`,
    });
  };

  let runningTotal = 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="font-heading">Reporte General Diario</CardTitle>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!colorKeys.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : !trenadaRecords.length && !colorKeys.length ? (
          <p className="text-center text-muted-foreground py-8">No hay trenadas para esta fecha</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="py-2 px-2 text-left">No.</th>
                  <th className="py-2 px-2 text-left">Hora</th>
                  <th className="py-2 px-2 text-left">Cuad.</th>
                  <th className="py-2 px-2 text-left">Conchero</th>
                  <th className="py-2 px-2 text-left">Cortero</th>
                  <th className="py-2 px-2 text-left">Sección</th>
                  <th className="py-2 px-2 text-left">Línea</th>
                  {colorKeys.map(k => <th key={k} className="py-2 px-2 text-center">{k}</th>)}
                  <th className="py-2 px-2 text-center">Total</th>
                  <th className="py-2 px-2 text-center">Acum.</th>
                </tr>
              </thead>
              <tbody>
                {trenadaRecords.map((t, idx) => {
                   runningTotal += t.total_racimos || 0;
                   const colorCounts = {};
                   (t.racimos || []).forEach(r => { colorCounts[`${r.color_name} S${r.week_age}`] = r.count; });
                   return (
                     <tr key={t.id} className="border-b hover:bg-muted/50">
                       <td className="py-2 px-2 font-bold">{idx + 1}</td>
                      <td className="py-2 px-2">{t.hora}</td>
                      <td className="py-2 px-2 font-semibold">#{t.cuadrilla}</td>
                      <td className="py-2 px-2">{t.conchero}</td>
                      <td className="py-2 px-2">{t.cortero}</td>
                      <td className="py-2 px-2">{t.seccion}</td>
                      <td className="py-2 px-2">{t.linea}</td>
                      {colorKeys.map(k => <td key={k} className="py-2 px-2 text-center">{colorCounts[k] || 0}</td>)}
                      <td className="py-2 px-2 text-center font-bold">{t.total_racimos}</td>
                      <td className="py-2 px-2 text-center font-bold text-primary">{runningTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}