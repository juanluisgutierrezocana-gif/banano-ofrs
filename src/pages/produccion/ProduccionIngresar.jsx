import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion, produccionSemanal, produccionCajasPalet } from "@/api/supabaseClient";
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
  { field: "desperdicio_general", label: "Desperdicio Real" },
];

// --- Tablas semanales (migradas desde la antigua página "Inventario
// Semanal", ahora integradas aquí en "Ingresar Datos") ---
const CODIGOS_SEMANA = [
  "DMD", "DM9", "PRIM", "PREM", "3LB", "IP", "24COUNT",
  "ROSY NORMAL", "ROSY CONSUMER", "DM BANABAC", "DM BANABAC MINI", "3LBS",
];

const DIAS_SEMANA = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
];

// Devuelve la fecha (YYYY-MM-DD) del lunes de la semana actual.
function lunesDeEstaSemana() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

const numeroSemana = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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

  // --- Tablas semanales (migradas desde "Inventario Semanal") ---
  const [semana, setSemana] = useState(lunesDeEstaSemana());

  const { data: filasSemana = [], isLoading: cargandoGrid } = useQuery({
    queryKey: ["produccion-semanal", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: filasCajasPalet = [], isLoading: cargandoCajasPalet } = useQuery({
    queryKey: ["produccion-cajas-palet", semana],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [valoresGrid, setValoresGrid] = useState({});
  useEffect(() => {
    const inicial = {};
    CODIGOS_SEMANA.forEach((codigo) => {
      const fila = filasSemana.find((f) => f.codigo_producto === codigo);
      inicial[codigo] = {
        id: fila?.id ?? null,
        lunes: fila?.lunes ?? "",
        martes: fila?.martes ?? "",
        miercoles: fila?.miercoles ?? "",
        jueves: fila?.jueves ?? "",
        viernes: fila?.viernes ?? "",
        sabado: fila?.sabado ?? "",
        meta: fila?.meta ?? "",
      };
    });
    setValoresGrid(inicial);
  }, [filasSemana, semana]);

  const [valoresCajasPalet, setValoresCajasPalet] = useState({});
  useEffect(() => {
    const inicial = {};
    DIAS_SEMANA.forEach(({ key }) => {
      const fila = filasCajasPalet.find((f) => f.dia === key);
      inicial[key] = {
        id: fila?.id ?? null,
        cajas: fila?.cajas ?? "",
        palet: fila?.palet ?? "",
      };
    });
    setValoresCajasPalet(inicial);
  }, [filasCajasPalet, semana]);

  const handleChangeGrid = (codigo, campo, valor) => {
    setValoresGrid((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], [campo]: valor },
    }));
  };

  const handleBlurGrid = async (codigo, campo) => {
    const fila = valoresGrid[codigo];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filasSemana.find((f) => f.codigo_producto === codigo);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionSemanal.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      const { data, error } = await produccionSemanal.create({
        fecha_semana: semana,
        codigo_producto: codigo,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresGrid((prev) => ({
        ...prev,
        [codigo]: { ...prev[codigo], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-semanal", semana] });
  };

  const handleChangeCajasPalet = (dia, campo, valor) => {
    setValoresCajasPalet((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: valor },
    }));
  };

  const handleBlurCajasPalet = async (dia, campo) => {
    const fila = valoresCajasPalet[dia];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filasCajasPalet.find((f) => f.dia === dia);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionCajasPalet.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      const { data, error } = await produccionCajasPalet.create({
        fecha_semana: semana,
        dia,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresCajasPalet((prev) => ({
        ...prev,
        [dia]: { ...prev[dia], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-cajas-palet", semana] });
  };

  // Totales calculados en pantalla (no se guardan en la base de datos).
  const totalPorCodigo = (codigo) =>
    DIAS_SEMANA.reduce((suma, { key }) => suma + numeroSemana(valoresGrid[codigo]?.[key]), 0);

  const totalPorDia = (diaKey) =>
    CODIGOS_SEMANA.reduce((suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.[diaKey]), 0);

  const totalMetas = CODIGOS_SEMANA.reduce((suma, codigo) => suma + numeroSemana(valoresGrid[codigo]?.meta), 0);
  const granTotalSemana = CODIGOS_SEMANA.reduce((suma, codigo) => suma + totalPorCodigo(codigo), 0);

  const inputClaseSemana =
    "w-20 text-center rounded-md border border-input bg-background px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

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

  // Fila editable (a mano) para el panel "Datos de Proceso".
  const FilaEditable = ({ field, label }) => (
    <tr className="border-b last:border-0">
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
      <div className="space-y-6">
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

      {/* Tablas semanales migradas desde "Inventario Semanal" */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Producción Semanal por Código</CardTitle>
          <div className="max-w-[180px] space-y-1.5 pt-2">
            <Label htmlFor="semana" className="text-xs">Semana (lunes)</Label>
            <Input id="semana" type="date" value={semana} onChange={(e) => setSemana(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {cargandoGrid ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                    {DIAS_SEMANA.map(({ key, label }) => (
                      <th key={key} className="py-2 px-2 whitespace-nowrap">{label}</th>
                    ))}
                    <th className="py-2 px-3 whitespace-nowrap">Total</th>
                    <th className="py-2 px-3 whitespace-nowrap">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {CODIGOS_SEMANA.map((codigo) => (
                    <tr key={codigo} className="border-b last:border-0">
                      <td className="py-1.5 px-3 font-medium whitespace-nowrap">{codigo}</td>
                      {DIAS_SEMANA.map(({ key }) => (
                        <td key={key} className="py-1 px-1">
                          <input
                            type="number"
                            step="1"
                            className={inputClaseSemana}
                            value={valoresGrid[codigo]?.[key] ?? ""}
                            onChange={(e) => handleChangeGrid(codigo, key, e.target.value)}
                            onBlur={() => handleBlurGrid(codigo, key)}
                            placeholder="—"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-center font-semibold">{totalPorCodigo(codigo) || "—"}</td>
                      <td className="py-1 px-1">
                        <input
                          type="number"
                          step="1"
                          className={inputClaseSemana}
                          value={valoresGrid[codigo]?.meta ?? ""}
                          onChange={(e) => handleChangeGrid(codigo, "meta", e.target.value)}
                          onBlur={() => handleBlurGrid(codigo, "meta")}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="py-2 px-3 whitespace-nowrap">TOTAL</td>
                    {DIAS_SEMANA.map(({ key }) => (
                      <td key={key} className="py-2 px-2 text-center">{totalPorDia(key) || "—"}</td>
                    ))}
                    <td className="py-2 px-3 text-center">{granTotalSemana || "—"}</td>
                    <td className="py-2 px-3 text-center">{totalMetas || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Las celdas de cada código y la columna Meta se escriben a mano y se guardan
            automáticamente al salir del campo. Total y TOTAL se calculan en pantalla.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cajas / Palet por Día</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoCajasPalet ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Día</th>
                    <th className="py-2 px-3 whitespace-nowrap">Cajas</th>
                    <th className="py-2 px-3 whitespace-nowrap">Palet</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS_SEMANA.map(({ key, label }) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-1.5 px-3 font-medium whitespace-nowrap">{label}</td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          step="1"
                          className={inputClaseSemana}
                          value={valoresCajasPalet[key]?.cajas ?? ""}
                          onChange={(e) => handleChangeCajasPalet(key, "cajas", e.target.value)}
                          onBlur={() => handleBlurCajasPalet(key, "cajas")}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          step="1"
                          className={inputClaseSemana}
                          value={valoresCajasPalet[key]?.palet ?? ""}
                          onChange={(e) => handleChangeCajasPalet(key, "palet", e.target.value)}
                          onBlur={() => handleBlurCajasPalet(key, "palet")}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Se escribe a mano (sin fórmula confirmada todavía) y se guarda automáticamente
            al salir del campo.
          </p>
        </CardContent>
      </Card>
      </div>

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
                {/* Orden exacto del boceto Excel del cliente (INF. PROCESO E INVENTARIOS) */}
                <FilaProceso label="Hora Inicio" valor={ultimo.hora_inicio} />
                <FilaProceso label="Hora Salida" valor={ultimo.hora_salida} />
                <FilaProceso label="Hrs. Trabajadas" valor={redondear(calculado?.horasTrabajadas)} />
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
                <FilaEditable field="factor_primera" label="Factor 1ra" />
                <FilaEditable field="factor_general" label="Factor General" />
                <FilaEditable field="factor_potencial" label="Factor Potencial" />
                <FilaEditable field="desperdicio_monte" label="Desperdicio del Monte" />
                <FilaEditable field="desperdicio_general" label="Desperdicio Real" />
                <FilaProceso label="Peso Pinzote" valor={ultimo.peso_pinzote} />
                <FilaEditable field="peso_racimo" label="Peso Racimo" />
                <FilaProceso label="Número de Manos" valor={ultimo.no_manos} />
                <FilaProceso label="Calibre" valor={ultimo.calibre} />
                <FilaProceso label="Total Cajas" valor={redondear(calculado?.cajasTotal)} />
                <FilaProceso label="Libras Procesadas" valor={redondear(calculado?.librasProcesadas)} />
                <FilaProceso label="Quintales" valor={ultimo.quintales_rechazo} />
                <FilaProceso label="Tiempo Perdido" valor={ultimo.tiempo_perdido} />
                <FilaProceso label="Tercera" valor={ultimo.cajas_tercera} />
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Día: <span className="font-medium text-foreground">{ultimo?.fecha ?? "—"}</span>.
            Factor 1ra/General/Potencial, Peso Racimo, Desperdicio del Monte y Desperdicio Real
            se escriben a mano y se guardan automáticamente al salir del campo.
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
