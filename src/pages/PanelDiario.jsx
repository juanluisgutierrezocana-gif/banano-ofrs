import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Layers, Clock, Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import HourlyChart from "@/components/dashboard/HourlyChart";
import CrewTable from "@/components/dashboard/CrewTable";
import ColorSummaryCards from "@/components/dashboard/ColorSummaryCards";
import CrewPieChart from "@/components/dashboard/CrewPieChart";

export default function PanelDiario() {
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trenadas", fecha] });
    queryClient.invalidateQueries({ queryKey: ["buttons"] });
  };

  const { data: trenadaRecords = [], isLoading, isFetching } = useQuery({
    queryKey: ["trenadas", fecha],
    queryFn: async () => {
      const { data, error } = await trenadas.filter({ fecha });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch buttons con manejo correcto de respuesta Supabase
  const { data: buttonsResponse = {} } = useQuery({
    queryKey: ["buttons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("button_config")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      
      if (error) {
        console.error("Error fetching buttons:", error);
        return { data: [] };
      }
      return { data: data || [] };
    },
  });

  // Garantizar que buttons es siempre un array
  const buttons = Array.isArray(buttonsResponse?.data) ? buttonsResponse.data : [];

  const totalRacimos = useMemo(() =>
    trenadaRecords.reduce((sum, t) => sum + (t.total_racimos || 0), 0),
    [trenadaRecords]
  );

  const colorTotals = useMemo(() => {
    // Acumular racimos recibidos por color
    const totals = {};
    trenadaRecords.forEach(t => {
      (t.racimos || []).forEach(r => {
        // Racimos tiene estructura: { color_name, color_hex, week_age, count }
        const key = `${r.color_name}-S${r.week_age}`;
        if (!totals[key]) totals[key] = { ...r, count: 0 };
        totals[key].count += r.count;
      });
    });

    // El filtro On/Off de botones solo debe afectar el día de HOY.
    // En fechas pasadas, un botón apagado hoy no debe borrar cards
    // con datos ya cargados en ese día histórico.
    const esHoy = fecha === format(new Date(), "yyyy-MM-dd");

    // Set de claves "color-Ssemana" de botones actualmente activos (On) en button_config.
    // No existe un button_id guardado en el racimo (solo color_name/week_age sueltos),
    // así que el único cruce posible es por texto color_name+week_age.
    const activeKeys = new Set(
      buttons.map(btn => `${btn.color_name ?? btn.button_name}-S${btn.week_age ?? 0}`)
    );

    // Solo se muestran colores con racimos realmente cargados (count > 0).
    // Si la fecha consultada es hoy, además el botón debe seguir activo (On).
    return Object.values(totals)
      .filter(t => {
        if (t.count <= 0) return false;
        if (!esHoy) return true;
        const key = `${t.color_name}-S${t.week_age}`;
        return activeKeys.has(key);
      })
      .sort((a, b) => b.week_age - a.week_age);
  }, [trenadaRecords, buttons, fecha]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Panel Diario</h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {fecha ? format(parseISO(fecha), "EEEE, d 'de' MMMM yyyy", { locale: es }) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-44 h-9"
          />
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} title="Refrescar datos">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium opacity-80">Total Racimos</p>
                <p className="text-2xl font-bold">{totalRacimos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Trenadas del Día</p>
                <p className="text-2xl font-bold">{trenadaRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color summary */}
      <ColorSummaryCards colorTotals={colorTotals} />

      {/* Crew table + pie chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CrewTable trenadas={trenadaRecords} buttons={buttons} />
        <CrewPieChart trenadas={trenadaRecords} />
      </div>

      {/* Hourly chart */}
      <HourlyChart trenadas={trenadaRecords} />
    </div>
  );
}