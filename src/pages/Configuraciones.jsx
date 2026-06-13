import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ConfigRango from "@/components/config/ConfigRango";
import ConfigLineas from "@/components/config/ConfigLineas";
import ConfigSecciones from "@/components/config/ConfigSecciones";
import ConfigColores from "@/components/config/ConfigColores";
import ConfigBotones from "@/components/config/ConfigBotones";
import ConfigUsuarios from "@/components/config/ConfigUsuarios";
import ConfigSonido from "@/components/config/ConfigSonido";
import ConfigFinca from "@/components/config/ConfigFinca";

export default function Configuraciones() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Configuraciones</h1>

      <Tabs defaultValue="rango" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="rango">Rango Racimos</TabsTrigger>
          <TabsTrigger value="lineas">Líneas</TabsTrigger>
          <TabsTrigger value="secciones">Secciones</TabsTrigger>
          <TabsTrigger value="colores">Colores</TabsTrigger>
          <TabsTrigger value="botones">Botones</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="sonido">Sonido</TabsTrigger>
          <TabsTrigger value="finca">Finca</TabsTrigger>
        </TabsList>

        <TabsContent value="rango"><ConfigRango /></TabsContent>
        <TabsContent value="lineas"><ConfigLineas /></TabsContent>
        <TabsContent value="secciones"><ConfigSecciones /></TabsContent>
        <TabsContent value="colores"><ConfigColores /></TabsContent>
        <TabsContent value="botones"><ConfigBotones /></TabsContent>
        <TabsContent value="usuarios"><ConfigUsuarios /></TabsContent>
        <TabsContent value="sonido"><ConfigSonido /></TabsContent>
        <TabsContent value="finca"><ConfigFinca /></TabsContent>
      </Tabs>
    </div>
  );
}