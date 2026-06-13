import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AdminOnlyMessage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-destructive" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Acceso Restringido</h2>
        <p className="text-sm text-muted-foreground">
          Solo los administradores pueden editar e ingresar información en esta sección. 
          Puedes descargar reportes desde la sección de Reportería.
        </p>
      </Card>
    </div>
  );
}