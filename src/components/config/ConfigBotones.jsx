import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getTextColor(hex) {
  if (!hex) return "text-foreground";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "text-gray-800" : "text-white";
}

export default function ConfigBotones() {
  const queryClient = useQueryClient();
  const [embolseId, setEmbolseId] = useState("");
  const [weekAge, setWeekAge] = useState("");

  const { data: buttons = [] } = useQuery({
    queryKey: ["buttons-all"],
    queryFn: () => supabase.from("button_config").select("*")("position"),
  });

  // Cargar embolses del inventario con saldo > 0
  const { data: embolses = [] } = useQuery({
    queryKey: ["embolses"],
    queryFn: () => inventory.listEmbolse("semana"),
  });

  const embolsesDisponibles = embolses.filter(e => {
    const saldo = e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));
    return saldo > 0;
  });

  const selectedEmbolse = embolsesDisponibles.find(e => e.id === embolseId);

  // Verificar si ya existe ese embolse como botón
  const yaExiste = (emb) => buttons.some(b => b.color_name === emb.color_name && b.week_age === emb.semana);

  const addMutation = useMutation({
    mutationFn: () => {
      if (!selectedEmbolse) return;
      return supabase.from("button_config").insert({
        position: buttons.length + 1,
        color_id: selectedEmbolse.id,
        color_name: selectedEmbolse.color_name,
        color_hex: selectedEmbolse.color_hex,
        week_age: weekAge ? parseInt(weekAge) : selectedEmbolse.semana,
        active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buttons-all"] });
      queryClient.invalidateQueries({ queryKey: ["buttons-active"] });
      setEmbolseId("");
      setWeekAge("");
      toast.success("Botón agregado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => supabase.from("button_config").delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buttons-all"] });
      queryClient.invalidateQueries({ queryKey: ["buttons-active"] });
      toast.success("Botón eliminado");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (b) => supabase.from("button_config").update(b.id, { active: !b.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buttons-all"] });
      queryClient.invalidateQueries({ queryKey: ["buttons-active"] });
    },
  });

  const canAdd = embolseId && selectedEmbolse && !yaExiste(selectedEmbolse) && weekAge;

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading">Botones de Recepción</CardTitle></CardHeader>
      <CardContent className="space-y-4">

        {/* Selector de embolse del inventario */}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>Seleccionar Cinta del Inventario</Label>
            <Select value={embolseId} onValueChange={setEmbolseId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar embolse..." />
              </SelectTrigger>
              <SelectContent>
                {embolsesDisponibles.length === 0 && (
                  <SelectItem value="__none" disabled>No hay embolses con saldo</SelectItem>
                )}
                {embolsesDisponibles.map(e => {
                  const saldo = e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));
                  const existe = yaExiste(e);
                  return (
                    <SelectItem key={e.id} value={e.id} disabled={existe}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border flex-shrink-0" style={{ backgroundColor: e.color_hex }} />
                        <span className="font-medium">{e.color_name}</span>
                        <span className="text-muted-foreground text-xs">— Sem. {e.semana}</span>
                        {e.seccion && <span className="text-muted-foreground text-xs">({e.seccion})</span>}
                        <span className="text-xs text-green-600 ml-auto">Saldo: {saldo}</span>
                        {existe && <span className="text-xs text-muted-foreground">(ya agregado)</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Semana de edad manual */}
          {selectedEmbolse && (
            <div className="w-32">
              <Label>Semana de Edad</Label>
              <Input
                type="number"
                placeholder={`Ej: ${selectedEmbolse.semana}`}
                value={weekAge}
                onChange={e => setWeekAge(e.target.value)}
                min="1"
              />
            </div>
          )}

          <Button onClick={() => addMutation.mutate()} disabled={!canAdd || addMutation.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>

        {/* Botones actuales */}
        {buttons.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {buttons.map(b => (
              <div
                key={b.id}
                className={cn(
                  "rounded-xl p-4 text-center relative border-2",
                  !b.active && "opacity-50",
                  getTextColor(b.color_hex)
                )}
                style={{ backgroundColor: b.color_hex, borderColor: `${b.color_hex}80` }}
              >
                <p className="font-bold">{b.color_name}</p>
                <p className="text-xs opacity-80">Sem. {b.week_age}</p>
                {(() => {
                  const emb = embolses.find(e => e.id === b.color_id);
                  const saldo = emb ? (emb.saldo ?? (emb.total - (emb.cosechado || 0) - (emb.perdidas || 0))) : null;
                  return saldo !== null ? (
                    <p className="text-xs opacity-60 mt-0.5">Saldo: {saldo}</p>
                  ) : null;
                })()}
                <div className="flex gap-1 mt-2 justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => toggleMutation.mutate(b)}
                  >
                    {b.active ? "Off" : "On"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => deleteMutation.mutate(b.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}