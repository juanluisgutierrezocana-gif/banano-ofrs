import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, subDays } from "date-fns";
import { exportStyledExcel } from "@/utils/excelExport";

const SEMANAS = [14, 13, 12, 11, 10];

export default function ReporteOrdenCalibre() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [desde, setDesde] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(today);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["orden-calibre-reporte", desde, hasta],
    queryFn: async () => {
  const { data, error } = await supabase.from("orden_calibre").select("*").gte("fecha", desde).lte("fecha", hasta);
  if (error) throw error;
  return data ?? [];
},
  });

  // Filtrar por rango de fechas
  const filtered = registros.filter(r => r.fecha >= desde && r.fecha <= hasta);

  // Agrupar por fecha → { fecha: { semana: { sub_basal, apical } } }
  const grouped = {};
  filtered.forEach(r => {
    if (!grouped[r.fecha]) grouped[r.fecha] = {};
    grouped[r.fecha][r.semana] = r;
  });

  const fechas = Object.keys(grouped).sort();

  // Exportar Excel (mismo diseño que el resto de reportes: título,
  // encabezados en verde, filas alternadas y bordes).
  const exportExcel = () => {
    const headers = ["Fecha"];
    SEMANAS.forEach(s => {
      headers.push(`Sem${s} Sub-Basal`, `Sem${s} Apical`);
    });

    const rows = fechas.map(fecha => {
      const row = [fecha];
      SEMANAS.forEach(s => {
        const d = grouped[fecha]?.[s];
        row.push(d?.sub_basal ?? "", d?.apical ?? "");
      });
      return row;
    });

    exportStyledExcel({
      title: `Reporte Orden de Calibre — ${desde} al ${hasta}`,
      headers,
      rows,
      sheetName: "Orden Calibre",
      fileName: `orden_calibre_${desde}_${hasta}.xlsx`,
    });
  };

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base">Reporte Orden de Calibre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Desde:</label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Hasta:</label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2 ml-auto">
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Cargando...</div>
        ) : fechas.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No hay datos en el rango seleccionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left py-2 px-3 font-semibold rounded-tl-lg sticky left-0 bg-muted z-10">Fecha</th>
                  {SEMANAS.map(s => (
                    <th key={s} colSpan={2} className="text-center py-2 px-2 font-semibold border-l border-border">
                      Sem {s}
                    </th>
                  ))}
                </tr>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="sticky left-0 bg-muted/60"></th>
                  {SEMANAS.map(s => (
                    <>
                      <th key={`${s}-sb`} className="text-center py-1 px-2 font-medium text-muted-foreground border-l border-border text-[11px]">Sub-Basal</th>
                      <th key={`${s}-ap`} className="text-center py-1 px-2 font-medium text-muted-foreground text-[11px]">Apical</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fechas.map((fecha, idx) => (
                  <tr key={fecha} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="py-2 px-3 font-medium sticky left-0 bg-inherit z-10">{fecha}</td>
                    {SEMANAS.map(s => {
                      const d = grouped[fecha]?.[s];
                      return (
                        <>
                          <td key={`${s}-sb`} className="py-2 px-3 text-center border-l border-border">
                            {d?.sub_basal ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td key={`${s}-ap`} className="py-2 px-3 text-center">
                            {d?.apical ?? <span className="text-muted-foreground">—</span>}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}