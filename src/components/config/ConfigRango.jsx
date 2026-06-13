import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function ConfigRango() {
  const queryClient = useQueryClient();
  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => supabase.from("settings").select("*")(),
  });

  const [min, setMin] = useState("25");
  const [max, setMax] = useState("35");

  useEffect(() => {
    const sMin = settings.find(s => s.key === "rango_min");
    const sMax = settings.find(s => s.key === "rango_max");
    if (sMin) setMin(sMin.value);
    if (sMax) setMax(sMax.value);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sMin = settings.find(s => s.key === "rango_min");
      const sMax = settings.find(s => s.key === "rango_max");
      if (sMin) await supabase.from("settings").update(sMin.id, { value: min });
      else await supabase.from("settings").insert({ key: "rango_min", value: min });
      if (sMax) await supabase.from("settings").update(sMax.id, { value: max });
      else await supabase.from("settings").insert({ key: "rango_max", value: max });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Rango actualizado");
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading">Rango de Racimos por Trenada</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Mínimo</Label>
            <Input type="number" value={min} onChange={e => setMin(e.target.value)} />
          </div>
          <div>
            <Label>Máximo</Label>
            <Input type="number" value={max} onChange={e => setMax(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}