import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, ShieldOff, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { useQueryClient } from "@tanstack/react-query";

function pct(num, total) {
  if (!total) return 0;
  return Math.round((num / total) * 100);
}

export default function Perdidas() {
  const { isViewer } = useRole();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const { data: embolses = [], isLoading } = useQuery({
    queryKey: ["embolses"],
    queryFn: async () => {
      const { data, error } = await inventory.listEmbolse("-semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sorted = useMemo(() =>
    [...embolses].sort((a, b) => b.semana - a.semana),
    [embolses]
  );

  const getSaldo = (e) => e.saldo ?? (e.total - (e.cosechado || 0) - (e.perdidas || 0));

  const handleSave = async (emb) => {
    const cant = parseInt(inputs[emb.id] || "0");
    if (!cant || cant <= 0) return;
    setSaving(s => ({ ...s, [emb.id]: true }));

    // FIXED: la columna real en la tabla "perdidas" es "embolse_id"
    // (confirmado en vivo vía information_schema.columns: id, semana,
    // color_id, total_embolse, cantidad_perdida, porcentaje_perdida,
    // razon_perdida, observaciones, created_at, updated_at, created_by,
    // fecha, color_name, cantidad, notas, embolse_id). Un fix anterior la
    // había cambiado por error a "embolso_id", columna que no existe, lo
    // que provocaba un 400 en el insert. Con { error } ya destructurado
    // ahora sí se ve el fallo en vez de quedar silencioso.
    const { error: lossError } = await losses.create({
      embolse_id: emb.id,
      semana: emb.semana,
      color_name: emb.color_name,
      cantidad: cant,
      fecha: format(new Date(), "yyyy-MM-dd"),
    });
    if (lossError) {
      setSaving(s => ({ ...s, [emb.id]: false }));
      toast.error(`Error al registrar pérdida: ${lossError.message}`);
      return;
    }

    const newPerdidas = (emb.perdidas || 0) + cant;
    const newSaldo = emb.total - (emb.cosechado || 0) - newPerdidas;
    const { error: updateError } = await inventory.updateEmbolse(emb.id, { perdidas: newPerdidas, saldo: newSaldo });
    if (updateError) {
      setSaving(s => ({ ...s, [emb.id]: false }));
      toast.error(`Error al actualizar inventario: ${updateError.message}`);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    setInputs(s => ({ ...s, [emb.id]: "" }));
    setSaving(s => ({ ...s, [emb.id]: false }));
    toast.success(`Pérdida de ${cant} registrada para S${emb.semana} - ${emb.color_name}`);
  };

  const startEdit = (emb) => {
    setEditingId(emb.id);
    setEditVal(String(emb.perdidas || 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVal("");
  };

  const saveEdit = async (emb) => {
    const newPerdidas = parseInt(editVal);
    if (isNaN(newPerdidas) || newPerdidas < 0) { cancelEdit(); return; }
    const newSaldo = emb.total - (emb.cosechado || 0) - newPerdidas;
    // FIXED: no destructuraba { error } — un fallo (ej. RLS) se ignoraba en
    // silencio y el toast de éxito se disparaba igual sin haber guardado nada.
    const { error } = await inventory.updateEmbolse(emb.id, { perdidas: newPerdidas, saldo: newSaldo });
    if (error) {
      toast.error(`Error al actualizar pérdidas: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    toast.success(`Total pérdidas actualizado a ${newPerdidas} para S${emb.semana} - ${emb.color_name}`);
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-heading font-bold">Pérdidas</h1>

      {isViewer && (
        <div className="flex items-center gap-3 p-4 bg-muted rounded-xl text-muted-foreground text-sm">
          <ShieldOff className="w-5 h-5 opacity-60" />
          Modo solo lectura — no tienes permiso para registrar pérdidas.
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Cargando...</p>
      ) : !embolses.length ? (
        <p className="text-center text-muted-foreground py-12">No hay embolses registrados</p>
      ) : (
        <div className="rounded-xl border shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="py-3 px-4 text-left font-semibold min-w-[140px] sticky left-0 bg-muted z-10">Semana / Color</th>
                  <th className="py-3 px-4 text-center font-semibold">Total Embolse</th>
                  <th className="py-3 px-4 text-center font-semibold text-green-700">Cosechado</th>
                  <th className="py-3 px-4 text-center font-semibold text-destructive">Total Pérdidas</th>
                  <th className="py-3 px-4 text-center font-semibold text-primary">Saldo</th>
                  {!isViewer && <th className="py-3 px-4 text-center font-semibold text-destructive">Registrar / Editar Pérdida</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const saldo = getSaldo(e);
                  const cos = e.cosechado || 0;
                  const per = e.perdidas || 0;
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className="border-b hover:bg-muted/40">
                      <td className="py-0 px-0 font-semibold sticky left-0 z-10 bg-card">
                        <div className="flex items-center h-full">
                          <div
                            className="shrink-0"
                            style={{ backgroundColor: e.color_hex, width: 8, alignSelf: "stretch" }}
                          />
                          <div className="flex items-center gap-2 px-3 py-2">
                            <span
                              className="inline-block w-3 h-3 rounded-full border border-black/10"
                              style={{ backgroundColor: e.color_hex }}
                            />
                            <span>S{e.semana} — {e.color_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center">{e.total}</td>
                      <td className="py-2 px-4 text-center">
                        <span className="text-green-700 font-medium">{cos}</span>
                        <span className="text-xs text-muted-foreground ml-1">({pct(cos, e.total)}%)</span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editVal}
                            onChange={ev => setEditVal(ev.target.value)}
                            className="w-20 h-7 text-center mx-auto"
                            autoFocus
                            onKeyDown={ev => ev.key === "Enter" && saveEdit(e)}
                          />
                        ) : (
                          <>
                            <span className="text-destructive font-semibold">{per}</span>
                            <span className="text-xs text-muted-foreground ml-1">({pct(per, e.total)}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center font-bold text-primary">
                        {saldo}
                        <span className="text-xs text-muted-foreground font-normal ml-1">({pct(saldo, e.total)}%)</span>
                      </td>
                      {!isViewer && (
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2 justify-center">
                            {isEditing ? (
                              <>
                                <Button size="icon" variant="default" className="h-8 w-8" onClick={() => saveEdit(e)}>
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={cancelEdit}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="0"
                                  className="w-20 h-8 text-center"
                                  value={inputs[e.id] || ""}
                                  onChange={ev => setInputs(s => ({ ...s, [e.id]: ev.target.value }))}
                                  onKeyDown={ev => ev.key === "Enter" && handleSave(e)}
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 px-2"
                                  disabled={!inputs[e.id] || saving[e.id]}
                                  onClick={() => handleSave(e)}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() => startEdit(e)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}