import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, ShieldOff, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";

function pct(num, total) {
  if (!total) return 0;
  return Math.round((num / total) * 100);
}

export default function Inventario() {
  const { isViewer } = useRole();
  const queryClient = useQueryClient();
  const [semana, setSemana] = useState("");
  const [colorName, setColorName] = useState("");
  const [total, setTotal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const { data: activeColors = [] } = useQuery({
    queryKey: ["colors-active"],
    queryFn: async () => {
      const { data, error } = await colors.filter({ active: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: embolses = [], isLoading } = useQuery({
    queryKey: ["embolses"],
    queryFn: async () => {
      // FIXED: listEmbolse() no existe → usar list() estándar de createEntity
      const { data, error } = await inventory.list("-semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  // FIXED: columnas reales son color_name y color_hex
  const selectedColor = activeColors.find(c => c.color_name === colorName);

  const addMutation = useMutation({
    mutationFn: async () => {
      // FIXED: createEmbolse() no existe → usar create() estándar de createEntity
      const { data, error } = await inventory.create({
        semana: parseInt(semana),
        color_name: colorName,
        color_hex: selectedColor?.color_hex || "#000",
        total: parseInt(total),
        cosechado: 0,
        perdidas: 0,
        saldo: parseInt(total),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["embolses"] });
      setSemana("");
      setColorName("");
      setTotal("");
      toast.success("Embolse agregado exitosamente");
    },
  });

  const canAdd = semana && colorName && total;

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // FIXED: deleteEmbolse() no existe → usar delete() estándar de createEntity
      const { error } = await inventory.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["embolses"] });
      toast.success("Embolse eliminado");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // FIXED: updateEmbolse() no existe → usar update() estándar de createEntity
      const { data: result, error } = await inventory.update(id, data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["embolses"] });
      setEditingId(null);
      toast.success("Embolse actualizado");
    },
  });

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditValues({ semana: e.semana, total: e.total });
  };

  const confirmEdit = (e) => {
    const newTotal = parseInt(editValues.total);
    const newSemana = parseInt(editValues.semana);
    const newSaldo = newTotal - (e.cosechado || 0) - (e.perdidas || 0);
    updateMutation.mutate({ id: e.id, data: { semana: newSemana, total: newTotal, saldo: newSaldo } });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Inventario de Embolse</h1>

      {isViewer && (
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl text-muted-foreground text-sm">
          <ShieldOff className="w-5 h-5 opacity-60" />
          Modo solo lectura — no tienes permiso para agregar registros.
        </div>
      )}

      {!isViewer && (
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <CardTitle className="font-heading">Agregar Embolse</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Semana</Label>
                <Input type="number" placeholder="Ej: 22" value={semana} onChange={e => setSemana(e.target.value)} />
              </div>
              <div>
                <Label>Color de Cinta</Label>
                <Select value={colorName} onValueChange={setColorName}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar color" /></SelectTrigger>
                  <SelectContent>
                    {activeColors.map(c => (
                      <SelectItem key={c.id} value={c.color_name}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.color_hex }} />
                          {c.color_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Total de Embolse</Label>
              <Input type="number" placeholder="Cantidad total" value={total} onChange={e => setTotal(e.target.value)} />
            </div>

            <Button className="w-full h-12 text-base" onClick={() => addMutation.mutate()} disabled={!canAdd || addMutation.isPending}>
              <Plus className="w-5 h-5 mr-2" />
              {addMutation.isPending ? "Guardando..." : "Agregar Embolse"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Package className="w-5 h-5" />
            Embolses Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : !embolses.length ? (
            <p className="text-center text-muted-foreground py-8">No hay embolses registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className="py-2 px-3 text-left">Semana</th>
                    <th className="py-2 px-3 text-left">Color</th>
                    <th className="py-2 px-3 text-center">Total</th>
                    <th className="py-2 px-3 text-center">Cosechado</th>
                    <th className="py-2 px-3 text-center">Pérdidas</th>
                    <th className="py-2 px-3 text-center">Saldo</th>
                    {!isViewer && <th className="py-2 px-3 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {embolses.map(e => {
                    const cosechado = e.cosechado || 0;
                    const perdidas = e.perdidas || 0;
                    const saldo = e.saldo ?? (e.total - cosechado - perdidas);
                    const isEditing = editingId === e.id;
                    return (
                      <tr key={e.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-semibold">
                          {isEditing ? (
                            <Input type="number" className="w-20 h-7 text-center" value={editValues.semana}
                              onChange={ev => setEditValues(v => ({ ...v, semana: ev.target.value }))} />
                          ) : `S${e.semana}`}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: e.color_hex }} />
                            {e.color_name}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isEditing ? (
                            <Input type="number" className="w-24 h-7 text-center mx-auto" value={editValues.total}
                              onChange={ev => setEditValues(v => ({ ...v, total: ev.target.value }))} />
                          ) : e.total}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-green-700 font-medium">{cosechado}</span>
                          <span className="text-xs text-muted-foreground ml-1">({pct(cosechado, e.total)}%)</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-destructive font-medium">{perdidas}</span>
                          <span className="text-xs text-muted-foreground ml-1">({pct(perdidas, e.total)}%)</span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-primary">
                          {saldo}
                          <span className="text-xs text-muted-foreground font-normal ml-1">({pct(saldo, e.total)}%)</span>
                        </td>
                        {!isViewer && (
                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                                  onClick={() => confirmEdit(e)} disabled={updateMutation.isPending}>
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                                  onClick={() => setEditingId(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-center">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
                                  onClick={() => startEdit(e)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                  onClick={() => deleteMutation.mutate(e.id)} disabled={deleteMutation.isPending}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
