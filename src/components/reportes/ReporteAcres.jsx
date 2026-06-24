import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, subDays } from "date-fns";
import * as XLSX from "xlsx";

// Rediseño: ya no son columnas fijas por semana (Sub-Basal/Apical). Ahora
// las columnas son dinámicas por minifinca (Minifinca 1, Minifinca 2, ...),
// según la mayor cantidad usada en el rango de fechas, más una columna Total.
export default function ReporteAcres() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [desde, setDesde] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(today);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["acres-reporte", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase.from("orden_acres").select("*").gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Solo registros del nuevo formato (con columna "minifinca" poblada).
  // Registros antiguos por semana (sub_basal/apical) ya no se muestran aquí.
  const filtered = registros.filter((r) => r.minifinca && r.fecha >= desde && r.fecha <= hasta);

  // Agrupar por fecha → { minifinca: acres }
  const grouped = {};
  filtered.forEach((r) => {
    if (!grouped[r.fecha]) grouped[r.fecha] = {};
    grouped[r.fecha][r.minifinca] = r.acres;
  });

  const fechas = Object.keys(grouped).sort();

  // Columnas dinámicas: unión de todas las minifincas usadas en el rango,
  // ordenadas por el número ("Minifinca 1" antes que "Minifinca 2", etc.).
  const minifincaNum = (nombre) => parseInt(nombre.replace(/\D/g, ""), 10) || 0;
  const minifincas = Array.from(new Set(filtered.map((r) => r.minifinca))).sort(
    (a, b) => minifincaNum(a) - minifincaNum(b)
  );

  const totalFecha = (fecha) =>
    minifincas.reduce((sum, mf) => sum + (parseFloat(grouped[fecha]?.[mf]) || 0), 0);

  // Exportar Excel
  const exportExcel = () => {
    const headers = ["Fecha", ...minifincas, "Total"];
    const rows = fechas.map((fecha) => {
      const row = [fecha];
      minifincas.forEach((mf) => row.push(grouped[fecha]?.[mf] ?? ""));
      row.push(totalFecha(fecha));
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Acres");
    XLSX.writeFile(wb, `acres_${desde}_${hasta}.xlsx`);
  };

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base">Reporte Acres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Desde:</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Hasta:</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-36 h-8 text-sm" />
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
                  {minifincas.map((mf) => (
                    <th key={mf} className="text-center py-2 px-3 font-semibold border-l border-border">
                      {mf}
                    </th>
                  ))}
                  <th className="text-center py-2 px-3 font-semibold border-l border-border rounded-tr-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {fechas.map((fecha, idx) => (
                  <tr key={fecha} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="py-2 px-3 font-medium sticky left-0 bg-inherit z-10">{fecha}</td>
                    {minifincas.map((mf) => (
                      <td key={mf} className="py-2 px-3 text-center border-l border-border">
                        {grouped[fecha]?.[mf] ?? <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center border-l border-border font-bold text-primary">
                      {totalFecha(fecha).toFixed(2)}
                    </td>
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
