import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function HourlyChart({ trenadas }) {
  const hourlyData = useMemo(() => {
    const hours = {};
    trenadas.forEach(t => {
      const h = t.hora ? t.hora.substring(0, 2) : "00";
      const hourKey = `${h}:00`;
      if (!hours[hourKey]) hours[hourKey] = { hora: hourKey, trenadas: 0, racimos: 0, crews: {} };
      hours[hourKey].trenadas += 1;
      hours[hourKey].racimos += t.total_racimos || 0;
      hours[hourKey].crews[t.cuadrilla] = (hours[hourKey].crews[t.cuadrilla] || 0) + 1;
    });
    return Object.values(hours).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [trenadas]);

  if (!hourlyData.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">Trenadas por Hora</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No hay datos para mostrar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Trenadas por Hora</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Legend />
            <Bar dataKey="trenadas" name="Trenadas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="racimos" name="Racimos" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}