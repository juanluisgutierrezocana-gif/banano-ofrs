import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/lib/useSettings";
import { format } from "date-fns";
import { Truck } from "lucide-react";

export default function StepInicio({ onNext }) {
  const now = new Date();
  const [form, setForm] = useState({
    fecha: format(now, "yyyy-MM-dd"),
    hora: format(now, "HH:mm"),
    cuadrilla: "",
    conchero: "",
    cortero: "",
    seccion: "",
    linea: "",
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: () => sections.filter({ active: true }),
  });

  const { getLineas } = useSettings();
  const lineas = Array.from({ length: getLineas() }, (_, i) => i + 1);

  const canSubmit = form.cuadrilla && form.conchero && form.cortero && form.seccion && form.linea;

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <CardTitle className="font-heading">Iniciar Recepción</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.fecha}
              onChange={e => setForm({ ...form, fecha: e.target.value })}
            />
          </div>
          <div>
            <Label>Hora</Label>
            <Input
              type="time"
              value={form.hora}
              onChange={e => setForm({ ...form, hora: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>No. de Cuadrilla</Label>
          <Input
            type="number"
            placeholder="Ej: 1"
            value={form.cuadrilla}
            onChange={e => setForm({ ...form, cuadrilla: e.target.value })}
          />
        </div>

        <div>
          <Label>Nombre del Conchero</Label>
          <Input
            placeholder="Nombre completo"
            value={form.conchero}
            onChange={e => setForm({ ...form, conchero: e.target.value })}
          />
        </div>

        <div>
          <Label>Nombre del Cortero</Label>
          <Input
            placeholder="Nombre completo"
            value={form.cortero}
            onChange={e => setForm({ ...form, cortero: e.target.value })}
          />
        </div>

        <div>
          <Label>Sección</Label>
          <Select value={form.seccion} onValueChange={v => setForm({ ...form, seccion: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar sección" />
            </SelectTrigger>
            <SelectContent>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Línea de Ingreso</Label>
          <Select value={form.linea} onValueChange={v => setForm({ ...form, linea: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar línea" />
            </SelectTrigger>
            <SelectContent>
              {lineas.map(l => (
                <SelectItem key={l} value={String(l)}>Línea {l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold"
          disabled={!canSubmit}
          onClick={() => onNext(form)}
        >
          Iniciar Recepción
        </Button>
      </CardContent>
    </Card>
  );
}