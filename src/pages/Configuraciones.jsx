import React, { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ConfigRango from "@/components/config/ConfigRango";
import ConfigLineas from "@/components/config/ConfigLineas";
import ConfigSecciones from "@/components/config/ConfigSecciones";
import ConfigColores from "@/components/config/ConfigColores";
import ConfigBotones from "@/components/config/ConfigBotones";
import ConfigUsuarios from "@/components/config/ConfigUsuarios";
import ConfigSonido from "@/components/config/ConfigSonido";
import ConfigFinca from "@/components/config/ConfigFinca";
import { useRole } from "@/hooks/useRole";

// Cada pestaña tiene un permiso granular asociado (ver useRole.hasPermiso).
// Admin/Dueño ven las 8 siempre; un Editor (role==='user') solo ve las
// pestañas que un admin le activó desde Configuraciones->Usuarios.
const ALL_TABS = [
  { value: "rango", label: "Rango Racimos", permiso: "config_rango", Comp: ConfigRango },
  { value: "lineas", label: "Líneas", permiso: "config_lineas", Comp: ConfigLineas },
  { value: "secciones", label: "Secciones", permiso: "config_secciones", Comp: ConfigSecciones },
  { value: "colores", label: "Colores", permiso: "config_colores", Comp: ConfigColores },
  { value: "botones", label: "Botones", permiso: "config_botones", Comp: ConfigBotones },
  { value: "usuarios", label: "Usuarios", permiso: "config_usuarios", Comp: ConfigUsuarios },
  { value: "sonido", label: "Sonido", permiso: "config_sonido", Comp: ConfigSonido },
  { value: "finca", label: "Finca", permiso: "config_finca", Comp: ConfigFinca },
];

export default function Configuraciones() {
  const { isAdmin, hasPermiso } = useRole();

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => isAdmin || hasPermiso(t.permiso)),
    [isAdmin, hasPermiso]
  );

  // Defensivo: si un Editor sin ningún permiso entra por URL directa
  // (el Sidebar ya no le muestra "Configuraciones" en este caso).
  if (visibleTabs.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Configuraciones</h1>
        <p className="text-muted-foreground">No tienes permisos asignados para ninguna sección de Configuraciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Configuraciones</h1>

      <Tabs defaultValue={visibleTabs[0].value} className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted p-1">
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((t) => (
          <TabsContent key={t.value} value={t.value}><t.Comp /></TabsContent>
        ))}
      </Tabs>
    </div>
  );
}