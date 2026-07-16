import { useQuery } from "@tanstack/react-query";
import { laborAgricola, reports } from "@/api/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  return (
    // overflow-auto + max-h permiten scroll vertical; sticky top-0 en el header
    // requiere que el scroll container tenga overflow-y (no solo overflow-x).
    <div className="overflow-auto max-h-[520px]">
      <Table className="text-xs">
        {/* sticky en <thead> (TableHeader) — más compatible que en <tr> */}
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow className="bg-muted">
            <TableHead className="w-12 font-bold">Semana</TableHead>
            {activeLaborFiltered.map((labor) => (
              <TableHead key={labor.id} className="text-center font-bold min-w-32">
                {labor.nombre}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.map((week) => (
            <TableRow key={week} className="hover:bg-muted/30">
              <TableCell className="font-semibold">{week}</TableCell>
              {activeLaborFiltered.map((labor) => {
                const data = dataByLaborAndWeek[labor.id]?.[week];
                return (
                  <TableCell key={`${labor.id}-${week}`} className="text-center">
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
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
