import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports, ordenCalibre } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const SEMANAS = [14, 13, 12, 11, 10];

export default function OrdenCalibre() {
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["orden-calibre", fecha],
    queryFn: async () => {
      const { data, error } = await ordenCalibre.filter({ fecha });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Construir mapa de datos por semana
  const dataMap = {};
  registros.forEach(r => { dataMap[r.semana] = r; });

  // Estado local para los inputs
  const [values, setValues] = useState({});

  // Sincronizar cuando llegan datos nuevos
  const getVal = (semana, campo) => {
    if (values[`${semana}_${campo}`] !== undefined) return values[`${semana}_${campo}`];
    return dataMap[semana]?.[campo] ?? "";
  };

  const handleChange = (semana, campo, val) => {
    setValues(prev => ({ ...prev, [`${semana}_${campo}`]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    // FIXED: no se destructuraba { error } en ningún update/create — un
    // fallo (ej. RLS o columna inválida) se ignoraba en silencio y el botón
    // mostraba "Guardado" sin haber escrito nada en Supabase.
    let hadError = false;
    for (const semana of SEMANAS) {
      const sub_basal = parseFloat(values[`${semana}_sub_basal`] ?? dataMap[semana]?.sub_basal ?? "");
      const apical = parseFloat(values[`${semana}_apical`] ?? dataMap[semana]?.apical ?? "");
      const existing = dataMap[semana];
      // FIXED: "semana" es columna TEXT en orden_calibre — se castea a String
      // para evitar un posible error de tipo en el insert/update.
      const payload = {
        fecha,
        semana: String(semana),
        sub_basal: isNaN(sub_basal) ? null : sub_basal,
        apical: isNaN(apical) ? null : apical,
      };
      if (existing) {
        const { error } = await ordenCalibre.update(existing.id, payload);
        if (error) {
          hadError = true;
          toast.error(`Error al guardar Sem ${semana}: ${error.message}`);
        }
      } else if (!isNaN(sub_basal) || !isNaN(apical)) {
        const { error } = await ordenCalibre.create(payload);
        if (error) {
          hadError = true;
          toast.error(`Error al guardar Sem ${semana}: ${error.message}`);
        }
      }
    }
    setValues({});
    queryClient.invalidateQueries({ queryKey: ["orden-calibre", fecha] });
    setSaving(false);
    if (!hadError) toast.success("Orden de calibre guardado");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Orden de Calibre</h1>

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
              onChange={e => { setFecha(e.target.value); setValues({}); }}
              className="w-44"
            />
          </div>

          {/* Tabla de ingreso */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-foreground bg-muted rounded-tl-lg w-24">
                      Semana
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-foreground bg-muted">
                      Sub-Basal
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-foreground bg-muted rounded-tr-lg">
                      Apical
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SEMANAS.map((semana, idx) => (
                    <tr key={semana} className={idx % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                      <td className="py-2 px-3 font-bold text-primary">Sem {semana}</td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={getVal(semana, "sub_basal")}
                          onChange={e => handleChange(semana, "sub_basal", e.target.value)}
                          className="w-full text-center h-8"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={getVal(semana, "apical")}
                          onChange={e => handleChange(semana, "apical", e.target.value)}
                          className="w-full text-center h-8"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
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
