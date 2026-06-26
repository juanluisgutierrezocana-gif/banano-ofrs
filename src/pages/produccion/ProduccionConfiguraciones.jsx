import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";

// v1: placeholder. ProduccionLayout ya bloquea por completo a un Editor sin
// el permiso 'produccion'; este chequeo es una segunda barrera si entra
// directo por URL (mismo patrón que AvancesConfiguraciones.jsx).
export default function ProduccionConfiguraciones() {
  const { isAdmin, hasPermiso } = useRole();
  if (!isAdmin && !hasPermiso("produccion")) {
    return <AdminOnlyMessage />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Configuraciones</h1>
          <p className="text-muted-foreground text-sm">Producción</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aquí se configurarán los parámetros del módulo de Producción (cuadrillas, fórmulas de
            factor y desperdicio, etc.) una vez confirmados con el cliente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
