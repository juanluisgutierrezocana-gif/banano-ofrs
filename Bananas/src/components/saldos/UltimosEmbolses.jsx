import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

/**
 * UltimosEmbolses
 * Muestra un resumen rápido de los embolses más recientes (últimas 5 semanas).
 * Props:
 *   embolses — array de inventario_embolse, ordenado por semana desc
 */
export default function UltimosEmbolses({ embolses = [] }) {
  // Agrupar por semana y calcular totales agregados
  const resumen = useMemo(() => {
    const mapa = {};
    embolses.forEach(e => {
      const sem = e.semana;
      if (!mapa[sem]) {
        mapa[sem] = { semana: sem, total: 0, cosechado: 0, perdidas: 0, saldo: 0, colores: [] };
      }
      mapa[sem].total     += e.total      || 0;
      mapa[sem].cosechado += e.cosechado  || 0;
      mapa[sem].perdidas  += e.perdidas   || 0;
      mapa[sem].saldo     += e.saldo      ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));
      if (e.color_hex) {
        mapa[sem].colores.push({ hex: e.color_hex, name: e.color_name });
      }
    });

    // Ordenar por semana desc y tomar las 5 más recientes
    return Object.values(mapa)
      .sort((a, b) => Number(b.semana) - Number(a.semana))
      .slice(0, 5);
  }, [embolses]);

  if (!resumen.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {resumen.map(r => {
        const pctSaldo = r.total > 0 ? Math.round((r.saldo / r.total) * 100) : 0;
        return (
          <Card key={r.semana} className="border shadow-sm">
            <CardContent className="p-3 space-y-2">
              {/* Encabezado */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">S{r.semana}</span>
                <div className="flex gap-0.5">
                  {r.colores.slice(0, 3).map((c, i) => (
                    <div
                      key={i}
                      title={c.name}
                      className="w-3 h-3 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Métricas */}
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" /> Total
                  </span>
                  <span className="font-semibold text-foreground">{r.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cosechado</span>
                  <span className="font-semibold text-green-700">{r.cosechado.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Pérdidas</span>
                  <span className="font-semibold text-destructive">{r.perdidas.toLocaleString()}</span>
                </div>
              </div>

              {/* Barra de saldo */}
              <div className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Saldo</span>
                  <span className="text-xs font-bold text-primary">{pctSaldo}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, pctSaldo))}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-primary text-right">
                  {r.saldo.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
