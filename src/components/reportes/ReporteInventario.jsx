import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportStyledExcel } from "@/utils/excelExport";

export default function ReporteInventario() {
  const [filterType, setFilterType] = useState("all");
  const [filterSeccion, setFilterSeccion] = useState("");
  const [filterColor, setFilterColor] = useState("");

  const { data: embolses = [], isLoading } = useQuery({
    queryKey: ["embolses"],
    queryFn: () => inventory.listEmbolse(),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: () => sections.filter({ active: true }),
  });

  const { data: colors = [] } = useQuery({
    queryKey: ["colors-active"],
    queryFn: () => colors.filter({ active: true }),
  });

  const filtered = embolses.filter(e => {
    if (filterType === "seccion" && filterSeccion && e.seccion !== filterSeccion) return false;
    if (filterType === "color" && filterColor && e.color_name !== filterColor) return false;
    return true;
  });

  const exportExcel = () => {
    const headers = ["Semana", "Color", "Sección", "Total Embolse", "Cosechado", "Pérdidas", "Saldo"];
    const rows = filtered.map(e => [
      `S${e.semana}`, e.color_name, e.seccion || "General",
      e.total, e.cosechado || 0, e.perdidas || 0,
      e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0))
    ]);
    const totalsRow = ["TOTAL", "", "",
      filtered.reduce((s, e) => s + (e.total || 0), 0),
      filtered.reduce((s, e) => s + (e.cosechado || 0), 0),
      filtered.reduce((s, e) => s + (e.perdidas || 0), 0),
      filtered.reduce((s, e) => s + (e.saldo ?? (e.total - (e.cosechado||0) - (e.perdidas||0))), 0),
    ];
    exportStyledExcel({
      title: "Reporte de Inventario de Embolse",
      headers, rows, totalsRow,
      sheetName: "Inventario",
      fileName: `reporte-inventario-${new Date().toISOString().slice(0,10)}.xlsx`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="font-heading">Reporte de Inventario</CardTitle>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-xs">Filtrar por</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo</SelectItem>
                  <SelectItem value="seccion">Sección</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterType === "seccion" && (
              <div>
                <Label className="text-xs">Sección</Label>
                <Select value={filterSeccion} onValueChange={setFilterSeccion}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {sections.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filterType === "color" && (
              <div>
                <Label className="text-xs">Color</Label>
                <Select value={filterColor} onValueChange={setFilterColor}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {colors.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : !filtered.length ? (
          <p className="text-center text-muted-foreground py-8">No hay datos de inventario</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="py-2 px-3 text-left">Semana</th>
                  <th className="py-2 px-3 text-left">Color</th>
                  <th className="py-2 px-3 text-left">Sección</th>
                  <th className="py-2 px-3 text-center">Total</th>
                  <th className="py-2 px-3 text-center">Cosechado</th>
                  <th className="py-2 px-3 text-center">Pérdidas</th>
                  <th className="py-2 px-3 text-center">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-semibold">S{e.semana}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: e.color_hex }} />
                        {e.color_name}
                      </div>
                    </td>
                    <td className="py-2 px-3">{e.seccion || "General"}</td>
                    <td className="py-2 px-3 text-center">{e.total}</td>
                    <td className="py-2 px-3 text-center">{e.cosechado || 0}</td>
                    <td className="py-2 px-3 text-center text-destructive">{e.perdidas || 0}</td>
                    <td className="py-2 px-3 text-center font-bold text-primary">
                      {e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0))}
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