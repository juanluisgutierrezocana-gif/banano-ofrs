import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ordenAcres } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Rediseño: ya no es una tabla fija de 5 semanas (Sub-Basal/Apical).
// Ahora el usuario elige cuántas minifincas hay ("Cant. Minifincas") y se
// despliega esa cantidad de filas (Minifinca 1, Minifinca 2, ...) con un
// campo de Acres cada una, más una suma total automática.
export default function Acres() {
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cantidad, setCantidad] = useState(1);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["acres", fecha],
    queryFn: async () => {
      const { data, error } = await ordenAcres.filter({ fecha });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Solo nos interesan los registros del nuevo formato (columna "minifinca"
  // poblada). Registros antiguos por semana (sub_basal/apical) se ignoran
  // aquí — quedan en la tabla pero esta pantalla ya no los usa.
  const registrosMinifinca = registros.filter((r) => r.minifinca);

  // Mapa minifinca -> registro, para precargar valores ya guardados ese día.
  const dataMap = {};
  registrosMinifinca.forEach((r) => { dataMap[r.minifinca] = r; });

  // Al cargar/cambiar de fecha: si ya hay minifincas guardadas ese día,
  // ajustar automáticamente "Cant. Minifincas" a lo que ya está guardado.
  useEffect(() => {
    if (registrosMinifinca.length > 0) {
      setCantidad(registrosMinifinca.length);
    }
    setValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, registrosMinifinca.length]);

  const minifincas = Array.from({ length: cantidad }, (_, i) => `Minifinca ${i + 1}`);

  const getVal = (nombre) => {
    if (values[nombre] !== undefined) return values[nombre];
    return dataMap[nombre]?.acres ?? "";
  };

  const handleChange = (nombre, val) => {
    setValues((prev) => ({ ...prev, [nombre]: val }));
  };

  const total = minifincas.reduce((sum, nombre) => {
    const v = parseFloat(getVal(nombre));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    let hadError = false;

    // Guardar/actualizar cada minifinca visible actualmente.
    for (const nombre of minifincas) {
      const acres = parseFloat(getVal(nombre));
      const existing = dataMap[nombre];
      const payload = { fecha, minifinca: nombre, acres: isNaN(acres) ? null : acres };
      if (existing) {
        const { error } = await ordenAcres.update(existing.id, payload);
        if (error) {
          hadError = true;
          toast.error(`Error al guardar ${nombre}: ${error.message}`);
        }
      } else if (!isNaN(acres)) {
        const { error } = await ordenAcres.create(payload);
        if (error) {
          hadError = true;
          toast.error(`Error al guardar ${nombre}: ${error.message}`);
        }
      }
    }

    // Si se redujo "Cant. Minifincas" respecto a lo guardado antes ese día,
    // eliminar las filas sobrantes para que no queden datos huérfanos.
    const sobrantes = registrosMinifinca.filter((r) => !minifincas.includes(r.minifinca));
    for (const r of sobrantes) {
      const { error } = await ordenAcres.delete(r.id);
      if (error) {
        hadError = true;
        toast.error(`Error al eliminar ${r.minifinca}: ${error.message}`);
      }
    }

    setValues({});
    queryClient.invalidateQueries({ queryKey: ["acres", fecha] });
    setSaving(false);
    if (!hadError) toast.success("Acres guardado");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Acres</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Cant. Minifincas:
          </label>
          <Input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20 h-8 text-center"
          />
        </div>
      </div>

      <Card className="shadow-md border-0">
        <CardHeader className="pb-4">
          <CardTitle className="font-heading text-lg">Orden de Corte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de fecha */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Fecha:</label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => { setFecha(e.target.value); setValues({}); }}
              className="w-44"
            />
          </div>

          {/* Tabla de ingreso: una fila por minifinca + total */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-foreground bg-muted rounded-tl-lg">
                      Minifinca
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-foreground bg-muted rounded-tr-lg">
                      Acres
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {minifincas.map((nombre, idx) => (
                    <tr key={nombre} className={idx % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                      <td className="py-2 px-3 font-bold text-primary">{nombre}</td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={getVal(nombre)}
                          onChange={(e) => handleChange(nombre, e.target.value)}
                          className="w-full text-center h-8"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/10 font-bold">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-center text-primary">{total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
