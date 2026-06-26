import { useQuery } from "@tanstack/react-query";
import { produccion } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { calcularDatosProceso } from "@/lib/produccionCalc";

// Reportería v1: tabla diaria con todos los campos verificados. Los 3
// reportes del boceto (general por día/semana/mes/año, producción por
// día/semana/mes/año, gráficas) se agregarán sobre esta misma fuente de
// datos una vez confirmadas las fórmulas restantes con el cliente.
export default function ProduccionReporteria() {
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Reportería de Producción</h1>
          <p className="text-muted-foreground text-sm">Histórico diario</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registros ({registros.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : registros.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hay registros aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Rac. Cosech.</th>
                    <th className="py-2 pr-3">Rac. Rechaz.</th>
                    <th className="py-2 pr-3">Rac. Procesados</th>
                    <th className="py-2 pr-3">Cajas 1ra</th>
                    <th className="py-2 pr-3">Cajas 2da</th>
                    <th className="py-2 pr-3">Cajas Tercera</th>
                    <th className="py-2 pr-3">Hrs. Trabajadas</th>
                    <th className="py-2 pr-3">Cajas/Hora</th>
                    <th className="py-2 pr-3">Cajas/Persona</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => {
                    const c = calcularDatosProceso(r);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-medium">{r.fecha}</td>
                        <td className="py-2 pr-3">{r.racimos_cosechados ?? "—"}</td>
                        <td className="py-2 pr-3">{r.racimos_rechazados ?? "—"}</td>
                        <td className="py-2 pr-3">{c.racimosProcesados}</td>
                        <td className="py-2 pr-3">{r.cajas_primera ?? "—"}</td>
                        <td className="py-2 pr-3">{r.cajas_segunda ?? "—"}</td>
                        <td className="py-2 pr-3">{r.cajas_tercera ?? "—"}</td>
                        <td className="py-2 pr-3">{c.horasTrabajadas.toFixed(1)}</td>
                        <td className="py-2 pr-3">{c.cajasHora.toFixed(1)}</td>
                        <td className="py-2 pr-3">{c.cajasPersona.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
