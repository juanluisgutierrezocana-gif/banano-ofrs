import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReporteGeneral from "@/components/reportes/ReporteGeneral";
import ReporteSeccion from "@/components/reportes/ReporteSeccion";
import ReporteCuadrilla from "@/components/reportes/ReporteCuadrilla";
import ReporteInventario from "@/components/reportes/ReporteInventario";
import ReporteEmbolse from "@/components/reportes/ReporteEmbolse";
import ReporteOrdenCalibre from "@/components/reportes/ReporteOrdenCalibre";

export default function Reporteria() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Reportería</h1>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="seccion">Por Sección</TabsTrigger>
          <TabsTrigger value="cuadrilla">Por Cuadrilla</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="embolse">Embolse & Cosecha</TabsTrigger>
          <TabsTrigger value="calibre">Orden de Calibre</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><ReporteGeneral /></TabsContent>
        <TabsContent value="seccion"><ReporteSeccion /></TabsContent>
        <TabsContent value="cuadrilla"><ReporteCuadrilla /></TabsContent>
        <TabsContent value="inventario"><ReporteInventario /></TabsContent>
        <TabsContent value="embolse"><ReporteEmbolse /></TabsContent>
        <TabsContent value="calibre"><ReporteOrdenCalibre /></TabsContent>
      </Tabs>
    </div>
  );
}