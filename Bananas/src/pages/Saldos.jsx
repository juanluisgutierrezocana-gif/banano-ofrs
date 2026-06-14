import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import UltimosEmbolses from "@/components/saldos/UltimosEmbolses";

function getTextColor(hex) {
  if (!hex) return "text-foreground";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "text-gray-800" : "text-white";
}

function pct(num, total) {
  if (!total) return 0;
  return Math.round((num / total) * 100);
}

export default function Saldos() {
  const { data: embolses = [], isLoading } = useQuery({
    queryKey: ["embolses"],
    queryFn: async () => {
      // FIXED: listEmbolse() no existe → usar list() estándar de createEntity
      const { data, error } = await inventory.list("semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sorted = useMemo(() =>
    [...embolses].sort((a, b) => b.semana - a.semana),
    [embolses]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Saldos de Inventario</h1>

      {!isLoading && embolses.length > 0 && (
        <UltimosEmbolses embolses={sorted} />
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-16">Cargando...</p>
      ) : !embolses.length ? (
        <p className="text-center text-muted-foreground py-16">No hay embolses registrados</p>
      ) : (
        <Card className="shadow-md border-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="py-3 px-4 text-left font-semibold text-muted-foreground whitespace-nowrap min-w-[140px]">
                      Color / Sem.
                    </th>
                    <th className="py-3 px-4 text-center font-semibold text-muted-foreground whitespace-nowrap">
                      Total
                    </th>
                    <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                      <span className="text-green-700">Cosechado</span>
                      <span className="block text-[10px] font-normal text-green-600 opacity-70">%</span>
                    </th>
                    <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                      <span className="text-destructive">Pérdidas</span>
                      <span className="block text-[10px] font-normal text-destructive opacity-70">%</span>
                    </th>
                    <th className="py-3 px-4 text-center font-semibold whitespace-nowrap">
                      <span className="text-primary">Saldo Actual</span>
                      <span className="block text-[10px] font-normal text-primary opacity-70">%</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(e => {
                    const saldo = e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));
                    const cosechado = e.cosechado || 0;
                    const perdidas = e.perdidas || 0;
                    return (
                      <tr key={e.id} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: e.color_hex }} />
                            <span className="font-semibold">S{e.semana}</span>
                            <span className="text-xs text-muted-foreground">— {e.color_name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center font-semibold">{e.total}</td>
                        <td className="py-2 px-4 text-center">
                          <span className="font-bold text-green-700">{cosechado}</span>
                          <span className="text-[11px] text-green-600 ml-1">({pct(cosechado, e.total)}%)</span>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className="font-bold text-destructive">{perdidas}</span>
                          <span className="text-[11px] text-destructive/70 ml-1">({pct(perdidas, e.total)}%)</span>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className={cn("font-bold", saldo <= 0 ? "text-muted-foreground line-through" : "text-primary")}>
                            {saldo}
                          </span>
                          <span className="text-[11px] text-primary/70 ml-1">({pct(saldo, e.total)}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
