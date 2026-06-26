import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

// Campos de "DATO BÁSICOS" tal como aparecen en la hoja real del cliente
// (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12). Los campos calculados
// ("DATOS DE PROCESO") NO se guardan aquí: se derivan en ProduccionHome.jsx
// y ProduccionReporteria.jsx a partir de estos valores.
const emptyForm = {
  fecha: new Date().toISOString().slice(0, 10),
  hora_inicio: "",
  hora_salida: "",
  tiempo_perdido: "",
  cuadrilla: "",
  empaque: "",
  acres: "",
  racimos_cosechados: "",
  racimos_rechazados: "",
  no_manos: "",
  peso_pinzote: "",
  calibre: "",
  quintales_rechazo: "",
  cajas_tercera: "",
  cajas_primera: "",
  cajas_segunda: "",
};

const NUMERIC_FIELDS = [
  "hora_inicio", "hora_salida", "tiempo_perdido", "cuadrilla", "empaque", "acres",
  "racimos_cosechados", "racimos_rechazados", "no_manos", "peso_pinzote",
  "quintales_rechazo", "cajas_tercera", "cajas_primera", "cajas_segunda",
];

export default function ProduccionIngresar() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    setSaving(true);
    const payload = { fecha: form.fecha, calibre: form.calibre || null };
    NUMERIC_FIELDS.forEach((f) => {
      payload[f] = form[f] === "" ? null : parseFloat(form[f]);
    });
    const { error } = await produccion.create(payload);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Registro de producción guardado");
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
    setForm(emptyForm);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await produccion.delete(id);
    setDeletingId(null);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Ingresar Datos</h1>
          <p className="text-muted-foreground text-sm">Datos básicos diarios de proceso</p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nuevo Registro Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="fecha" className="text-xs">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" value={form.fecha} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora_inicio" className="text-xs">Hora Inicio</Label>
              <Input id="hora_inicio" name="hora_inicio" type="number" min="0" max="23" placeholder="Ej: 7"
                value={form.hora_inicio} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hora_salida" className="text-xs">Hora Salida</Label>
              <Input id="hora_salida" name="hora_salida" type="number" min="0" max="23" placeholder="Ej: 17"
                value={form.hora_salida} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tiempo_perdido" className="text-xs">Tiempo Perdido (hrs)</Label>
              <Input id="tiempo_perdido" name="tiempo_perdido" type="number" min="0" step="0.1" placeholder="Ej: 0.5"
                value={form.tiempo_perdido} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuadrilla" className="text-xs">Cuadrilla (personas)</Label>
              <Input id="cuadrilla" name="cuadrilla" type="number" min="0" placeholder="Ej: 17"
                value={form.cuadrilla} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empaque" className="text-xs">Empaque (personas)</Label>
              <Input id="empaque" name="empaque" type="number" min="0" placeholder="Ej: 3"
                value={form.empaque} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acres" className="text-xs">Acres</Label>
              <Input id="acres" name="acres" type="number" min="0" step="0.1" placeholder="Ej: 80.4"
                value={form.acres} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="racimos_cosechados" className="text-xs">Racimos Cosechados</Label>
              <Input id="racimos_cosechados" name="racimos_cosechados" type="number" min="0" placeholder="Ej: 1367"
                value={form.racimos_cosechados} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="racimos_rechazados" className="text-xs">Racimos Rechazados</Label>
              <Input id="racimos_rechazados" name="racimos_rechazados" type="number" min="0" placeholder="Ej: 49"
                value={form.racimos_rechazados} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="no_manos" className="text-xs">No. Manos</Label>
              <Input id="no_manos" name="no_manos" type="number" min="0" placeholder="Ej: 8"
                value={form.no_manos} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="peso_pinzote" className="text-xs">Peso Pinzote</Label>
              <Input id="peso_pinzote" name="peso_pinzote" type="number" min="0" placeholder="Ej: 8"
                value={form.peso_pinzote} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calibre" className="text-xs">Calibre</Label>
              <Input id="calibre" name="calibre" placeholder="Ej: 40/41"
                value={form.calibre} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quintales_rechazo" className="text-xs">Quintales Rechazo</Label>
              <Input id="quintales_rechazo" name="quintales_rechazo" type="number" min="0" placeholder="Ej: 25"
                value={form.quintales_rechazo} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_tercera" className="text-xs">Cajas Tercera</Label>
              <Input id="cajas_tercera" name="cajas_tercera" type="number" min="0" placeholder="Ej: 226"
                value={form.cajas_tercera} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_primera" className="text-xs">Cajas 1ra</Label>
              <Input id="cajas_primera" name="cajas_primera" type="number" min="0" placeholder="Ej: 1518"
                value={form.cajas_primera} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cajas_segunda" className="text-xs">Cajas 2da</Label>
              <Input id="cajas_segunda" name="cajas_segunda" type="number" min="0" placeholder="Ej: 48"
                value={form.cajas_segunda} onChange={handleChange} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !form.fecha} className="w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Registro"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimos Registros ({registros.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : registros.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hay registros aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Cuadrilla</th>
                    <th className="py-2 pr-3">Racimos Cosech.</th>
                    <th className="py-2 pr-3">Racimos Rechaz.</th>
                    <th className="py-2 pr-3">Cajas 1ra</th>
                    <th className="py-2 pr-3">Cajas 2da</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{r.fecha}</td>
                      <td className="py-2 pr-3">{r.cuadrilla ?? "—"}</td>
                      <td className="py-2 pr-3">{r.racimos_cosechados ?? "—"}</td>
                      <td className="py-2 pr-3">{r.racimos_rechazados ?? "—"}</td>
                      <td className="py-2 pr-3">{r.cajas_primera ?? "—"}</td>
                      <td className="py-2 pr-3">{r.cajas_segunda ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
