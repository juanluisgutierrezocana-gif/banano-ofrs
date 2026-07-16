import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { losses, inventory } from "@/api/supabaseClient";
import { supabase } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportStyledExcel } from "@/utils/excelExport";

// Causas predefinidas (mismo listado que Perdidas.jsx)
const CAUSAS = ["VIENTO", "CAÍDO", "ROBO", "PLAGA", "OTRO"];

export default function ReportePerdidas() {
  const queryClient = useQueryClient();

  // Estado para la fila en edición del historial
  const [editingId, setEditingId] = useState(null);
  const [editVals, setEditVals] = useState({ cantidad: "", no_semana: "", causa: "" });

  // ── Queries ─────────────────────────────────────────────────────────────────

  // Registros individuales de pérdidas (para desglose por semana/causa e historial)
  // Misma queryKey que Perdidas.jsx para compartir caché y recibir invalidaciones.
  const { data: perdidas = [], isLoading } = useQuery({
    queryKey: ["perdidas-detalle"],
    queryFn: async () => {
      const { data, error } = await losses.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  // inventario_embolse: fuente de verdad para el total real de pérdidas.
  // Se usa en la columna Total del pivot para reflejar ediciones manuales con el lápiz.
  const { data: embolses = [] } = useQuery({
    queryKey: ["embolses"],
    queryFn: async () => {
      const { data, error } = await inventory.listEmbolse("-semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Derivaciones ─────────────────────────────────────────────────────────────

  // Mapa embolse_id → total real de pérdidas
  const totalRealPorEmbolse = useMemo(() => {
    const m = {};
    embolses.forEach(e => { m[e.id] = e.perdidas || 0; });
    return m;
  }, [embolses]);

  // Semanas de cosecha únicas (no_semana), ordenadas
  const semanasUnicas = useMemo(() => {
    const s = new Set(perdidas.map(r => r.no_semana).filter(n => n != null));
    return Array.from(s).sort((a, b) => a - b);
  }, [perdidas]);

  // Agrupar por (semana_embolse, color_name) para el pivot
  const grupos = useMemo(() => {
    const mapa = {};
    perdidas.forEach(r => {
      const key = `${r.semana}||${r.color_name || "—"}`;
      if (!mapa[key]) {
        mapa[key] = {
          semana: r.semana,
          color_name: r.color_name || "—",
          embolse_id: r.embolse_id,
          celdas: {},
        };
      }
      const ns = r.no_semana;
      if (ns != null) {
        if (!mapa[key].celdas[ns]) {
          mapa[key].celdas[ns] = { cantidad: 0, causa: r.causa || "" };
        }
        mapa[key].celdas[ns].cantidad += r.cantidad || 0;
        if (r.causa && !mapa[key].celdas[ns].causa.includes(r.causa)) {
          mapa[key].celdas[ns].causa = mapa[key].celdas[ns].causa
            ? `${mapa[key].celdas[ns].causa}, ${r.causa}`
            : r.causa;
        }
      }
    });
    return Object.values(mapa).sort((a, b) => {
      if (b.semana !== a.semana) return b.semana - a.semana;
      return (a.color_name || "").localeCompare(b.color_name || "");
    });
  }, [perdidas]);

  // Totales por semana de cosecha (columnas del pivot)
  const totalesPorSemana = useMemo(() => {
    const t = {};
    perdidas.forEach(r => {
      if (r.no_semana != null) {
        t[r.no_semana] = (t[r.no_semana] || 0) + (r.cantidad || 0);
      }
    });
    return t;
  }, [perdidas]);

  // Total general desde inventario_embolse (fuente de verdad)
  const totalGeneral = grupos.reduce((sum, g) => sum + (totalRealPorEmbolse[g.embolse_id] || 0), 0);

  // Historial ordenado por fecha desc
  const historial = useMemo(() =>
    [...perdidas].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
    [perdidas]
  );

  // ── Handlers historial ────────────────────────────────────────────────────────

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditVals({
      cantidad: String(r.cantidad ?? ""),
      no_semana: r.no_semana != null ? String(r.no_semana) : "",
      causa: r.causa || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVals({ cantidad: "", no_semana: "", causa: "" });
  };

  const saveEdit = async (r) => {
    const nuevaCantidad = parseInt(editVals.cantidad);
    if (isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    const payload = {
      cantidad: nuevaCantidad,
      no_semana: editVals.no_semana ? parseInt(editVals.no_semana) : null,
      causa: editVals.causa || null,
    };

    const { error } = await supabase.from("perdidas").update(payload).eq("id", r.id);
    if (error) {
      toast.error(`Error al actualizar: ${error.message}`);
      return;
    }

    // Recalcular total en inventario_embolse sumando todos los registros del embolse
    const registrosEmbolse = perdidas.map(p =>
      p.id === r.id ? { ...p, cantidad: nuevaCantidad } : p
    ).filter(p => p.embolse_id === r.embolse_id);
    const nuevoTotal = registrosEmbolse.reduce((s, p) => s + (p.cantidad || 0), 0);
    const emb = embolses.find(e => e.id === r.embolse_id);
    if (emb) {
      const nuevoSaldo = emb.total - (emb.cosechado || 0) - nuevoTotal;
      await inventory.updateEmbolse(r.embolse_id, { perdidas: nuevoTotal, saldo: nuevoSaldo });
    }

    queryClient.refetchQueries({ queryKey: ["perdidas-detalle"] });
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    toast.success("Registro actualizado.");
    cancelEdit();
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`¿Eliminar pérdida de ${r.cantidad} del ${r.fecha}?`)) return;

    const { error } = await supabase.from("perdidas").delete().eq("id", r.id);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
      return;
    }

    // Recalcular total en inventario_embolse descontando el registro eliminado
    const registrosRestantes = perdidas.filter(p => p.embolse_id === r.embolse_id && p.id !== r.id);
    const nuevoTotal = registrosRestantes.reduce((s, p) => s + (p.cantidad || 0), 0);
    const emb = embolses.find(e => e.id === r.embolse_id);
    if (emb) {
      const nuevoSaldo = emb.total - (emb.cosechado || 0) - nuevoTotal;
      await inventory.updateEmbolse(r.embolse_id, { perdidas: nuevoTotal, saldo: nuevoSaldo });
    }

    queryClient.refetchQueries({ queryKey: ["perdidas-detalle"] });
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    toast.success("Registro eliminado.");
  };

  // ── Export Excel ─────────────────────────────────────────────────────────────

  const handleExport = () => {
    const encSem = semanasUnicas.flatMap(s => [`SEM ${s}`, "CAUSA"]);
    const headers = ["Sem. Embolse", "Color", ...encSem, "Total"];

    const rows = grupos.map(g => {
      const semCols = semanasUnicas.flatMap(s => {
        const c = g.celdas[s];
        return c ? [c.cantidad, c.causa || "—"] : ["", ""];
      });
      const totalFila = totalRealPorEmbolse[g.embolse_id] ?? 0;
      return [`S${g.semana}`, g.color_name, ...semCols, totalFila];
    });

    const totalsRow = [
      "TOTAL", "",
      ...semanasUnicas.flatMap(s => [totalesPorSemana[s] || 0, ""]),
      totalGeneral,
    ];

    exportStyledExcel({
      title: "Reporte de Pérdidas",
      headers,
      rows,
      totalsRow,
      sheetName: "Pérdidas",
      fileName: `reporte-perdidas-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Tabla pivot ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle className="font-heading">Reporte de Pérdidas</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!perdidas.length}
            >
              <Download className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : !perdidas.length ? (
            <p className="text-center text-muted-foreground py-8">No hay registros de pérdidas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/80 sticky top-0 z-10">
                    <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">Sem. Embolse</th>
                    <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">Color</th>
                    {semanasUnicas.map(s => (
                      <React.Fragment key={s}>
                        <th className="py-2 px-2 text-center font-semibold border border-border whitespace-nowrap bg-destructive/10 text-destructive">SEM {s}</th>
                        <th className="py-2 px-2 text-center font-semibold border border-border whitespace-nowrap text-muted-foreground">CAUSA</th>
                      </React.Fragment>
                    ))}
                    <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap text-destructive">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, idx) => {
                    const totalFila = totalRealPorEmbolse[g.embolse_id] ?? 0;
                    return (
                      <tr
                        key={`${g.semana}-${g.color_name}`}
                        className={`border-b ${idx % 2 === 0 ? "bg-muted/20" : "bg-background"} hover:bg-muted/40 transition-colors`}
                      >
                        <td className="py-2 px-3 font-semibold border border-border whitespace-nowrap">S{g.semana}</td>
                        <td className="py-2 px-3 border border-border whitespace-nowrap">{g.color_name}</td>
                        {semanasUnicas.map(s => {
                          const celda = g.celdas[s];
                          return (
                            <React.Fragment key={s}>
                              <td className="py-2 px-2 text-center border border-border">
                                {celda
                                  ? <span className="font-semibold text-destructive">{celda.cantidad}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </td>
                              <td className="py-2 px-2 text-center border border-border text-muted-foreground text-xs">
                                {celda?.causa || ""}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="py-2 px-3 text-center border border-border font-bold text-destructive">
                          {totalFila > 0 ? totalFila : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-destructive/10 font-bold border-t-2 border-destructive/30">
                    <td className="py-2 px-3 border border-border font-bold" colSpan={2}>TOTAL</td>
                    {semanasUnicas.map(s => (
                      <React.Fragment key={s}>
                        <td className="py-2 px-2 text-center border border-border font-bold text-destructive">{totalesPorSemana[s] || 0}</td>
                        <td className="py-2 px-2 border border-border" />
                      </React.Fragment>
                    ))}
                    <td className="py-2 px-3 text-center border border-border font-bold text-destructive">{totalGeneral}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Historial de registros individuales ── */}
      {historial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Historial de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/80">
                    <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">Fecha</th>
                    <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">Sem. Embolse</th>
                    <th className="py-2 px-3 text-left font-semibold border border-border whitespace-nowrap">Color</th>
                    <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap text-destructive">Cantidad</th>
                    <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap">No. Sem. Cosecha</th>
                    <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap">Causa</th>
                    <th className="py-2 px-3 text-center font-semibold border border-border whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((r, idx) => {
                    const isEditing = editingId === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b ${idx % 2 === 0 ? "bg-muted/20" : "bg-background"} hover:bg-muted/40 transition-colors`}
                      >
                        <td className="py-2 px-3 border border-border whitespace-nowrap">{r.fecha || "—"}</td>
                        <td className="py-2 px-3 font-semibold border border-border whitespace-nowrap">S{r.semana}</td>
                        <td className="py-2 px-3 border border-border whitespace-nowrap">{r.color_name || "—"}</td>

                        {/* Cantidad */}
                        <td className="py-1 px-2 text-center border border-border">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              className="w-16 h-7 text-center mx-auto"
                              value={editVals.cantidad}
                              onChange={e => setEditVals(v => ({ ...v, cantidad: e.target.value }))}
                              autoFocus
                            />
                          ) : (
                            <span className="font-semibold text-destructive">{r.cantidad}</span>
                          )}
                        </td>

                        {/* No. Semana cosecha */}
                        <td className="py-1 px-2 text-center border border-border">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              max="53"
                              className="w-16 h-7 text-center mx-auto"
                              value={editVals.no_semana}
                              onChange={e => setEditVals(v => ({ ...v, no_semana: e.target.value }))}
                            />
                          ) : (
                            r.no_semana ?? <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>

                        {/* Causa */}
                        <td className="py-1 px-2 text-center border border-border">
                          {isEditing ? (
                            <Select
                              value={editVals.causa || "__none__"}
                              onValueChange={val => setEditVals(v => ({ ...v, causa: val === "__none__" ? "" : val }))}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs mx-auto">
                                <SelectValue placeholder="Causa" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin causa</SelectItem>
                                {CAUSAS.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            r.causa || <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-1 px-2 text-center border border-border">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <Button size="icon" variant="default" className="h-7 w-7" onClick={() => saveEdit(r)}>
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={cancelEdit}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => startEdit(r)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDelete(r)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
