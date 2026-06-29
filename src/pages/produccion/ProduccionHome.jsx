import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccionResumen, produccionVisibilidad } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, Save, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportStyledExcel } from "@/utils/excelExport";
import { CAMPOS_RESUMEN as CAMPOS } from "@/lib/produccionConstantes";

// Tabla 100% independiente, tal cual la pidió el cliente (imagen de
// referencia): sin valores predefinidos, sin fórmulas, sin enlace a
// "Ingresar Datos" ni a registros_produccion. Cada campo se llena a
// mano y se guarda en su propia tabla (produccion_resumen), un
// registro por fecha. La lista de columnas vive en produccionConstantes.js
// (CAMPOS_RESUMEN) para que "Configuración" pueda generar sus botones de
// mostrar/ocultar sobre la misma lista, sin duplicarla.

const formularioVacio = () =>
  CAMPOS.reduce((acc, { field }) => ({ ...acc, [field]: "" }), {});

export default function ProduccionHome() {
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  // Fecha que controla esta tabla. Cambiarla muestra el registro guardado
  // de ese día (si existe) o la tabla vacía y rellenable (si no existe).
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const { data: filasFecha = [], isLoading } = useQuery({
    queryKey: ["produccion-resumen", fechaSeleccionada],
    queryFn: async () => {
      const { data, error } = await produccionResumen.filter({ fecha: fechaSeleccionada });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Historial completo, solo para el botón "Exportar a Excel".
  const { data: historial = [] } = useQuery({
    queryKey: ["produccion-resumen-historial"],
    queryFn: async () => {
      const { data, error } = await produccionResumen.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Columnas ocultadas desde Configuración (produccion_visibilidad, grupo
  // 'produccion_columnas'). Solo afecta qué se muestra/exporta — los datos
  // ya guardados de una columna oculta no se borran ni dejan de cargarse.
  const { data: visibilidad = [] } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const ocultos = new Set(
    visibilidad
      .filter((v) => v.grupo === "produccion_columnas" && v.visible === false)
      .map((v) => v.clave)
  );
  const camposVisibles = CAMPOS.filter((c) => !ocultos.has(c.field));

  const filaActual = filasFecha[0] ?? null;

  // Valores locales del formulario. Se llenan con la fila guardada de la
  // fecha elegida, o quedan vacíos si esa fecha todavía no tiene datos.
  const [valores, setValores] = useState(formularioVacio());

  useEffect(() => {
    if (filaActual) {
      const inicial = {};
      CAMPOS.forEach(({ field }) => {
        inicial[field] = filaActual[field] ?? "";
      });
      setValores(inicial);
    } else {
      setValores(formularioVacio());
    }
  }, [filaActual?.id, fechaSeleccionada]);

  const handleChange = (field, value) => {
    setValores((prev) => ({ ...prev, [field]: value }));
  };

  // Guardado explícito (botón), no automático al salir del campo: el
  // cliente pidió un botón de Guardar que funcione para esta tabla.
  const handleGuardar = async () => {
    setGuardando(true);
    const payload = { fecha: fechaSeleccionada };
    CAMPOS.forEach(({ field }) => {
      const raw = valores[field];
      payload[field] = raw === "" || raw === null || raw === undefined ? null : parseFloat(raw);
    });

    const { error } = filaActual
      ? await produccionResumen.update(filaActual.id, payload)
      : await produccionResumen.create(payload);

    setGuardando(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Datos guardados");
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen", fechaSeleccionada] });
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen-historial"] });
  };

  // Borra el resumen guardado de la fecha seleccionada (produccion_resumen).
  // Acción irreversible: se confirma antes de ejecutar.
  const handleBorrar = async () => {
    if (!filaActual) return;
    if (!confirm(`¿Eliminar el resumen de producción del ${fechaSeleccionada}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBorrando(true);
    const { error } = await produccionResumen.delete(filaActual.id);
    setBorrando(false);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Registro eliminado");
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen", fechaSeleccionada] });
    queryClient.invalidateQueries({ queryKey: ["produccion-resumen-historial"] });
  };

  const handleExportar = () => {
    if (historial.length === 0) {
      toast.error("No hay datos guardados para exportar");
      return;
    }
    const headers = ["Fecha", ...camposVisibles.map((c) => c.label)];
    const rows = historial.map((fila) => [
      fila.fecha,
      ...camposVisibles.map((c) => fila[c.field] ?? ""),
    ]);
    exportStyledExcel({
      title: "Producción — Resumen por Día",
      headers,
      rows,
      sheetName: "Produccion",
      fileName: `produccion_resumen_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Tabla de resumen por día</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Label htmlFor="fecha-produccion" className="text-sm font-medium whitespace-nowrap">
            Fecha
          </Label>
          <Input
            id="fecha-produccion"
            type="date"
            className="sm:w-48"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver el resumen guardado de ese día. Si no tiene datos
            guardados, la tabla aparece vacía y lista para llenar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-center text-muted-foreground border-b bg-muted/30">
                  {camposVisibles.map(({ field, label }) => (
                    <th key={field} className="py-2 px-3 whitespace-nowrap">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {camposVisibles.map(({ field }) => (
                    <td key={field} className="py-1 px-2">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 text-center rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={valores[field] ?? ""}
                        onChange={(e) => handleChange(field, e.target.value)}
                        placeholder="—"
                        disabled={isLoading}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 mt-4">
        <Button onClick={handleGuardar} disabled={guardando}>
          <Save className="w-4 h-4" />
          {guardando ? "Guardando..." : "Guardar"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleBorrar}
          disabled={!filaActual || borrando}
        >
          <Trash2 className="w-4 h-4" />
          {borrando ? "Eliminando..." : "Borrar Registro"}
        </Button>
        <Button variant="outline" onClick={handleExportar}>
          <Download className="w-4 h-4" />
          Exportar a Excel
        </Button>
      </div>
    </div>
  );
}
