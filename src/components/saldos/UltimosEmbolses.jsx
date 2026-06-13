import { useState, useEffect } from "react";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getTextColor(hex) {
  if (!hex) return "#000";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1f2937" : "#ffffff";
}

export default function UltimosEmbolses({ embolses = [] }) {
  const queryClient = useQueryClient();
  // Tomar los últimos 12, ordenados de más antiguo a más reciente (derecha = más nuevo)
  const last12 = [...embolses]
    .sort((a, b) => a.semana - b.semana)
    .slice(-12);

  // Solo el primer embolse (izquierda) tiene edad editable; los demás se derivan restando 1 por posición
  const firstId = last12[0]?.id;
  const [baseWeekAge, setBaseWeekAge] = useState(last12[0]?.week_age ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseWeekAge(last12[0]?.week_age ?? "");
  }, [embolses]);

  const getWeekAge = (idx) => {
    const base = parseInt(baseWeekAge);
    if (isNaN(base)) return "";
    // idx=0 es el más antiguo (izquierda) → mayor edad; cada uno a la derecha resta 1
    return base - idx;
  };

  const handleBaseChange = (val) => {
    setBaseWeekAge(val);
  };

  const handleBaseBlur = async (val) => {
    const num = parseInt(val);
    if (isNaN(num) || !firstId) return;
    setSaving(true);
    await inventory.updateEmbolse(firstId, { week_age: num });
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    setSaving(false);
  };

  if (!last12.length) return null;

  return (
    <Card className="shadow-md border-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base">Últimos 12 Embolses</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <div className="overflow-x-auto px-4">
          <div className="flex gap-3 min-w-max py-2">
            {last12.map((e, idx) => {
              const saldo = e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));
              const textColor = getTextColor(e.color_hex || "#cccccc");
              const isLast = idx === last12.length - 1;
              const isFirst = idx === 0;
              const weekAgeVal = getWeekAge(idx);
              return (
                <div
                  key={e.id}
                  className={`flex flex-col items-center rounded-xl overflow-hidden border-2 ${isLast ? "border-primary shadow-lg" : "border-transparent"}`}
                  style={{ minWidth: 80 }}
                >
                  {/* Header color con semana */}
                  <div
                    className="w-full text-center py-2 px-2 font-bold text-sm"
                    style={{ backgroundColor: e.color_hex || "#ccc", color: textColor }}
                  >
                    <div className="text-xs font-normal opacity-80">Sem.</div>
                    <div>{e.semana}</div>
                  </div>

                  {/* Color name */}
                  <div
                    className="w-full text-center py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: e.color_hex || "#ccc", color: textColor, opacity: 0.9 }}
                  >
                    {e.color_name}
                  </div>

                  {/* Separador */}
                  <div className="w-full bg-muted/40 px-2 py-2 flex flex-col items-center gap-2 flex-1">
                    {/* Semanas de edad */}
                    <div className="flex flex-col items-center w-full">
                      <span className="text-[9px] text-muted-foreground mb-1 text-center leading-tight">Sem. edad</span>
                      {isFirst ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            value={baseWeekAge}
                            onChange={ev => handleBaseChange(ev.target.value)}
                            onBlur={ev => handleBaseBlur(ev.target.value)}
                            className="w-12 h-7 text-center text-sm font-bold border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                            style={{ borderColor: e.color_hex || "#ccc" }}
                          />
                          {saving && <span className="text-[8px] text-muted-foreground mt-0.5">...</span>}
                        </>
                      ) : (
                        <div
                          className="w-12 h-7 flex items-center justify-center text-sm font-bold rounded-md border bg-white/60"
                          style={{ borderColor: e.color_hex || "#ccc" }}
                        >
                          {weekAgeVal !== "" ? weekAgeVal : "—"}
                        </div>
                      )}
                    </div>

                    {/* Cosechado */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-green-600 font-medium">Cosechado</span>
                      <span className="text-sm font-bold text-green-700">{e.cosechado || 0}</span>
                    </div>

                    {/* Pérdidas */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-red-500 font-medium">Pérdidas</span>
                      <span className="text-sm font-bold text-red-600">{e.perdidas || 0}</span>
                    </div>

                    {/* Saldo */}
                    <div className="flex flex-col items-center border-t w-full pt-1 mt-1">
                      <span className="text-[9px] text-primary font-medium">Saldo</span>
                      <span className={`text-sm font-bold ${saldo <= 0 ? "text-muted-foreground line-through" : "text-primary"}`}>
                        {saldo}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}