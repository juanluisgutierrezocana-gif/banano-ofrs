import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// FIXED: importar seccionAgricola (tabla: seccion_agricola) en lugar de sections (tabla: sections)
// Las secciones agrícolas tienen: nombre, acres, minifinca, activa — distinto de sections (name, active)
import { supabase, seccionAgricola, laborAgricola } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Settings, Plus, Trash2, MapPin, Layers, TreePine, ClipboardList, Pencil, Check, X, ChevronDown } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";
import { useMinifincas } from "@/lib/useMinifincas";
import { toast } from "sonner";

const emptySeccion = { nombre: "", acres: "", minifinca: "" };
const emptyLabor = { nombre: "", num_ciclos: "9", unidad_extra: "", secciones_excluidas: [] };
const UNIDADES = ["litros", "galones", "sacos", "matas", "racimos", "pulgadas", "milimetros"];

export default function AvancesConfiguraciones() {
  const { isAdmin, hasPermiso, minifincasPermitidas } = useRole();
  const queryClient = useQueryClient();

  // Catálogo de minifincas (barra CREAR MF / MF1 / MF2 / MF3...)
  const { minifincas, conteoSecciones, crearMinifinca, creando, eliminarMinifinca } = useMinifincas();
  const [creandoMF, setCreandoMF] = useState(false);
  const [nuevaMF, setNuevaMF] = useState("");
  const [filtroMF, setFiltroMF] = useState(null); // null = todas

  const handleCrearMF = async () => {
    try {
      const mf = await crearMinifinca(nuevaMF);
      toast.success(`Minifinca ${mf} creada`);
      setNuevaMF("");
      setCreandoMF(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEliminarMF = async (mf) => {
    if (!confirm(`¿Eliminar la minifinca ${mf}?`)) return;
    try {
      await eliminarMinifinca(mf);
      if (filtroMF === mf) setFiltroMF(null);
      toast.success(`Minifinca ${mf} eliminada`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const [formSeccion, setFormSeccion] = useState(emptySeccion);
  const [savingSeccion, setSavingSeccion] = useState(false);
  const [deletingSeccionId, setDeletingSeccionId] = useState(null);

  // Estado de edición inline para secciones
  const [editingSeccion, setEditingSeccion] = useState(null); // { id, nombre, acres, minifinca }
  const [savingEditSeccion, setSavingEditSeccion] = useState(false);

  const [formLabor, setFormLabor] = useState(emptyLabor);
  const [savingLabor, setSavingLabor] = useState(false);
  const [deletingLaborId, setDeletingLaborId] = useState(null);
  const [editingLabor, setEditingLabor] = useState(null);
  const [savingEditLabor, setSavingEditLabor] = useState(false);

  const [seccionesExpanded, setSeccionesExpanded] = useState(true);
  const [laboresExpanded, setLaboresExpanded] = useState(true);

  // FIXED: usar seccionAgricola en lugar de sections; unwrap { data, error }; sin ordenar por columna inexistente
  const { data: secciones = [], isLoading: loadingSec } = useQuery({
    queryKey: ["secciones-agricolas"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  // FIXED: unwrap { data, error }; usar -created_at que sí existe en Supabase
  const { data: labores = [], isLoading: loadingLab } = useQuery({
    queryKey: ["labores-agricolas"],
    queryFn: async () => {
      const { data, error } = await laborAgricola.list("-created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Secciones
  const handleSeccionChange = (e) => setFormSeccion({ ...formSeccion, [e.target.name]: e.target.value });

  const handleSaveSeccion = async () => {
    if (!formSeccion.nombre.trim() || !formSeccion.acres || !formSeccion.minifinca.trim()) return;
    setSavingSeccion(true);
    // FIXED: usar seccionAgricola.create en lugar de sections.create
    await seccionAgricola.create({
      nombre: formSeccion.nombre.trim(),
      acres: parseFloat(formSeccion.acres),
      minifinca: formSeccion.minifinca.trim(),
      activa: true,
    });
    queryClient.invalidateQueries({ queryKey: ["secciones-agricolas"] });
    setFormSeccion(emptySeccion);
    setSavingSeccion(false);
  };

  const handleDeleteSeccion = async (id) => {
    setDeletingSeccionId(id);
    // FIXED: usar seccionAgricola.delete en lugar de sections.delete
    await seccionAgricola.delete(id);
    queryClient.invalidateQueries({ queryKey: ["secciones-agricolas"] });
    setDeletingSeccionId(null);
  };

  const handleSaveEditSeccion = async () => {
    if (!editingSeccion?.nombre?.trim() || !editingSeccion?.acres || !editingSeccion?.minifinca?.trim()) return;
    setSavingEditSeccion(true);

    const nuevoNombre = editingSeccion.nombre.trim();
    const nuevaMinifinca = editingSeccion.minifinca.trim();
    const nuevosAcres = parseFloat(editingSeccion.acres);

    // 1. Actualizar la sección en seccion_agricola
    const { error: secError } = await seccionAgricola.update(editingSeccion.id, {
      nombre: nuevoNombre,
      acres: nuevosAcres,
      minifinca: nuevaMinifinca,
    });
    if (secError) {
      setSavingEditSeccion(false);
      return;
    }

    // 2. Propagar nombre y minifinca a registros_labor (texto denormalizado).
    //    acres no se guarda en registros_labor, solo en seccion_agricola.
    await supabase
      .from("registros_labor")
      .update({ seccion_nombre: nuevoNombre, minifinca: nuevaMinifinca })
      .eq("seccion_id", editingSeccion.id);

    queryClient.invalidateQueries({ queryKey: ["secciones-agricolas"] });
    queryClient.invalidateQueries({ queryKey: ["registros-labor"] });
    setEditingSeccion(null);
    setSavingEditSeccion(false);
  };

  // Labores
  const handleLaborChange = (e) => setFormLabor({ ...formLabor, [e.target.name]: e.target.value });

  const handleSaveLabor = async () => {
    if (!formLabor.nombre.trim()) return;
    setSavingLabor(true);
    const payload = {
      nombre: formLabor.nombre.trim(),
      activa: true,
      num_ciclos: parseInt(formLabor.num_ciclos) || 9,
      secciones_excluidas: formLabor.secciones_excluidas || [],
    };
    if (formLabor.unidad_extra) payload.unidad_extra = formLabor.unidad_extra;
    await laborAgricola.create(payload);
    queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] });
    setFormLabor(emptyLabor);
    setSavingLabor(false);
  };

  const toggleSeccionExcluida = (laborOrForm, seccionId, isForm = false) => {
    if (isForm) {
      const current = formLabor.secciones_excluidas || [];
      const updated = current.includes(seccionId)
        ? current.filter((id) => id !== seccionId)
        : [...current, seccionId];
      setFormLabor({ ...formLabor, secciones_excluidas: updated });
    } else {
      const current = laborOrForm.secciones_excluidas || [];
      const updated = current.includes(seccionId)
        ? current.filter((id) => id !== seccionId)
        : [...current, seccionId];
      laborAgricola.update(laborOrForm.id, { secciones_excluidas: updated })
        .then(() => queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] }));
    }
  };

  const handleToggleUnidadLabor = async (labor, unidad) => {
    const nueva = labor.unidad_extra === unidad ? null : unidad;
    await laborAgricola.update(labor.id, { unidad_extra: nueva });
    queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] });
  };

  const handleDeleteLabor = async (id) => {
    setDeletingLaborId(id);
    await laborAgricola.delete(id);
    queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] });
    setDeletingLaborId(null);
  };

  const handleToggleLabor = async (labor) => {
    await laborAgricola.update(labor.id, { activa: !labor.activa });
    queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] });
  };

  const handleSaveEditLabor = async () => {
    if (!editingLabor?.nombre?.trim()) return;
    setSavingEditLabor(true);
    await laborAgricola.update(editingLabor.id, { nombre: editingLabor.nombre.trim() });
    queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] });
    setEditingLabor(null);
    setSavingEditLabor(false);
  };

  // Un Editor con el permiso 'avances_agricolas' edita igual que un admin
  // (AvancesLayout ya bloqueó por completo a quien no tenga el permiso;
  // este chequeo es solo una segunda barrera por si se entra directo a la URL).
  // Un caporal restringido a ciertas minifincas NO puede entrar aquí: podría
  // cambiar la minifinca de una sección y saltarse su restricción.
  if ((!isAdmin && !hasPermiso("avances_agricolas")) || minifincasPermitidas !== null) {
    return <AdminOnlyMessage />;
  }

  const seccionesVisibles = filtroMF
    ? secciones.filter((s) => (s.minifinca || "").trim().toUpperCase() === filtroMF)
    : secciones;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Configuraciones</h1>
          <p className="text-muted-foreground text-sm">Secciones y labores agrícolas</p>
        </div>
      </div>

      {/* ===== MINIFINCAS: CREAR MF + MF1 / MF2 / MF3 ... ===== */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {creandoMF ? (
              <div className="flex items-center gap-1.5">
                <Input
                  className="h-8 w-28 text-sm uppercase"
                  placeholder="Ej: MF3"
                  value={nuevaMF}
                  autoFocus
                  onChange={(e) => setNuevaMF(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCrearMF();
                    if (e.key === "Escape") { setCreandoMF(false); setNuevaMF(""); }
                  }}
                />
                <Button size="icon" className="h-8 w-8" onClick={handleCrearMF} disabled={creando || !nuevaMF.trim()}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setCreandoMF(false); setNuevaMF(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setCreandoMF(true)}>
                <Plus className="w-4 h-4" /> Crear MF
              </Button>
            )}

            <span className="w-px h-6 bg-border mx-1" />

            <button
              type="button"
              onClick={() => setFiltroMF(null)}
              className={`h-8 px-3 rounded-lg border text-sm font-medium transition-colors ${
                filtroMF === null ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
              }`}
            >
              Todas
            </button>

            {minifincas.map((mf) => (
              <div
                key={mf}
                className={`group flex items-center h-8 rounded-lg border text-sm font-medium transition-colors ${
                  filtroMF === mf ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                }`}
              >
                <button type="button" className="px-3 h-full" onClick={() => setFiltroMF(filtroMF === mf ? null : mf)}
                  title="Ver solo las secciones de esta minifinca">
                  {mf}
                  <span className="ml-1.5 text-xs opacity-70">({conteoSecciones[mf] || 0})</span>
                </button>
                {!conteoSecciones[mf] && (
                  <button type="button" className="pr-2 opacity-60 hover:opacity-100" onClick={() => handleEliminarMF(mf)}
                    title="Eliminar minifinca (no tiene secciones)">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Crea aquí las minifincas y asígnalas a cada sección. En Configuraciones → Usuarios le das a cada caporal su minifinca: solo podrá registrar en esas secciones.
          </p>
        </CardContent>
      </Card>

      {/* ===== SECCIONES ===== */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TreePine className="w-4 h-4 text-primary" /> Nueva Sección
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="flex items-center gap-1.5 text-xs">
                <TreePine className="w-3.5 h-3.5" /> Nombre de la sección
              </Label>
              <Input id="nombre" name="nombre" placeholder="Ej: Sección Norte"
                value={formSeccion.nombre} onChange={handleSeccionChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acres" className="flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5" /> Acres
              </Label>
              <Input id="acres" name="acres" type="number" min="0" step="0.01" placeholder="Ej: 12.5"
                value={formSeccion.acres} onChange={handleSeccionChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minifinca" className="flex items-center gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5" /> Minifinca
              </Label>
              {/* Se elige de las minifincas creadas con "Crear MF" */}
              <select id="minifinca" name="minifinca"
                value={formSeccion.minifinca} onChange={handleSeccionChange}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">{minifincas.length ? "Seleccionar minifinca" : "Primero crea una MF"}</option>
                {minifincas.map((mf) => <option key={mf} value={mf}>{mf}</option>)}
              </select>
            </div>
          </div>
          <Button
            onClick={handleSaveSeccion}
            disabled={savingSeccion || !formSeccion.nombre.trim() || !formSeccion.acres || !formSeccion.minifinca.trim()}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {savingSeccion ? "Guardando..." : "Agregar Sección"}
          </Button>
        </CardContent>
      </Card>

      <Collapsible open={seccionesExpanded} onOpenChange={setSeccionesExpanded} className="mb-8">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Secciones Registradas ({seccionesVisibles.length}{filtroMF ? ` de ${secciones.length} — ${filtroMF}` : ""})
                </CardTitle>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${seccionesExpanded ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {loadingSec ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : seccionesVisibles.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {filtroMF ? `No hay secciones en ${filtroMF}.` : "No hay secciones aún."}
                </p>
              ) : (
                <div className="space-y-3">
                  {seccionesVisibles.map((s) => {
                    const isEditingThis = editingSeccion?.id === s.id;
                    return (
                      <div key={s.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                        {isEditingThis ? (
                          /* ---- Modo edición inline ---- */
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <Input
                              className="h-7 text-sm w-36"
                              placeholder="Nombre"
                              value={editingSeccion.nombre}
                              onChange={(e) => setEditingSeccion({ ...editingSeccion, nombre: e.target.value })}
                              autoFocus
                            />
                            <Input
                              className="h-7 text-sm w-20"
                              type="number" min="0" step="0.01"
                              placeholder="Acres"
                              value={editingSeccion.acres}
                              onChange={(e) => setEditingSeccion({ ...editingSeccion, acres: e.target.value })}
                            />
                            <select
                              className="h-7 w-28 rounded-md border border-input bg-transparent px-2 text-sm"
                              value={editingSeccion.minifinca}
                              onChange={(e) => setEditingSeccion({ ...editingSeccion, minifinca: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditSeccion(); if (e.key === "Escape") setEditingSeccion(null); }}
                            >
                              <option value="">Minifinca</option>
                              {/* Incluye la MF actual aunque no esté en el catálogo */}
                              {[...new Set([...minifincas, (editingSeccion.minifinca || "").trim()])].filter(Boolean).map((mf) => (
                                <option key={mf} value={mf}>{mf}</option>
                              ))}
                            </select>
                            <Button size="icon" className="h-7 w-7" onClick={handleSaveEditSeccion} disabled={savingEditSeccion}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingSeccion(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          /* ---- Modo visualización ---- */
                          <>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <TreePine className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{s.nombre}</p>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {s.acres} acres</span>
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.minifinca}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setEditingSeccion({ id: s.id, nombre: s.nombre, acres: String(s.acres ?? ""), minifinca: s.minifinca ?? "" })}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSeccion(s.id)} disabled={deletingSeccionId === s.id}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ===== LABORES ===== */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" /> Nueva Labor Agrícola
          </CardTitle>
        </CardHeader>
        <CardContent>
         <div className="space-y-4 mb-4">
           <div className="space-y-1.5">
             <Label htmlFor="labor_nombre" className="text-xs">Nombre de la labor</Label>
             <Input id="labor_nombre" name="nombre" placeholder="Ej: Deshoje, Apuntalado, Deschante..."
               value={formLabor.nombre} onChange={handleLaborChange} />
           </div>
           <div className="space-y-1.5">
             <Label htmlFor="num_ciclos" className="text-xs">Número de ciclos</Label>
             <Input id="num_ciclos" name="num_ciclos" type="number" min="1" max="53" placeholder="1-53"
               value={formLabor.num_ciclos} onChange={handleLaborChange} />
           </div>
           <div className="space-y-1.5">
             <Label className="text-xs">Unidad adicional (opcional)</Label>
              <div className="flex flex-wrap gap-2">
                {UNIDADES.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setFormLabor({ ...formLabor, unidad_extra: formLabor.unidad_extra === u ? "" : u })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      formLabor.unidad_extra === u
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {formLabor.unidad_extra && (
                <p className="text-xs text-primary">✓ Se habilitará campo "{formLabor.unidad_extra}" en el registro</p>
              )}
              </div>
              {secciones.length > 0 && (
               <div className="flex items-center gap-2">
                 <Label className="text-xs">Secciones:</Label>
                 <button type="button" onClick={() => setFormLabor({ ...formLabor, secciones_excluidas: [] })}
                   className="text-xs px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                   Todas
                 </button>
                 <button type="button" onClick={() => setFormLabor({ ...formLabor, secciones_excluidas: secciones.map(s => s.id) })}
                   className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted transition-colors">
                   Ninguna
                 </button>
                 <span className="text-xs text-muted-foreground">
                   ({secciones.length - (formLabor.secciones_excluidas || []).length}/{secciones.length} activas)
                 </span>
               </div>
               )}
              </div>
              <Button
              onClick={handleSaveLabor}
            disabled={savingLabor || !formLabor.nombre.trim()}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {savingLabor ? "Guardando..." : "Agregar Labor"}
          </Button>
        </CardContent>
      </Card>

      <Collapsible open={laboresExpanded} onOpenChange={setLaboresExpanded}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Labores Registradas ({labores.length})</CardTitle>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${laboresExpanded ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {loadingLab ? (
                <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
              ) : labores.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No hay labores aún.</p>
              ) : (
                <div className="space-y-3">
                  {labores.map((l) => (
                    <div key={l.id}
                      className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${l.activa ? "bg-primary/10" : "bg-muted"}`}>
                          <ClipboardList className={`w-4 h-4 ${l.activa ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        {editingLabor?.id === l.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              className="h-7 text-sm"
                              value={editingLabor.nombre}
                              onChange={(e) => setEditingLabor({ ...editingLabor, nombre: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditLabor(); if (e.key === "Escape") setEditingLabor(null); }}
                              autoFocus
                            />
                            <Button size="icon" className="h-7 w-7" onClick={handleSaveEditLabor} disabled={savingEditLabor}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLabor(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                              <p className={`font-semibold ${l.activa ? "text-foreground" : "text-muted-foreground line-through"}`}>{l.nombre}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">{l.activa ? "Activa" : "Inactiva"}</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{l.num_ciclos || 9} ciclos</span>
                               {UNIDADES.map((u) => (
                                  <button key={u} type="button"
                                    onClick={() => handleToggleUnidadLabor(l, u)}
                                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors capitalize ${
                                      l.unidad_extra === u
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-transparent border-border text-muted-foreground hover:border-primary/50"
                                    }`}
                                  >{u}</button>
                                ))}
                              </div>
                              {secciones.length > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-muted-foreground">Secciones:</p>
                                  <button type="button"
                                    onClick={() => laborAgricola.update(l.id, { secciones_excluidas: [] }).then(() => queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] }))}
                                    className="text-xs px-1.5 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                                    Todas
                                  </button>
                                  <button type="button"
                                    onClick={() => laborAgricola.update(l.id, { secciones_excluidas: secciones.map(s => s.id) }).then(() => queryClient.invalidateQueries({ queryKey: ["labores-agricolas"] }))}
                                    className="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted transition-colors">
                                    Ninguna
                                  </button>
                                  <span className="text-xs text-muted-foreground">
                                    ({secciones.length - (l.secciones_excluidas || []).length}/{secciones.length} activas)
                                  </span>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                      {editingLabor?.id !== l.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleLabor(l)}
                            title={l.activa ? "Desactivar" : "Activar"}
                            className={`w-10 h-5 rounded-full transition-colors relative ${l.activa ? "bg-primary" : "bg-muted-foreground/30"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${l.activa ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingLabor({ id: l.id, nombre: l.nombre })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteLabor(l.id)} disabled={deletingLaborId === l.id}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
