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

  const { data: colors = [] } = useQuery({
    queryKey: ["colors-all"],
    queryFn: () => colors.list(),
  });

  const addMutation = useMutation({
    mutationFn: () => colors.create({ name: newName, hex: newHex, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors-all"] });
      setNewName("");
      setNewHex("#000000");
      toast.success("Color agregado");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (c) => colors.update(c.id, { active: !c.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["colors-all"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => colors.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colors-all"] });
      toast.success("Color eliminado");
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
          {colors.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: c.hex }} />
                <span className="font-medium text-sm">{c.name}</span>
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