import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfigColores() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#000000");

  const { data: colorList = [] } = useQuery({
    queryKey: ["colors-all"],
    queryFn: async () => {
      const { data, error } = await colors.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    // FIXED: columnas reales son color_name / color_hex (no name/hex)
    // FIXED: faltaba destructurar { error } y lanzarlo — colors.create()
    // siempre resuelve, así que un fallo (ej. RLS) se ignoraba en silencio.
    mutationFn: async () => {
      const { error } = await colors.create({ color_name: newName, color_hex: newHex, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors-all"] });
      setNewName("");
      setNewHex("#000000");
      toast.success("Color agregado");
    },
    onError: (error) => {
      toast.error(`Error al agregar color: ${error.message}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (c) => {
      const { error } = await colors.update(c.id, { active: !c.active });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["colors-all"] }),
    onError: (error) => {
      toast.error(`Error al actualizar color: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await colors.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors-all"] });
      toast.success("Color eliminado");
    },
    onError: (error) => {
      toast.error(`Error al eliminar color: ${error.message}`);
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading">Colores de Cinta</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input placeholder="Nombre del color" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div>
            <input type="color" value={newHex} onChange={e => setNewHex(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
          </div>
          <Button onClick={() => newName && addMutation.mutate()} disabled={!newName}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {colorList.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                {/* FIXED: columnas reales son color_name / color_hex (no name/hex) */}
                <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: c.color_hex }} />
                <span className="font-medium text-sm">{c.color_name}</span>
                {!c.active && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate(c)} className="text-xs h-7 px-2">
                  {c.active ? "Off" : "On"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)} className="text-destructive h-7 px-2">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
