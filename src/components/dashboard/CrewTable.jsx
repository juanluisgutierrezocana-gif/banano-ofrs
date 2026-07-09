import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function CrewTable({ trenadas, buttons }) {
  // BALANCE editable por cuadrilla. Se guarda en estado local (por sesión).
  // RAC. FALTANTES = BALANCE ingresado − total racimos de esa cuadrilla.
  const [balances, setBalances] = useState({});
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
    return Array.from(keys);
  }, [crewData]);

  if (!crewData.length) {
    return null;
  }

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
                <th className="text-center py-2 px-3 font-semibold">Balance</th>
                <th className="text-center py-2 px-3 font-semibold">Rac. Faltantes</th>
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
                    {crew.lastTime ? (crew.lastTime.length <= 5 ? crew.lastTime : format(new Date(crew.lastTime), "HH:mm")) : "-"}
                  </td>
                  <td className="text-center py-1 px-2">
                    <input
                      type="number"
                      min="0"
                      className="w-20 text-center rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      value={balances[crew.cuadrilla] ?? ""}
                      onChange={(e) =>
                        setBalances((b) => ({ ...b, [crew.cuadrilla]: e.target.value }))
                      }
                      placeholder="—"
                    />
                  </td>
                  <td className="text-center py-2 px-3 font-medium">
                    {balances[crew.cuadrilla] !== undefined && balances[crew.cuadrilla] !== ""
                      ? Number(balances[crew.cuadrilla]) - crew.total
                      : "—"}
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