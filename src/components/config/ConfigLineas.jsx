import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function ConfigLineas() {
  const queryClient = useQueryClient();
  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => supabase.from("settings").select("*")(),
  });

  const [lineas, setLineas] = useState("4");

  useEffect(() => {
    const s = settings.find(s => s.key === "lineas");
    if (s) setLineas(s.value);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const s = settings.find(s => s.key === "lineas");
      if (s) await supabase.from("settings").update(s.id, { value: lineas });
      else await supabase.from("settings").insert({ key: "lineas", value: lineas });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Líneas actualizadas");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading">Líneas de Bacadilla</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Cantidad de Líneas</Label>
          <Input type="number" value={lineas} onChange={e => setLineas(e.target.value)} className="max-w-xs" />
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}