import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfigSecciones() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: sectionList = [] } = useQuery({
    queryKey: ["sections-all"],
    queryFn: () => sections.list(),
  });

  const addMutation = useMutation({
    mutationFn: (name) => sections.create({ name, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections-all"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setNewName("");
      toast.success("Sección agregada");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (s) => sections.update(s.id, { active: !s.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections-all"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => sections.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections-all"] });
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Sección eliminada");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading">Secciones de la Finca</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de sección"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && newName && addMutation.mutate(newName)}
          />
          <Button onClick={() => newName && addMutation.mutate(newName)} disabled={!newName}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>

        <div className="space-y-2">
          {sectionList.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium">{s.name}</span>
                <Badge variant={s.active ? "default" : "secondary"}>
                  {s.active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(s)}>
                  {s.active ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(s.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
