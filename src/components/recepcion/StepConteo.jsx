import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/useSettings";
import { cn } from "@/lib/utils";
import { Minus, Save, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useTapSound, useSaveSound } from "@/hooks/useSound";

function getTextColor(hex) {
  if (!hex) return "text-foreground";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "text-gray-800" : "text-white";
}

export default function StepConteo({ info, onSave, onBack }) {
  // Cargar botones configurados por el admin (solo activos)
  const { data: buttonConfigs = [] } = useQuery({
    queryKey: ["buttons-active"],
    queryFn: () => supabase.from("button_config").select("*").eq("active", true).order("position"),
  });

  // Cargar embolses para obtener saldos actualizados
  const { data: embolses = [] } = useQuery({
    queryKey: ["embolses"],
    queryFn: () => inventory.listEmbolse("semana"),
  });

  // Cruzar botones configurados con embolses: solo los activos que tienen saldo > 0
  const buttons = useMemo(() =>
    buttonConfigs
      .map(bc => {
        const embolse = embolses.find(e => e.id === bc.color_id);
        if (!embolse) return null;
        const saldo = embolse.saldo ?? (embolse.total - (embolse.cosechado || 0) - (embolse.perdidas || 0));
        if (saldo <= 0) return null;
        return { ...embolse, week_age: bc.week_age, _buttonId: bc.id };
      })
      .filter(Boolean),
    [buttonConfigs, embolses]
  );

  const { getRangoMin, getRangoMax } = useSettings();
  const rangoMin = getRangoMin();
  const rangoMax = getRangoMax();

  const [counts, setCounts] = useState({});
  const queryClient = useQueryClient();
  const { play: playSound } = useTapSound();
  const { play: playSaveSound } = useSaveSound();

  const handleTap = (embolse) => {
    const saldo = embolse.saldo ?? (embolse.total - (embolse.cosechado || 0) - (embolse.perdidas || 0));
    const current = counts[embolse.id] || 0;
    if (current >= saldo) return; // no superar saldo
    playSound();
    setCounts(prev => ({ ...prev, [embolse.id]: current + 1 }));
  };

  const handleMinus = (embolse, e) => {
    e.stopPropagation();
    setCounts(prev => ({ ...prev, [embolse.id]: Math.max(0, (prev[embolse.id] || 0) - 1) }));
  };

  const totalRacimos = useMemo(() =>
    Object.values(counts).reduce((s, v) => s + v, 0),
    [counts]
  );

  const inRange = totalRacimos >= rangoMin && totalRacimos <= rangoMax;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const today = info.fecha || format(new Date(), "yyyy-MM-dd");
      const existing = await trenadas.filter({ fecha: today });
      const correlativo = existing.length + 1;

      const racimos = buttons
        .filter(b => (counts[b.id] || 0) > 0)
        .map(b => ({
          color_name: b.color_name,
          color_hex: b.color_hex,
          week_age: b.week_age ?? b.semana,
          count: counts[b.id],
          embolse_id: b.id,
        }));

      const data = {
        fecha: today,
        hora: info.hora || format(new Date(), "HH:mm"),
        cuadrilla: parseInt(info.cuadrilla),
        conchero: info.conchero,
        cortero: info.cortero,
        seccion: info.seccion,
        linea: info.linea,
        racimos,
        total_racimos: totalRacimos,
        correlativo,
      };

      const trenada = await trenadas.create(data);

      // Descontar cosechado de cada embolse usado
      await Promise.all(
        racimos.map(async r => {
          const embolse = embolses.find(e => e.id === r.embolse_id);
          if (!embolse) return;
          const newCosechado = (embolse.cosechado || 0) + r.count;
          const newSaldo = embolse.total - newCosechado - (embolse.perdidas || 0);
          await inventory.updateEmbolse(r.embolse_id, {
            cosechado: newCosechado,
            saldo: newSaldo,
          });
        })
      );

      return trenada;
    },
    onSuccess: (result) => {
      playSaveSound();
      queryClient.invalidateQueries({ queryKey: ["trenadas"] });
      queryClient.invalidateQueries({ queryKey: ["embolses"] });
      onSave(result);
    },
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
          <CardTitle className="font-heading">Conteo de Racimos</CardTitle>
          <div className="flex gap-4 text-sm opacity-90 mt-1">
            <span>Cuadrilla #{info.cuadrilla}</span>
            <span>•</span>
            <span>{info.seccion}</span>
            <span>•</span>
            <span>{info.hora}</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Total with range indicator */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground font-medium">Total Racimos</p>
            <p className={cn(
              "text-5xl font-bold font-heading mt-1 transition-colors",
              totalRacimos === 0 ? "text-foreground" : inRange ? "text-green-600" : "text-red-500"
            )}>
              {totalRacimos}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Rango esperado: <span className="font-semibold">{rangoMin} a {rangoMax}</span> racimos
            </p>
          </div>

          {/* Color buttons from embolse inventory */}
          {buttons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay cintas con saldo disponible en el inventario
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {buttons.map(btn => {
                const saldo = btn.saldo ?? (btn.total - (btn.cosechado || 0) - (btn.perdidas || 0));
                const count = counts[btn.id] || 0;
                const agotado = count >= saldo;
                return (
                  <button
                    key={btn.id}
                    onClick={() => handleTap(btn)}
                    disabled={agotado}
                    className={cn(
                      "relative rounded-xl p-4 text-center transition-all active:scale-95 shadow-md border-2",
                      getTextColor(btn.color_hex),
                      agotado && "opacity-40 cursor-not-allowed"
                    )}
                    style={{
                      backgroundColor: btn.color_hex,
                      borderColor: `${btn.color_hex}80`
                    }}
                  >
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-xs font-semibold mt-1">{btn.color_name}</p>
                    <p className="text-xs opacity-80">Sem. {btn.week_age ?? btn.semana}</p>
                    <p className="text-xs opacity-60 mt-0.5">Saldo: {saldo - count}</p>
                    {count > 0 && (
                      <button
                        onClick={(e) => handleMinus(btn, e)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/30 flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {totalRacimos > 0 && (
            <div className="bg-muted rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold mb-2">Resumen de Cintas</p>
              <div className="flex flex-wrap gap-2">
                {buttons.filter(b => (counts[b.id] || 0) > 0).map(b => (
                  <Badge
                    key={b.id}
                    className={cn("px-3 py-1", getTextColor(b.color_hex))}
                    style={{ backgroundColor: b.color_hex }}
                  >
                    {b.color_name} S{b.week_age ?? b.semana}: {counts[b.id]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atrás
            </Button>
            <Button
              className="flex-1"
              disabled={totalRacimos === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Guardando..." : "Guardar Trenada"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}