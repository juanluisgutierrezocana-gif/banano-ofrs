import { Sprout } from "lucide-react";
import WeeklyLaborTable from "@/components/avances/WeeklyLaborTable";
import CycleProgressCharts from "@/components/avances/CycleProgressCharts";

export default function AvancesHome() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Sprout className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Resumen de Avances Agrícolas</h1>
          <p className="text-muted-foreground text-sm">Vista general de actividades agrícolas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Izquierda: Tabla de semanas */}
        <div className="bg-card rounded-xl border border-border shadow">
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 text-foreground">Avances por Semana</h2>
            <WeeklyLaborTable />
          </div>
        </div>

        {/* Derecha: Gráficas de ciclos */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] pr-4">
          <h2 className="text-lg font-bold mb-4 text-foreground sticky top-0 bg-background">Progreso por Ciclo</h2>
          <CycleProgressCharts />
        </div>
      </div>
    </div>
  );
}