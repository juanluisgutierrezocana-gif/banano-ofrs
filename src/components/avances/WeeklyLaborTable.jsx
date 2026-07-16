import { useQuery } from "@tanstack/react-query";
import { laborAgricola, reports } from "@/api/supabaseClient";

export default function WeeklyLaborTable() {
  const { data: labores = [] } = useQuery({
    queryKey: ["labores-agricolas"],
    queryFn: async () => {
      const { data, error } = await laborAgricola.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  // FIXED: tabla correcta es "registros_labor" (con 's'), accedida via entity reports
  const { data: registros = [] } = useQuery({
    queryKey: ["registros-labor"],
    queryFn: async () => {
      const { data, error } = await reports.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeLaborIds = labores.filter((l) => l.activa !== false).map((l) => l.id);

  // Agrupar registros por labor y semana
  const dataByLaborAndWeek = {};
  registros.forEach((reg) => {
    if (!activeLaborIds.includes(reg.labor_id)) return;
    if (!dataByLaborAndWeek[reg.labor_id]) {
      dataByLaborAndWeek[reg.labor_id] = {};
    }
    if (!dataByLaborAndWeek[reg.labor_id][reg.semana]) {
      dataByLaborAndWeek[reg.labor_id][reg.semana] = {
        acres: 0,
        unidad_extra: null,
        valor_extra: 0,
      };
    }
    dataByLaborAndWeek[reg.labor_id][reg.semana].acres += reg.acres || 0;
    dataByLaborAndWeek[reg.labor_id][reg.semana].unidad_extra = reg.unidad_extra_tipo;
    dataByLaborAndWeek[reg.labor_id][reg.semana].valor_extra += reg.unidad_extra_valor || 0;
  });

  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  const activeLaborFiltered = labores.filter((l) => l.activa !== false);

  // NOTA: se usa <table> HTML nativo (NO el componente shadcn <Table>) porque
  // shadcn envuelve la tabla en un <div overflow-auto> interno, lo que crea dos
  // scroll-containers anidados y hace que sticky top-0 en <thead> quede relativo
  // al wrapper interno en vez del contenedor con max-h. Con HTML nativo hay UN
  // solo scroll-container y sticky funciona correctamente.
  return (
    <div className="overflow-auto max-h-[520px] rounded border border-border">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="border-b border-border">
            <th className="px-2 py-2 text-left font-bold w-12 whitespace-nowrap">Semana</th>
            {activeLaborFiltered.map((labor) => (
              <th key={labor.id} className="px-2 py-2 text-center font-bold min-w-32 whitespace-nowrap">
                {labor.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="px-2 py-1.5 font-semibold">{week}</td>
              {activeLaborFiltered.map((labor) => {
                const data = dataByLaborAndWeek[labor.id]?.[week];
                return (
                  <td key={`${labor.id}-${week}`} className="px-2 py-1.5 text-center">
                    {data ? (
                      <div className="space-y-0.5">
                        <div className="font-medium">{data.acres.toFixed(1)} ac</div>
                        {data.unidad_extra && (
                          <div className="text-muted-foreground text-xs">
                            {data.valor_extra.toFixed(1)} {data.unidad_extra}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
