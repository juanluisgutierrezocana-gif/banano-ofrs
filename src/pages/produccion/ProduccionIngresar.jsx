import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2, Plus, ListTree } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso } from "@/lib/produccionCalc";

// Mismas columnas manuales que en ProduccionHome.jsx (sin fórmula confirmada
// todavía). Se repiten aquí porque esta tabla "Datos de Proceso" muestra el
// mismo registro completo, en formato vertical, como en el boceto.
const CAMPOS_MANUALES = [
  { field: "factor_primera", label: "Factor 1ra" },
  { field: "factor_general", label: "Factor General" },
  { field: "factor_potencial", label: "Factor Potencial" },
  { field: "peso_racimo", label: "Peso Racimo" },
  { field: "desperdicio_monte", label: "Desperdicio del Monte" },
  { field: "desperdicio_general", label: "Desperdicio General" },
];

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

  const ultimo = registros[0];
  const calculado = ultimo ? calcularDatosProceso(ultimo) : null;

  // Valores locales de los campos manuales del panel "Datos de Proceso"
  // (mismo patrón que ProduccionHome.jsx: se guardan al salir del campo).
  const [valoresProceso, setValoresProceso] = useState({});

  useEffect(() => {
    if (ultimo) {
      const inicial = {};
      CAMPOS_MANUALES.forEach(({ field }) => {
        inicial[field] = ultimo[field] ?? "";
      });
      setValoresProceso(inicial);
    }
  }, [ultimo?.id]);

  const handleChangeProceso = (field, value) => {
    setValoresProceso((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlurProceso = async (field) => {
    if (!ultimo) return;
    const raw = valoresProceso[field];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const valorActual = ultimo[field] ?? null;
    if (nuevoValor === valorActual) return; // sin cambios, no llamamos a Supabase

    const { error } = await produccion.update(ultimo.id, { [field]: nuevoValor });
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

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

  // Redondea valores calculados a 2 decimales, sin tocar null/undefined.
  const redondear = (valor) =>
    valor === null || valor === undefined || Number.isNaN(valor)
      ? null
      : Math.round(valor * 100) / 100;

  // Fila de solo lectura para el panel "Datos de Proceso".
  const FilaProceso = ({ label, valor }) => (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
      <td className="py-1.5 text-right font-medium">{valor ?? "—"}</td>
    </tr>
  );

  return (
    <div className="max-w-7xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
      <Card>
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
          <CardTitle className="text-base flex items-center gap-2">
            <ListTree className="w-4 h-4" />
            Datos de Proceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ultimo ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Aún no hay registros. Guarda el primero para ver aquí los datos calculados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                <FilaProceso label="Hora Inicio" valor={ultimo.hora_inicio} />
                <FilaProceso label="Hora Salida" valor={ultimo.hora_salida} />
                <FilaProceso label="Hrs. Trabajadas" valor={redondear(calculado?.horasTrabajadas)} />
                <FilaProceso label="Tiempo Perdido" valor={ultimo.tiempo_perdido} />
                <FilaProceso label="Cuadrilla" valor={ultimo.cuadrilla} />
                <FilaProceso label="Empaque" valor={ultimo.empaque} />
                <FilaProceso label="Cajas Hora" valor={redondear(calculado?.cajasHora)} />
                <FilaProceso label="Cajas Persona" valor={redondear(calculado?.cajasPersona)} />
                <FilaProceso label="Cajas Empaque" valor={redondear(calculado?.cajasEmpaque)} />
                <FilaProceso label="Acres" valor={ultimo.acres} />
                <FilaProceso label="Hectáreas" valor={redondear(calculado?.hectareas)} />
                <FilaProceso label="Racimos Cosechados" valor={ultimo.racimos_cosechados} />
                <FilaProceso label="Racimos Rechazados" valor={ultimo.racimos_rechazados} />
                <FilaProceso label="Racimos Procesados" valor={calculado?.racimosProcesados} />
                <FilaProceso label="Peso Pinzote" valor={ultimo.peso_pinzote} />
                <FilaProceso label="No. Manos" valor={ultimo.no_manos} />
                <FilaProceso label="Calibre" valor={ultimo.calibre} />
                <FilaProceso label="Cajas Tercera" valor={ultimo.cajas_tercera} />
                {CAMPOS_MANUALES.map(({ field, label }) => (
                  <tr key={field} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-28 text-right rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={valoresProceso[field] ?? ""}
                        onChange={(e) => handleChangeProceso(field, e.target.value)}
                        onBlur={() => handleBlurProceso(field)}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Día: <span className="font-medium text-foreground">{ultimo?.fecha ?? "—"}</span>.
            Factor 1ra/General/Potencial, Peso Racimo y Desperdicio se escriben a mano y se
            guardan automáticamente al salir del campo.
          </p>
        </CardContent>
      </Card>
      </div>

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
