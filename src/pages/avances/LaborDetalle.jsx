import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// FIXED: importar seccionAgricola (tabla: seccion_agricola, columnas: nombre, acres, minifinca, activa)
// y reports (tabla: registros_labor) en lugar de usar supabase.from("registro_labor") directamente
import { supabase, laborAgricola, seccionAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ClipboardList, Pencil, Check, X, XCircle } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";
import { toast } from "sonner";

const ACRES_TO_HA = 0.404686;

function getWeek(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

const emptyEntry = { fecha: "", seccion_id: "", ciclo: "", acres_realizados: "", unidad_extra_valor: "" };

const playSuccessSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.frequency.value = 800;
  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
};

export default function LaborDetalle() {
  const { laborId } = useParams();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();
  const [entry, setEntry] = useState(emptyEntry);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [updatingId, setUpdatingId] = useState(null);

  // Modal estado
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeccionId, setModalSeccionId] = useState(null);
  const [modalCiclo, setModalCiclo] = useState(null);

  const fechaRef = useRef(null);
  const seccionRef = useRef(null);
  const acresRef = useRef(null);
  const cicloRef = useRef(null);
  const btnRef = useRef(null);

  const focusNext = (nextRef) => {
    setTimeout(() => nextRef?.current?.focus(), 50);
  };

  // FIXED: unwrap { data, error } del createEntity factory
  const { data: labores = [] } = useQuery({
    queryKey: ["labores-agricolas"],
    queryFn: async () => {
      const { data, error } = await laborAgricola.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const labor = labores.find((l) => l.id === laborId);
  const isEmbolse = useMemo(() => labor?.nombre?.toLowerCase().includes("embolse"), [labor?.nombre]);

  const CICLOS = useMemo(() => {
    if (!labor?.num_ciclos) return [];
    return Array.from({ length: labor.num_ciclos }, (_, i) => i + 1);
  }, [labor?.num_ciclos]);

  // FIXED: usar seccionAgricola (tabla: seccion_agricola) en lugar de sections (tabla: sections)
  // La tabla seccion_agricola tiene: nombre, acres, minifinca, activa
  const { data: secciones = [] } = useQuery({
    queryKey: ["secciones-agricolas"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  // FIXED: usar reports.filter (tabla: registros_labor) en lugar de
  // supabase.from("registro_labor").select("*")({ labor_id: laborId }, "-fecha")
  // que era completamente incorrecto (llamaba el query builder como función)
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["registros-labor", laborId],
    queryFn: async () => {
      const { data, error } = await reports.filter({ labor_id: laborId }, "-fecha");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!laborId,
  });

  const seccionMap = useMemo(() => {
    const m = {};
    secciones.forEach((s) => { m[s.id] = s; });
    return m;
  }, [secciones]);

  const matrizAcres = useMemo(() => {
    const m = {};
    registros.forEach((r) => {
      const key = `${r.seccion_id}_${r.ciclo}`;
      m[key] = (m[key] || 0) + (r.acres || 0);
    });
    return m;
  }, [registros]);

  const totalPorCiclo = useMemo(() => {
    const t = {};
    CICLOS.forEach((c) => {
      t[c] = secciones.reduce((sum, s) => sum + (matrizAcres[`${s.id}_${c}`] || 0), 0);
    });
    return t;
  }, [matrizAcres, secciones]);

  const seccionesActivas = useMemo(() => {
    const excluidas = labor?.secciones_excluidas || [];
    return secciones.filter((s) => !excluidas.includes(s.id));
  }, [secciones, labor?.secciones_excluidas]);

  const totalAcresFinca = seccionesActivas.reduce((s, sec) => s + (sec.acres || 0), 0);
  const seccionesTabla = seccionesActivas;

  // Total general de racimos (todos los ciclos). Solo se usa para Embolse,
  // como equivalente del "TOTAL (acres)" que ya muestran las demás labores.
  const totalRacimosGeneral = useMemo(
    () => Object.values(totalPorCiclo).reduce((sum, v) => sum + v, 0),
    [totalPorCiclo]
  );

  const minifincaStats = useMemo(() => {
    const mf = {};
    secciones.forEach((s) => {
      if (!s.minifinca) return;
      if (!mf[s.minifinca]) mf[s.minifinca] = { totalAcres: 0, seccionIds: [] };
      mf[s.minifinca].totalAcres += s.acres || 0;
      mf[s.minifinca].seccionIds.push(s.id);
    });
    return mf;
  }, [secciones]);

  const sinSecciones = seccionesActivas.length === 0;

  const handleSave = async () => {
    if (!entry.fecha || (!sinSecciones && !entry.seccion_id) || !entry.ciclo || !entry.acres_realizados) return;
    setSaving(true);
    const sec = sinSecciones ? null : seccionMap[entry.seccion_id];
    const valorIngresado = parseFloat(entry.acres_realizados);
    const payload = {
      labor_id: laborId,
      labor_nombre: labor?.nombre || "",
      fecha: entry.fecha,
      semana: getWeek(entry.fecha),
      // FIXED: seccion_id es columna UUID en Supabase — usar null (no un string literal) cuando no hay secciones
      seccion_id: sinSecciones ? null : entry.seccion_id,
      seccion_nombre: sinSecciones ? "" : (sec?.nombre || ""),
      acres: valorIngresado,
      minifinca: sinSecciones ? "" : (sec?.minifinca || ""),
      ciclo: parseInt(entry.ciclo),
    };
    if ((labor?.unidad_extra && !isEmbolse) && entry.unidad_extra_valor) {
      payload.unidad_extra_valor = parseFloat(entry.unidad_extra_valor);
      payload.unidad_extra_tipo = labor.unidad_extra;
    }
    // FIXED: usar reports.create (insert + .select()) y SIEMPRE destructurar { error } —
    // antes el insert no comprobaba error, así que si Supabase/RLS rechazaba el
    // registro, el formulario igual se limpiaba y sonaba "éxito" sin haber guardado nada.
    const { error } = await reports.create(payload);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      setSaving(false);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["registros-labor", laborId] });
    playSuccessSound();
    setEntry({ fecha: entry.fecha, seccion_id: "", ciclo: "", acres_realizados: "", unidad_extra_valor: "" });
    setSaving(false);
    setTimeout(() => seccionRef?.current?.focus(), 50);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    // FIXED: comprobar { error } de reports.delete antes de invalidar la query
    const { error } = await reports.delete(id);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
      setDeletingId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["registros-labor", laborId] });
    setDeletingId(null);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditRow({
      fecha: r.fecha,
      seccion_id: r.seccion_id,
      ciclo: String(r.ciclo),
      acres: String(r.acres),
      unidad_extra_valor: r.unidad_extra_valor != null ? String(r.unidad_extra_valor) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRow({});
  };

  const handleUpdate = async (r) => {
    setUpdatingId(r.id);
    const sec = seccionMap[editRow.seccion_id] || { nombre: r.seccion_nombre, minifinca: r.minifinca };
    const acresVal = parseFloat(editRow.acres);
    const payload = {
      fecha: editRow.fecha,
      semana: getWeek(editRow.fecha),
      seccion_id: editRow.seccion_id,
      seccion_nombre: sec.nombre,
      minifinca: sec.minifinca || "",
      acres: acresVal,
      ciclo: parseInt(editRow.ciclo),
    };
    if ((labor?.unidad_extra && !isEmbolse)) {
      payload.unidad_extra_valor = editRow.unidad_extra_valor ? parseFloat(editRow.unidad_extra_valor) : null;
      payload.unidad_extra_tipo = labor.unidad_extra;
    }
    // FIXED: comprobar { error } de reports.update antes de invalidar la query
    const { error } = await reports.update(r.id, payload);
    if (error) {
      toast.error(`Error al actualizar: ${error.message}`);
      setUpdatingId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["registros-labor", laborId] });
    setEditingId(null);
    setEditRow({});
    setUpdatingId(null);
  };

  const openHistorialModal = (seccionId, ciclo) => {
    setModalSeccionId(seccionId);
    setModalCiclo(ciclo);
    setModalOpen(true);
  };

  const historialRegistros = useMemo(() => {
    if (!modalSeccionId || !modalCiclo) return [];
    return registros.filter((r) => r.seccion_id === modalSeccionId && r.ciclo === modalCiclo);
  }, [registros, modalSeccionId, modalCiclo]);

  if (!isAdmin) {
    return <AdminOnlyMessage />;
  }

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{labor?.nombre || "Labor"}</h1>
          <p className="text-muted-foreground text-sm">Registro de avances por sección y ciclo</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* ---- IZQUIERDA: Formulario + historial ---- */}
        <div className="xl:w-1/2 flex-shrink-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Nuevo Registro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
               <div className="space-y-1">
                 <Label className="text-xs">Fecha</Label>
                 <Input
                   ref={fechaRef}
                   type="date"
                   value={entry.fecha}
                   onChange={(e) => setEntry({ ...entry, fecha: e.target.value })}
                   onKeyDown={(e) => { if (e.key === "Enter") focusNext(seccionRef); }}
                 />
               </div>
               {entry.fecha && (
                 <div className="flex items-end pb-1">
                   <span className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-2 py-1.5 w-full text-center">
                     Sem. <strong>{getWeek(entry.fecha)}</strong>
                   </span>
                 </div>
               )}
              </div>

              {!sinSecciones && (
                <div className="space-y-1">
                  <Label className="text-xs">Sección</Label>
                  <select
                    ref={seccionRef}
                    value={entry.seccion_id}
                    onChange={(e) => setEntry({ ...entry, seccion_id: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") focusNext(acresRef); }}
                    className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-0.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Seleccionar sección</option>
                    {seccionesActivas.map((s) => (
                      <option key={s.id} value={s.id}>{s.nombre}{s.minifinca ? ` — ${s.minifinca}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                 <Label className="text-xs">{isEmbolse ? "Racimos Embolsados" : "Acres Realizados"}</Label>
                 <Input
                   ref={acresRef}
                   type="number"
                   min="0"
                   step={isEmbolse ? "1" : "0.01"}
                   placeholder={isEmbolse ? "Ej: 500" : "Ej: 2.5"}
                  value={entry.acres_realizados}
                  onChange={(e) => setEntry({ ...entry, acres_realizados: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if ((labor?.unidad_extra && !isEmbolse)) {
                        setTimeout(() => document.querySelector('input[placeholder="Ej: 10"]')?.focus(), 50);
                      } else {
                        focusNext(cicloRef);
                      }
                    }
                  }}
                />
              </div>

              {(labor?.unidad_extra && !isEmbolse) && (
                <div className="space-y-1">
                  <Label className="text-xs capitalize">{labor.unidad_extra}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 10"
                    value={entry.unidad_extra_valor}
                    onChange={(e) => setEntry({ ...entry, unidad_extra_valor: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") focusNext(cicloRef); }}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">No. de Ciclo</Label>
                <select
                ref={cicloRef}
                value={entry.ciclo}
                onChange={(e) => setEntry({ ...entry, ciclo: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") focusNext(btnRef); }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                <option value="">Seleccionar ciclo</option>
                {CICLOS.length > 0 ? CICLOS.map((c) => (
                  <option key={c} value={String(c)}>Ciclo {c}</option>
                )) : <option disabled>Cargando ciclos...</option>}
                </select>
              </div>

              <Button
                  ref={btnRef}
                  onClick={handleSave}
                  disabled={saving || !entry.fecha || (!sinSecciones && !entry.seccion_id) || !entry.ciclo || !entry.acres_realizados}
                className="w-full"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              >
                <Plus className="w-4 h-4" />
                {saving ? "Guardando..." : "Agregar Registro"}
              </Button>
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Historial ({registros.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
              ) : registros.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin registros aún.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Fecha</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Sección</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Minifinca</th>
                        <th className="px-2 py-1.5 text-center font-semibold">C.</th>
                        <th className="px-2 py-1.5 text-center font-semibold">{isEmbolse ? "Racimos" : "Acres"}</th>
                        {(labor?.unidad_extra && !isEmbolse) && (
                          <th className="px-2 py-1.5 text-center font-semibold capitalize">{labor.unidad_extra}</th>
                        )}
                        <th className="px-1 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((r, idx) => {
                        const isEditing = editingId === r.id;
                        return (
                          <tr key={r.id} className={`border-b border-border/50 ${idx % 2 === 0 ? "bg-muted/10" : ""} ${isEditing ? "bg-yellow-50" : ""}`}>
                            {isEditing ? (
                              <>
                                <td className="px-1 py-1">
                                  <Input type="date" value={editRow.fecha}
                                    onChange={(e) => setEditRow({ ...editRow, fecha: e.target.value })}
                                    className="h-7 text-xs px-1" />
                                </td>
                                <td className="px-1 py-1">
                                  <select
                                    value={editRow.seccion_id}
                                    onChange={(e) => setEditRow({ ...editRow, seccion_id: e.target.value })}
                                    className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs"
                                  >
                                    {seccionesActivas.map((s) => (
                                      <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-1 py-1 text-muted-foreground text-xs">
                                  {seccionMap[editRow.seccion_id]?.minifinca || r.minifinca}
                                </td>
                                <td className="px-1 py-1">
                                  <select
                                    value={editRow.ciclo}
                                    onChange={(e) => setEditRow({ ...editRow, ciclo: e.target.value })}
                                    className="h-7 w-12 rounded border border-input bg-transparent px-1 text-xs"
                                  >
                                    {CICLOS.map((c) => (
                                      <option key={c} value={String(c)}>{c}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-1 py-1">
                                  <Input type="number" min="0" step="0.01" value={editRow.acres}
                                    onChange={(e) => setEditRow({ ...editRow, acres: e.target.value })}
                                    className="h-7 text-xs px-1 w-16" />
                                </td>
                                {(labor?.unidad_extra && !isEmbolse) && (
                                  <td className="px-1 py-1">
                                    <Input type="number" min="0" step="0.01" value={editRow.unidad_extra_valor}
                                      onChange={(e) => setEditRow({ ...editRow, unidad_extra_valor: e.target.value })}
                                      className="h-7 text-xs px-1 w-16" />
                                  </td>
                                )}
                                <td className="px-1 py-1">
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon"
                                      className="text-green-600 hover:bg-green-100 h-6 w-6"
                                      onClick={() => handleUpdate(r)}
                                      disabled={updatingId === r.id}>
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon"
                                      className="text-muted-foreground hover:bg-muted h-6 w-6"
                                      onClick={cancelEdit}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-1.5 whitespace-nowrap">{r.fecha}</td>
                                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.seccion_nombre}</td>
                                <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.minifinca || "—"}</td>
                                <td className="px-2 py-1.5 text-center">{r.ciclo}</td>
                                <td className="px-2 py-1.5 text-center">{isEmbolse ? Math.round(r.acres).toLocaleString() : r.acres}</td>
                                {(labor?.unidad_extra && !isEmbolse) && (
                                  <td className="px-2 py-1.5 text-center">
                                    {r.unidad_extra_valor != null ? r.unidad_extra_valor : <span className="text-muted-foreground/40">—</span>}
                                  </td>
                                )}
                                <td className="px-1 py-1">
                                  <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon"
                                      className="text-primary hover:bg-primary/10 h-6 w-6"
                                      onClick={() => startEdit(r)}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon"
                                      className="text-destructive hover:bg-destructive/10 h-6 w-6"
                                      onClick={() => handleDelete(r.id)}
                                      disabled={deletingId === r.id}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---- DERECHA: Tabla resumen ---- */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                {sinSecciones
                  ? "Total por Ciclo"
                  : isEmbolse ? "Racimos Embolsados por Sección y Ciclo" : "Avance por Sección y Ciclo (Acres)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {sinSecciones ? (
                <table className="w-full border-collapse" style={{ fontSize: "11px" }}>
                  <thead>
                    <tr className="bg-green-900/20">
                      <th className="border border-border px-2 py-1.5 text-left font-semibold">Ciclo</th>
                      <th className="border border-border px-2 py-1.5 text-center font-semibold">
                        {isEmbolse ? "Racimos" : "Acres"}
                      </th>
                      {(labor?.unidad_extra && !isEmbolse) && (
                        <th className="border border-border px-2 py-1.5 text-center font-semibold capitalize">{labor.unidad_extra}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {CICLOS.map((c, idx) => {
                      const total = registros.filter((r) => r.ciclo === c).reduce((sum, r) => sum + (r.acres || 0), 0);
                      const totalExtra = (labor?.unidad_extra && !isEmbolse)
                        ? registros.filter((r) => r.ciclo === c).reduce((sum, r) => sum + (r.unidad_extra_valor || 0), 0)
                        : null;
                      return (
                        <tr key={c} className={idx % 2 === 0 ? "bg-muted/10" : ""}>
                          <td className="border border-border px-2 py-1 font-medium">Ciclo {c}</td>
                          <td className={`border border-border px-2 py-1 text-center ${total > 0 ? "bg-green-500/15 font-semibold text-green-700" : "text-muted-foreground/30"}`}>
                            {total > 0 ? (isEmbolse ? Math.round(total).toLocaleString() : total.toFixed(2)) : "—"}
                          </td>
                          {(labor?.unidad_extra && !isEmbolse) && (
                            <td className={`border border-border px-2 py-1 text-center ${totalExtra > 0 ? "font-semibold text-primary" : "text-muted-foreground/30"}`}>
                              {totalExtra > 0 ? totalExtra.toFixed(2) : "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/10 font-bold">
                      <td className="border border-border px-2 py-1 font-bold">TOTAL</td>
                      <td className="border border-border px-2 py-1 text-center text-primary">
                        {(() => {
                          const t = registros.reduce((sum, r) => sum + (r.acres || 0), 0);
                          return t > 0 ? (isEmbolse ? Math.round(t).toLocaleString() : t.toFixed(2)) : "—";
                        })()}
                      </td>
                      {(labor?.unidad_extra && !isEmbolse) && (
                        <td className="border border-border px-2 py-1 text-center text-primary">
                          {(() => {
                            const t = registros.reduce((sum, r) => sum + (r.unidad_extra_valor || 0), 0);
                            return t > 0 ? t.toFixed(2) : "—";
                          })()}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse" style={{ fontSize: "10px" }}>
                  <thead>
                    <tr className="bg-green-900/20">
                      <th className="border border-border px-0.5 py-1 text-left font-semibold w-20">
                        {isEmbolse ? "Sección" : "Secc./Ac."}
                      </th>
                      {CICLOS.map((c) => {
                        const pct = !isEmbolse && totalAcresFinca > 0
                          ? ((totalPorCiclo[c] / totalAcresFinca) * 100).toFixed(1)
                          : null;
                        return (
                          <th key={c} className="border border-border px-1.5 py-0.5 text-center w-12">
                            {pct !== null && <div className="font-bold text-primary leading-tight">{pct}%</div>}
                            <div className="text-muted-foreground font-normal leading-tight">C{c}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {seccionesTabla.map((s, idx) => (
                      <tr key={s.id} className={idx % 2 === 0 ? "bg-muted/10" : ""}>
                        <td className="border border-border px-0.5 py-0.5 font-medium text-xs leading-tight w-20">
                          <div>{s.nombre}</div>
                          {!isEmbolse && <div className="text-muted-foreground text-xs">{s.acres} ac</div>}
                        </td>
                        {CICLOS.map((c) => {
                          const val = matrizAcres[`${s.id}_${c}`] || 0;
                          // Tolerancia para evitar falsos positivos por precisión de punto flotante al sumar decimales (ej. 6.7+4.9=11.600000000000001)
                          const isOverLimit = !isEmbolse && val > s.acres + 0.01;
                          if (isEmbolse) {
                            return (
                              <td key={c}
                                className={`border border-border px-1.5 py-0.5 text-center cursor-pointer hover:opacity-75 transition-opacity w-12 ${val > 0 ? "bg-blue-100 font-semibold text-blue-800" : "text-muted-foreground/30"}`}
                                onDoubleClick={() => openHistorialModal(s.id, c)}>
                                {val > 0 ? Math.round(val).toLocaleString() : "—"}
                              </td>
                            );
                          }
                          return (
                            <td key={c}
                              className={`border border-border px-1.5 py-0.5 text-center cursor-pointer hover:opacity-75 transition-opacity w-12 ${val > 0 ? (isOverLimit ? "bg-red-500/15 font-semibold text-red-700" : "bg-green-500/15 font-semibold text-green-700") : "text-muted-foreground/30"}`}
                              onDoubleClick={() => openHistorialModal(s.id, c)}>
                              {val > 0 ? val.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-bold">
                      <td className="border border-border px-1 py-0.5 font-bold">
                        {isEmbolse
                          ? `TOTAL (${Math.round(totalRacimosGeneral).toLocaleString()})`
                          : `TOTAL (${totalAcresFinca.toFixed(1)})`}
                      </td>
                      {CICLOS.map((c) => (
                        <td key={c} className="border border-border px-0.5 py-0.5 text-center text-primary">
                          {totalPorCiclo[c] > 0
                            ? isEmbolse
                              ? Math.round(totalPorCiclo[c]).toLocaleString()
                              : totalPorCiclo[c].toFixed(1)
                            : "—"}
                        </td>
                      ))}
                    </tr>
                    {/* Desglose por minifinca: antes solo se mostraba para labores
                        que avanzan por acres (% sobre acres de la minifinca). Para
                        Embolse esa tabla quedaba "incompleta" (sin estas filas) por
                        el guard !isEmbolse; ahora se muestra también, pero con el
                        total de racimos de cada minifinca en vez de un porcentaje,
                        ya que racimos no tiene un acres-objetivo contra qué medirse. */}
                    {Object.entries(minifincaStats).map(([mfNombre, { totalAcres, seccionIds }]) => {
                      if (isEmbolse) {
                        const totalRacimosMf = CICLOS.reduce(
                          (sum, c) => sum + seccionIds.reduce((s2, sid) => s2 + (matrizAcres[`${sid}_${c}`] || 0), 0),
                          0
                        );
                        return (
                          <tr key={mfNombre} className="bg-secondary/10">
                            <td className="border border-border px-0.5 py-0.5 text-xs font-medium text-muted-foreground leading-tight">
                              <div className="truncate">{mfNombre}</div>
                              <div className="text-xs text-muted-foreground/60">
                                {Math.round(totalRacimosMf).toLocaleString()} rac.
                              </div>
                            </td>
                            {CICLOS.map((c) => {
                              const racimosMf = seccionIds.reduce((sum, sid) => sum + (matrizAcres[`${sid}_${c}`] || 0), 0);
                              return (
                                <td key={c} className="border border-border px-0.5 py-0.5 text-center text-xs">
                                  {racimosMf > 0 ? (
                                    <span className="font-semibold text-blue-700">{Math.round(racimosMf).toLocaleString()}</span>
                                  ) : (
                                    <span className="text-muted-foreground/30">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }
                      return (
                        <tr key={mfNombre} className="bg-secondary/10">
                          <td className="border border-border px-0.5 py-0.5 text-xs font-medium text-muted-foreground leading-tight">
                            <div className="truncate">{mfNombre}</div>
                            <div className="text-xs text-muted-foreground/60">{totalAcres.toFixed(1)} ac</div>
                          </td>
                          {CICLOS.map((c) => {
                            const acresEjecutados = seccionIds.reduce((sum, sid) => sum + (matrizAcres[`${sid}_${c}`] || 0), 0);
                            const pct = totalAcres > 0 ? (acresEjecutados / totalAcres) * 100 : 0;
                            return (
                              <td key={c} className="border border-border px-0.5 py-0.5 text-center text-xs">
                                {pct > 0 ? (
                                  <span className={`font-semibold ${pct >= 100 ? "text-red-600" : pct >= 50 ? "text-primary" : "text-muted-foreground"}`}>
                                    {pct.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Historial */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <Card className="max-w-2xl w-full max-h-96 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Historial - {seccionMap[modalSeccionId]?.nombre} (Ciclo {modalCiclo})</CardTitle>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {historialRegistros.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin registros para esta sección y ciclo.</p>
              ) : (
                <div className="space-y-2">
                  {historialRegistros.map((r) => (
                    <div key={r.id} className="p-3 border border-border rounded-lg bg-muted/30">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {r.fecha} (Sem. {r.semana})
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>{r.acres}</strong> acres
                            {(labor?.unidad_extra && !isEmbolse) && r.unidad_extra_valor && (
                              <span> • {r.unidad_extra_valor} {labor.unidad_extra}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
