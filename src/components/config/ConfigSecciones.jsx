import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports, seccionAgricola } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfigSecciones() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  // FIXED: esta pantalla consultaba la tabla "sections" (vacía/placeholder).
  // Las secciones reales importadas de la finca viven en "seccion_agricola"
  // (entity seccionAgricola), con columnas nombre/activa/acres/minifinca.
  const { data: sectionList = [] } = useQuery({
    queryKey: ["seccion-agricola-list"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: (name) => seccionAgricola.create({ nombre: name, activa: true, acres: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seccion-agricola-list"] });
      setNewName("");
      toast.success("Sección agregada");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (s) => seccionAgricola.update(s.id, { activa: !s.activa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seccion-agricola-list"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => seccionAgricola.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seccion-agricola-list"] });
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
                {/* FIXED: columnas reales son nombre/activa (no name/active) */}
                <span className="font-medium">{s.nombre}</span>
                {s.acres ? <span className="text-xs text-muted-foreground">({s.acres} acres)</span> : null}
                <Badge variant={s.activa ? "default" : "secondary"}>
                  {s.activa ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(s)}>
                  {s.activa ? "Desactivar" : "Activar"}
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
