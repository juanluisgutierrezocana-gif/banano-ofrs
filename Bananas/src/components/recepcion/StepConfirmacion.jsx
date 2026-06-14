import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function getTextColor(hex) {
  if (!hex) return "text-foreground";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "text-gray-800" : "text-white";
}

export default function StepConfirmacion({ trenada, onNueva }) {
  if (!trenada) return null;

  return (
    <Card className="shadow-lg border-0 overflow-hidden">
      <div className="bg-green-600 text-white p-6 text-center">
        <CheckCircle className="w-16 h-16 mx-auto mb-3" />
        <h2 className="text-2xl font-heading font-bold">Trenada Registrada</h2>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Cuadrilla</p>
            <p className="font-semibold">#{trenada.cuadrilla}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Horario</p>
            <p className="font-semibold">{trenada.hora}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cortero</p>
            <p className="font-semibold">{trenada.cortero}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conchero</p>
            <p className="font-semibold">{trenada.conchero}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sección</p>
            <p className="font-semibold">{trenada.seccion}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Racimos</p>
            <p className="text-2xl font-bold text-primary">{trenada.total_racimos}</p>
          </div>
        </div>

        {trenada.racimos?.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Colores Recibidos</p>
            <div className="flex flex-wrap gap-2">
              {trenada.racimos.map((r, i) => (
                <Badge
                  key={i}
                  className={cn("px-3 py-1.5", getTextColor(r.color_hex))}
                  style={{ backgroundColor: r.color_hex }}
                >
                  {r.color_name} S{r.week_age}: {r.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button className="w-full h-12 text-base font-semibold" onClick={onNueva}>
          <Plus className="w-5 h-5 mr-2" />
          Nueva Trenada
        </Button>
      </CardContent>
    </Card>
  );
}