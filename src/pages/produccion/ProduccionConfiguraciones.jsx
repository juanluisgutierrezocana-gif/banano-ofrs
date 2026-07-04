import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccionVisibilidad, calidadesProduccion, settings } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Settings, Eye, EyeOff, Pencil, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";
import { CAMPOS_RESUMEN } from "@/lib/produccionConstantes";

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

  // Calidades de "Ingresar Datos" (antes lista fija en produccionConstantes.js,
  // ahora editable y con alta de calidades nuevas desde aquí mismo).
  const { data: calidades = [], isLoading: cargandoCalidades } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  // Edición de una calidad existente (Calidad/Caj./Cod). El `codigo` interno
  // no se edita aquí: ya lo usan produccion_semanal y produccion_visibilidad.
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({ label: "", codigo_corto: "", caj_default: "" });
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // TOTAL ACRES FINCA — editable desde aquí, guardado en la tabla settings.
  const [acresFinca, setAcresFinca] = useState("");
  const [guardandoAcres, setGuardandoAcres] = useState(false);

  const { data: acresConfig } = useQuery({
    queryKey: ["settings-acres-finca"],
    queryFn: async () => {
      const { data } = await settings.filter({ key: "area_total_finca_acres" });
      return data?.[0] ?? null;
    },
  });

  // Sincronizar el input con el valor guardado cuando carga la query
  useEffect(() => {
    if (acresConfig !== undefined) {
      setAcresFinca(String(acresConfig?.value ?? 260.6));
    }
  }, [acresConfig]);

  const handleGuardarAcres = async () => {
    const valor = parseFloat(acresFinca);
    if (isNaN(valor) || valor <= 0) {
      toast.error("Ingresa un valor válido mayor a 0");
      return;
    }
    setGuardandoAcres(true);
    let result;
    if (acresConfig?.id) {
      result = await settings.update(acresConfig.id, { value: valor });
    } else {
      result = await settings.create({ key: "area_total_finca_acres", value: valor });
    }
    setGuardandoAcres(false);
    if (result.error) {
      toast.error("No se pudo guardar: " + result.error.message);
      return;
    }
    toast.success("Total acres guardado");
    queryClient.invalidateQueries({ queryKey: ["settings-acres-finca"] });
  };

  // Alta de una calidad nueva.
  const [agregando, setAgregando] = useState(false);
  const [formNueva, setFormNueva] = useState({ label: "", codigo_corto: "", caj_default: "" });
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  if (!isAdmin && !hasPermiso("produccion")) {
    return <AdminOnlyMessage />;
  }

  const abrirEditar = (calidad) => {
    setFormEdit({
      label: calidad.label ?? "",
      codigo_corto: calidad.codigo_corto ?? "",
      caj_default: calidad.caj_default ?? "",
    });
    setEditando(calidad);
  };

  const handleGuardarEdit = async () => {
    if (!editando) return;
    const label = formEdit.label.trim();
    if (!label) {
      toast.error("La calidad necesita un nombre");
      return;
    }
    setGuardandoEdit(true);
    const { error } = await calidadesProduccion.update(editando.id, {
      label,
      codigo_corto: formEdit.codigo_corto.trim() || null,
      caj_default: formEdit.caj_default === "" ? null : parseFloat(formEdit.caj_default),
    });
    setGuardandoEdit(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Calidad actualizada");
    queryClient.invalidateQueries({ queryKey: ["calidades-produccion"] });
    setEditando(null);
  };

  // Eliminar una calidad existente (irreversible).
  const handleEliminarCalidad = async (calidad) => {
    if (!confirm(`¿Eliminar la calidad "${calidad.label}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await calidadesProduccion.delete(calidad.id);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Calidad eliminada");
    queryClient.invalidateQueries({ queryKey: ["calidades-produccion"] });
  };

  // El código interno nace igual al nombre escrito (en mayúsculas): es el
  // mismo identificador que después usan produccion_semanal (codigo_producto)
  // y produccion_visibilidad (clave), por eso no se puede cambiar después.
  const handleAgregarCalidad = async () => {
    const label = formNueva.label.trim();
    if (!label) {
      toast.error("La calidad necesita un nombre");
      return;
    }
    const codigo = label.toUpperCase();
    if (calidades.some((c) => c.codigo === codigo)) {
      toast.error("Ya existe una calidad con ese nombre");
      return;
    }
    setGuardandoNueva(true);
    const siguientePosicion = calidades.length
      ? Math.max(...calidades.map((c) => c.position ?? 0)) + 1
      : 0;
    const { error } = await calidadesProduccion.create({
      codigo,
      label,
      codigo_corto: formNueva.codigo_corto.trim() || null,
      caj_default: formNueva.caj_default === "" ? null : parseFloat(formNueva.caj_default),
      position: siguientePosicion,
    });
    setGuardandoNueva(false);
    if (error) {
      toast.error("No se pudo crear: " + error.message);
      return;
    }
    toast.success("Calidad agregada");
    queryClient.invalidateQueries({ queryKey: ["calidades-produccion"] });
    setFormNueva({ label: "", codigo_corto: "", caj_default: "" });
    setAgregando(false);
  };

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

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Total Acres Finca</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Número total de acres de la finca. Se usa para calcular % Área Cosecha Día y % Recorrido en Reportería.
            Valor por defecto: 260.6 acres.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-xs">
            <Label htmlFor="acres-finca" className="text-sm font-medium whitespace-nowrap">
              TOTAL ACRES FINCA
            </Label>
            <Input
              id="acres-finca"
              type="number"
              step="0.1"
              min="0"
              placeholder="260.6"
              value={acresFinca}
              onChange={(e) => setAcresFinca(e.target.value)}
              className="w-32"
            />
            <Button size="sm" onClick={handleGuardarAcres} disabled={guardandoAcres}>
              <Save className="w-3.5 h-3.5" />
              {guardandoAcres ? "Guardando..." : "Guardar"}
            </Button>
          </div>
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
          {isLoading || cargandoCalidades ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {calidades.map((calidad) => (
                <div key={calidad.id} className="flex items-center gap-1">
                  <BotonToggle grupo={GRUPO_CALIDADES} clave={calidad.codigo} label={calidad.label} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    title="Editar calidad"
                    onClick={() => abrirEditar(calidad)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Eliminar calidad"
                    onClick={() => handleEliminarCalidad(calidad)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setAgregando(true)}>
                <Plus className="w-3.5 h-3.5" />
                Agregar calidad
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editar calidad existente — Calidad/Caj./Cod. El código interno
          (codigo) no se edita: ya lo usan produccion_semanal y
          produccion_visibilidad. */}
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar calidad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_label" className="text-xs">Calidad</Label>
              <Input
                id="edit_label"
                value={formEdit.label}
                onChange={(e) => setFormEdit({ ...formEdit, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit_caj" className="text-xs">Caj.</Label>
                <Input
                  id="edit_caj"
                  type="number"
                  min="0"
                  value={formEdit.caj_default}
                  onChange={(e) => setFormEdit({ ...formEdit, caj_default: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit_cod" className="text-xs">Cod</Label>
                <Input
                  id="edit_cod"
                  value={formEdit.codigo_corto}
                  onChange={(e) => setFormEdit({ ...formEdit, codigo_corto: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={handleGuardarEdit} disabled={guardandoEdit}>
              {guardandoEdit ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agregar calidad nueva — aparece de inmediato en "Producción Semanal
          por Código" y "Resumen de Producción" de Ingresar Datos. */}
      <Dialog open={agregando} onOpenChange={(open) => !open && setAgregando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar calidad nueva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nueva_label" className="text-xs">Calidad</Label>
              <Input
                id="nueva_label"
                placeholder="Ej: DM10"
                value={formNueva.label}
                onChange={(e) => setFormNueva({ ...formNueva, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nueva_caj" className="text-xs">Caj.</Label>
                <Input
                  id="nueva_caj"
                  type="number"
                  min="0"
                  placeholder="Ej: 48"
                  value={formNueva.caj_default}
                  onChange={(e) => setFormNueva({ ...formNueva, caj_default: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nueva_cod" className="text-xs">Cod</Label>
                <Input
                  id="nueva_cod"
                  placeholder="Ej: C10"
                  value={formNueva.codigo_corto}
                  onChange={(e) => setFormNueva({ ...formNueva, codigo_corto: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta calidad aparecerá en "Producción Semanal por Código" y "Resumen de Producción" de Ingresar Datos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgregando(false)}>Cancelar</Button>
            <Button onClick={handleAgregarCalidad} disabled={guardandoNueva}>
              {guardandoNueva ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
