import { useQuery } from "@tanstack/react-query";
import { produccion } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory } from "lucide-react";
import { calcularDatosProceso } from "@/lib/produccionCalc";

export default function ProduccionHome() {
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ultimo = registros[0];
  const calculado = ultimo ? calcularDatosProceso(ultimo) : null;

  const cards = ultimo ? [
    { label: "Racimos Cosechados", value: ultimo.racimos_cosechados ?? "—" },
    { label: "Racimos Rechazados", value: ultimo.racimos_rechazados ?? "—" },
    { label: "Racimos Procesados", value: calculado.racimosProcesados },
    { label: "Cajas 1ra", value: ultimo.cajas_primera ?? "—" },
    { label: "Cajas 2da", value: ultimo.cajas_segunda ?? "—" },
    { label: "Cajas Tercera", value: ultimo.cajas_tercera ?? "—" },
    { label: "Quintales Rechazo", value: ultimo.quintales_rechazo ?? "—" },
    { label: "Horas Trabajadas", value: calculado.horasTrabajadas.toFixed(1) },
    { label: "Cajas / Hora", value: calculado.cajasHora.toFixed(1) },
    { label: "Cajas / Persona", value: calculado.cajasPersona.toFixed(2) },
  ] : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Resumen del último día registrado</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
      ) : !ultimo ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Aún no hay registros de producción. Empieza en <strong>Ingresar Datos</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Día: <span className="font-semibold text-foreground">{ultimo.fecha}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
