import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Tabla de Balance / Racimos Faltantes por cuadrilla.
// Solo dos columnas: Balance (input manual) y Rac. Faltantes (calculado).
// La cuadrilla se identifica como label inline junto al input.
// FIXED: localStorage por fecha — el state sobrevive navegación entre módulos.
export default function BalanceTable({ trenadas, fecha }) {
  const [balances, setBalances] = useState({});

  // Cargar desde localStorage cuando cambia la fecha (incluyendo el montaje
  // inicial). Cada fecha tiene su propia clave para no mezclar datos de días.
  useEffect(() => {
    if (!fecha) return;
    try {
      const saved = localStorage.getItem(`balance_${fecha}`);
      setBalances(saved ? JSON.parse(saved) : {});
    } catch {
      setBalances({});
    }
  }, [fecha]);

  const crewTotals = useMemo(() => {
    const crews = {};
    trenadas.forEach(t => {
      const c = t.cuadrilla;
      if (!crews[c]) crews[c] = { cuadrilla: c, total: 0 };
      crews[c].total += t.total_racimos || 0;
    });
    return Object.values(crews).sort((a, b) => a.cuadrilla - b.cuadrilla);
  }, [trenadas]);

  if (!crewTotals.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Balance / Rac. Faltantes</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b">
              <th className="text-center py-2 px-3 font-semibold">Balance</th>
              <th className="text-center py-2 px-3 font-semibold">Rac. Faltantes</th>
            </tr>
          </thead>
          <tbody>
            {crewTotals.map(crew => (
              <tr key={crew.cuadrilla} className="border-b last:border-0">
                <td className="text-center py-1 px-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs font-bold text-primary">#{crew.cuadrilla}</span>
                    <input
                      type="number"
                      min="0"
                      className="w-20 text-center rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      value={balances[crew.cuadrilla] ?? ""}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setBalances((b) => {
                          const next = { ...b, [crew.cuadrilla]: valor };
                          try {
                            if (fecha) localStorage.setItem(`balance_${fecha}`, JSON.stringify(next));
                          } catch {}
                          return next;
                        });
                      }}
                      placeholder="—"
                    />
                  </div>
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
      </CardContent>
    </Card>
  );
}
