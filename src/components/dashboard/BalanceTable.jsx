import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { balanceCuadrilla } from "@/api/supabaseClient";

// Tabla de Balance / Racimos Faltantes por cuadrilla.
// FIXED: migrado de localStorage a Supabase para que todos los usuarios
// vean y editen el mismo balance en tiempo real (localStorage era por
// dispositivo y los cambios no se propagaban a otros usuarios).
export default function BalanceTable({ trenadas, fecha }) {
  const queryClient = useQueryClient();

  // Cargar balances desde Supabase para la fecha actual
  const { data: balancesDB = [] } = useQuery({
    queryKey: ["balance-cuadrilla", fecha],
    queryFn: async () => {
      if (!fecha) return [];
      const { data, error } = await balanceCuadrilla.getByFecha(fecha);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!fecha,
  });

  // Mapa cuadrilla → balance (desde Supabase)
  const balancesMap = useMemo(() => {
    const m = {};
    balancesDB.forEach(r => { m[r.cuadrilla] = r.balance; });
    return m;
  }, [balancesDB]);

  // Estado local para edición optimista (evita lag al escribir)
  const [localBalances, setLocalBalances] = useState({});

  // Sincronizar estado local cuando llegan datos de Supabase
  useEffect(() => {
    setLocalBalances(balancesMap);
  }, [balancesDB]);

  // Debounce: guardar en Supabase 800ms después de dejar de escribir
  const saveTimers = useRef({});

  const handleChange = (cuadrilla, valor) => {
    setLocalBalances(prev => ({ ...prev, [cuadrilla]: valor }));

    // Cancelar timer anterior para esta cuadrilla
    if (saveTimers.current[cuadrilla]) {
      clearTimeout(saveTimers.current[cuadrilla]);
    }

    // Guardar en Supabase tras 800ms de inactividad
    saveTimers.current[cuadrilla] = setTimeout(async () => {
      const num = valor === "" ? null : Number(valor);
      await balanceCuadrilla.upsert(fecha, cuadrilla, num);
      // Invalidar cache para que otros usuarios reciban el nuevo valor
      queryClient.invalidateQueries({ queryKey: ["balance-cuadrilla", fecha] });
    }, 800);
  };

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
            {crewTotals.map(crew => {
              const val = localBalances[crew.cuadrilla];
              const racFaltantes = val !== undefined && val !== "" && val !== null
                ? Number(val) - crew.total
                : "—";
              return (
                <tr key={crew.cuadrilla} className="border-b last:border-0">
                  <td className="text-center py-1 px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs font-bold text-primary">#{crew.cuadrilla}</span>
                      <input
                        type="number"
                        min="0"
                        className="w-20 text-center rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={val ?? ""}
                        onChange={e => handleChange(crew.cuadrilla, e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  </td>
                  <td className="text-center py-2 px-3 font-medium">
                    {racFaltantes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
