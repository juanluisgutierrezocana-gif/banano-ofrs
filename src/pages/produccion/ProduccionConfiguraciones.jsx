import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccionVisibilidad } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";
import {
  CAMPOS_RESUMEN,
  CODIGOS_SEMANA,
  CALIDAD_LABEL,
} from "@/lib/produccionConstantes";

// Cada botón = un título de columna/calidad de las tablas reales de
// "Producción" e "Ingresar Datos". Apagar un botón solo oculta esa
// columna/fila de la pantalla y del Excel exportado; los datos ya
// guardados no se borran y los TOTALES de Ingresar Datos siguen
// sumando todas las calidades (decisión confirmada con el cliente).
//
// Persistencia: tabla produccion_visibilidad, una fila por (grupo, clave).
// Si no existe fila para una clave, se asume visible=true (default).
const GRUPO_COLUMNAS = "produccion_columnas";
const GRUPO_CALIDADES = "ingresar_calidades";

export default function ProduccionConfiguraciones() {
  const { isAdmin, hasPermiso } = useRole();
  const queryClient = useQueryClient();

  const { data: visibilidad = [], isLoading } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isAdmin && !hasPermiso("produccion")) {
    return <AdminOnlyMessage />;
  }

  // visible=true por default si todavía no hay fila guardada para esa clave.
  const esVisible = (grupo, clave) => {
    const fila = visibilidad.find((v) => v.grupo === grupo && v.clave === clave);
    return fila ? fila.visible !== false : true;
  };

  const handleToggle = async (grupo, clave) => {
    const nuevoValor = !esVisible(grupo, clave);
    const { error } = await produccionVisibilidad.upsert(grupo, clave, nuevoValor);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-visibilidad"] });
  };

  const BotonToggle = ({ grupo, clave, label }) => {
    const visible = esVisible(grupo, clave);
    return (
      <Button
        type="button"
        variant={visible ? "default" : "outline"}
        size="sm"
        className={visible ? "" : "text-muted-foreground"}
        onClick={() => handleToggle(grupo, clave)}
      >
        {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        {label}
      </Button>
    );
  };

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

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Columnas de "Producción"</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Apaga un botón para ocultar esa columna en la tabla de "Producción" y en su
            Excel exportado. Los datos guardados no se pierden.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {CAMPOS_RESUMEN.map(({ field, label }) => (
                <BotonToggle key={field} grupo={GRUPO_COLUMNAS} clave={field} label={label} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Calidades de "Ingresar Datos"</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Apaga un botón para ocultar esa calidad en las tablas "Producción Semanal por
            Código" y "Resumen de Producción", y en el Excel exportado. Los TOTALES siguen
            sumando todas las calidades, aunque estén ocultas.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {CODIGOS_SEMANA.map((codigo) => (
                <BotonToggle
                  key={codigo}
                  grupo={GRUPO_CALIDADES}
                  clave={codigo}
                  label={CALIDAD_LABEL[codigo] ?? codigo}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
