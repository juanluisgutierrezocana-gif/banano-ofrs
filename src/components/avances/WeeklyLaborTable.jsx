import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WeeklyLaborTable() {
  const { data: labores = [] } = useQuery({
    queryKey: ["labores-agricolas"],
    queryFn: () => laborAgricola.list("nombre"),
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["registros-labor"],
    queryFn: () => supabase.from("registro_labor").select("*")(),
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
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/50">
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