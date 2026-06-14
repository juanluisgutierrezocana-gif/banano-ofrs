import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { exportStyledExcel } from "@/utils/excelExport";

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUp className="inline w-3 h-3 ml-1 text-primary" />
    : <ArrowDown className="inline w-3 h-3 ml-1 text-primary" />;
}

export default function ReporteCuadrilla() {
  const [desde, setDesde] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const setToday = () => { const d = format(new Date(), "yyyy-MM-dd"); setDesde(d); setHasta(d); };
  const setWeek = () => { setDesde(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")); setHasta(format(new Date(), "yyyy-MM-dd")); };
  const setMonth = () => { setDesde(format(startOfMonth(new Date()), "yyyy-MM-dd")); setHasta(format(new Date(), "yyyy-MM-dd")); };

  const { data: trenadas = [], isLoading } = useQuery({
    queryKey: ["trenadas-cuadrilla", desde, hasta],
    queryFn: async () => {
  const { data, error } = await trenadas.filter({ fecha: { $gte: desde, $lte: hasta } });
  if (error) throw error;
  return data ?? [];
},
  });

  const { crews, colorKeys, data } = useMemo(() => {
    const crewData = {};
    const colKeys = new Set();
    trenadas.forEach(t => {
      const c = t.cuadrilla;
      if (!crewData[c]) crewData[c] = {};
      (t.racimos || []).forEach(r => {
        const key = `${r.color_name} S${r.week_age}`;
        colKeys.add(key);
        crewData[c][key] = (crewData[c][key] || 0) + r.count;
      });
    });
    return { crews: Object.keys(crewData).map(Number).sort((a, b) => a - b), colorKeys: Array.from(colKeys), data: crewData };
  }, [trenadas]);

  const sortedCrews = useMemo(() => {
    if (!sortKey) return crews;
    return [...crews].sort((a, b) => {
      const valA = sortKey === "total"
        ? colorKeys.reduce((sum, k) => sum + (data[a]?.[k] || 0), 0)
        : (data[a]?.[sortKey] || 0);
      const valB = sortKey === "total"
        ? colorKeys.reduce((sum, k) => sum + (data[b]?.[k] || 0), 0)
        : (data[b]?.[sortKey] || 0);
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [crews, sortKey, sortDir, colorKeys, data]);

  const exportExcel = () => {
    const headers = ["Cuadrilla", ...colorKeys, "Total"];
    const rows = crews.map(c => {
      const total = colorKeys.reduce((sum, k) => sum + (data[c]?.[k] || 0), 0);
      return [`#${c}`, ...colorKeys.map(k => data[c]?.[k] || 0), total];
    });
    const totalsRow = ["TOTAL",
      ...colorKeys.map(k => crews.reduce((s, c) => s + (data[c]?.[k] || 0), 0)),
      crews.reduce((s, c) => s + colorKeys.reduce((sum, k) => sum + (data[c]?.[k] || 0), 0), 0)
    ];
    exportStyledExcel({
      title: `Reporte por Cuadrilla — ${desde} al ${hasta}`,
      headers, rows, totalsRow,
      sheetName: "Por Cuadrilla",
      fileName: `reporte-cuadrilla-${desde}-${hasta}.xlsx`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="font-heading">Reporte por Cuadrilla</CardTitle>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={setToday}>Hoy</Button>
              <Button variant="outline" size="sm" onClick={setWeek}>Semanal</Button>
              <Button variant="outline" size="sm" onClick={setMonth}>Mensual</Button>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36" />
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!crews.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : !crews.length ? (
          <p className="text-center text-muted-foreground py-8">No hay datos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="py-2 px-3 text-left">Cuadrilla</th>
                  {colorKeys.map(k => (
                    <th key={k} className="py-2 px-2 text-center text-xs cursor-pointer select-none hover:bg-muted/80"
                      onClick={() => handleSort(k)}>
                      {k}<SortIcon col={k} sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  ))}
                  <th className="py-2 px-3 text-center cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => handleSort("total")}>
                    Total<SortIcon col="total" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCrews.map(c => {
                  const total = colorKeys.reduce((sum, k) => sum + (data[c]?.[k] || 0), 0);
                  return (
                    <tr key={c} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-bold text-primary">#{c}</td>
                      {colorKeys.map(k => <td key={k} className="py-2 px-2 text-center">{data[c]?.[k] || 0}</td>)}
                      <td className="py-2 px-3 text-center font-bold">{total}</td>
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