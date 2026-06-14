import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { exportStyledExcel } from "@/utils/excelExport";

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUp className="inline w-3 h-3 ml-1 text-primary" />
    : <ArrowDown className="inline w-3 h-3 ml-1 text-primary" />;
}

export default function ReporteSeccion() {
  const [desde, setDesde] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
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

  const { data: trenadaList = [], isLoading: loadingTrenadas } = useQuery({
    queryKey: ["trenadas-seccion", desde, hasta],
    queryFn: async () => {
      const { data, error } = await trenadas.filter({ fecha: { $gte: desde, $lte: hasta } });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activeSections = [], isLoading: loadingSections } = useQuery({
    queryKey: ["sections-active"],
    queryFn: async () => {
      const { data, error } = await sections.filter({ active: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = loadingTrenadas || loadingSections;

  const { sections: sectionNames, colorKeys, data: sectionData } = useMemo(() => {
    const secs = {};
    activeSections.forEach(s => { secs[s.name] = {}; });
    const colKeys = new Set();
    trenadaList.forEach(t => {
      if (!secs[t.seccion]) secs[t.seccion] = {};
      (t.racimos || []).forEach(r => {
        const key = `${r.color_name} S${r.week_age}`;
        colKeys.add(key);
        secs[t.seccion][key] = (secs[t.seccion][key] || 0) + r.count;
      });
    });
    const baseSections = Object.keys(secs).sort();
    return { sections: baseSections, colorKeys: Array.from(colKeys), data: secs };
  }, [trenadaList, activeSections]);

  const sortedSections = useMemo(() => {
    if (!sortKey) return sectionNames;
    return [...sectionNames].sort((a, b) => {
      if (sortKey === "seccion") {
        return sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
      }
      const valA = sortKey === "total"
        ? colorKeys.reduce((sum, k) => sum + (sectionData[a][k] || 0), 0)
        : (sectionData[a][sortKey] || 0);
      const valB = sortKey === "total"
        ? colorKeys.reduce((sum, k) => sum + (sectionData[b][k] || 0), 0)
        : (sectionData[b][sortKey] || 0);
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [sectionNames, sortKey, sortDir, colorKeys, sectionData]);

  const exportExcel = () => {
    const headers = ["Sección", ...colorKeys, "Total"];
    const rows = sectionNames.map(s => {
      const total = colorKeys.reduce((sum, k) => sum + (sectionData[s][k] || 0), 0);
      return [s, ...colorKeys.map(k => sectionData[s][k] || 0), total];
    });
    const totalsRow = ["TOTAL",
      ...colorKeys.map(k => sectionNames.reduce((s, sec) => s + (sectionData[sec][k] || 0), 0)),
      sectionNames.reduce((s, sec) => s + colorKeys.reduce((sum, k) => sum + (sectionData[sec][k] || 0), 0), 0)
    ];
    exportStyledExcel({
      title: `Reporte por Sección — ${desde} al ${hasta}`,
      headers, rows, totalsRow,
      sheetName: "Por Sección",
      fileName: `reporte-seccion-${desde}-${hasta}.xlsx`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="font-heading">Reporte por Sección</CardTitle>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-36" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-36" />
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!sectionNames.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : !sectionNames.length && !activeSections.length ? (
          <p className="text-center text-muted-foreground py-8">No hay secciones activas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="py-2 px-3 text-left cursor-pointer select-none hover:bg-muted/80"
                   onClick={() => handleSort("seccion")}>
                   Sección<SortIcon col="seccion" sortKey={sortKey} sortDir={sortDir} />
                  </th>
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
                {sortedSections.map(s => {
                  const total = colorKeys.reduce((sum, k) => sum + (sectionData[s][k] || 0), 0);
                  return (
                    <tr key={s} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-semibold">{s}</td>
                      {colorKeys.map(k => <td key={k} className="py-2 px-2 text-center">{sectionData[s][k] || 0}</td>)}
                      <td className="py-2 px-3 text-center font-bold">{total}</td>
                    </tr>
                  );
                })}
                <tr className="bg-primary/10 font-bold">
                  <td className="py-2 px-3">TOTAL</td>
                  {colorKeys.map(k => (
                    <td key={k} className="py-2 px-2 text-center">
                      {sectionNames.reduce((s, sec) => s + (sectionData[sec][k] || 0), 0)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center">
                    {sectionNames.reduce((s, sec) => s + colorKeys.reduce((sum, k) => sum + (sectionData[sec][k] || 0), 0), 0)}
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
