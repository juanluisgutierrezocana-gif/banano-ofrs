import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

// Tabla de cuadrillas: colores por edad + total + última trenada.
// Balance / Rac. Faltantes viven en BalanceTable (componente separado).
export default function CrewTable({ trenadas, buttons }) {
  const crewData = useMemo(() => {
    const crews = {};
    trenadas.forEach(t => {
      const c = t.cuadrilla;
      if (!crews[c]) crews[c] = { cuadrilla: c, colors: {}, lastTime: null, total: 0 };
      (t.racimos || []).forEach(r => {
        const key = `${r.color_name}-S${r.week_age}`;
        crews[c].colors[key] = (crews[c].colors[key] || 0) + r.count;
      });
      crews[c].total += t.total_racimos || 0;
      const time = t.hora || t.created_date;
      if (!crews[c].lastTime || time > crews[c].lastTime) crews[c].lastTime = time;
    });
    return Object.values(crews).sort((a, b) => a.cuadrilla - b.cuadrilla);
  }, [trenadas]);

  const colorKeys = useMemo(() => {
    const keys = new Set();
    crewData.forEach(c => Object.keys(c.colors).forEach(k => keys.add(k)));
    // Ordenar por semana numérica (el número después de la "S") ascendente,
    // para que las cintas más viejas (semanas menores) aparezcan primero.
    return Array.from(keys).sort((a, b) => {
      const semA = parseInt(a.match(/S(\d+)/)?.[1] ?? "0");
      const semB = parseInt(b.match(/S(\d+)/)?.[1] ?? "0");
      return semA - semB;
    });
  }, [crewData]);

  if (!crewData.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Cuadrillas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="text-sm min-w-max w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold">Cuadrilla</th>
                {colorKeys.map(k => (
                  <th key={k} className="text-center py-2 px-2 font-semibold text-xs">{k}</th>
                ))}
                <th className="text-center py-2 px-3 font-semibold">Total</th>
                <th className="text-center py-2 px-3 font-semibold">Última Trenada</th>
              </tr>
            </thead>
            <tbody>
              {crewData.map(crew => (
                <tr key={crew.cuadrilla} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 px-3 font-bold text-primary">#{crew.cuadrilla}</td>
                  {colorKeys.map(k => (
                    <td key={k} className="text-center py-2 px-2">{crew.colors[k] || 0}</td>
                  ))}
                  <td className="text-center py-2 px-3 font-bold">{crew.total}</td>
                  <td className="text-center py-2 px-3 text-muted-foreground text-xs">
                    {crew.lastTime
                      ? (crew.lastTime.length <= 5 ? crew.lastTime : format(new Date(crew.lastTime), "HH:mm"))
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
