import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#2e7d32", "#1565c0", "#6a1b9a", "#e65100", "#c62828",
  "#00838f", "#f9a825", "#4e342e", "#37474f", "#558b2f",
  "#ad1457", "#0277bd",
];

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
      {value}
    </text>
  );
};

export default function CrewPieChart({ trenadas }) {
  const data = useMemo(() => {
    const crews = {};
    trenadas.forEach(t => {
      const crew = t.cuadrilla;
      if (!crew) return;
      if (!crews[crew]) crews[crew] = { name: `C${crew}`, value: 0 };
      crews[crew].value += t.total_racimos || 0;
    });
    return Object.values(crews).sort((a, b) => a.name.localeCompare(b.name));
  }, [trenadas]);

  if (!data.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Racimos por Cuadrilla</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              labelLine={false}
              label={CustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} racimos`, name]}
              contentStyle={{ borderRadius: 8, fontSize: 13 }}
            />
            <Legend
              formatter={(value, entry) => (
                <span style={{ color: entry.color, fontWeight: 600 }}>
                  {value} ({entry.payload.value})
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}