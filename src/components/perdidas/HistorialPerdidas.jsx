import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function HistorialPerdidas({ embolses }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const { data: perdidas = [], isLoading } = useQuery({
    queryKey: ["perdidas-historial"],
    queryFn: () => losses.list("-fecha"),
  });

  // Mapa de embolse por id para recalcular saldo
  const embolseMap = Object.fromEntries((embolses || []).map(e => [e.id, e]));

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditVal(String(p.cantidad));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVal("");
  };

  const saveEdit = async (p) => {
    const newCant = parseInt(editVal);
    if (!newCant || newCant < 0) { cancelEdit(); return; }
    const diff = newCant - p.cantidad;
    await losses.update(p.id, { cantidad: newCant });

    // Recalcular saldo del embolse
    const emb = embolseMap[p.embolse_id];
    if (emb) {
      const newPerdidas = (emb.perdidas || 0) + diff;
      const newSaldo = emb.total - (emb.cosechado || 0) - newPerdidas;
      await inventory.updateEmbolse(emb.id, { perdidas: newPerdidas, saldo: newSaldo });
    }

    queryClient.invalidateQueries({ queryKey: ["perdidas-historial"] });
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    toast.success("Pérdida actualizada");
    cancelEdit();
  };

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar pérdida de ${p.cantidad} (${p.color_name} S${p.semana})?`)) return;
    await losses.delete(p.id);

    // Revertir en embolse
    const emb = embolseMap[p.embolse_id];
    if (emb) {
      const newPerdidas = Math.max(0, (emb.perdidas || 0) - p.cantidad);
      const newSaldo = emb.total - (emb.cosechado || 0) - newPerdidas;
      await inventory.updateEmbolse(emb.id, { perdidas: newPerdidas, saldo: newSaldo });
    }

    queryClient.invalidateQueries({ queryKey: ["perdidas-historial"] });
    queryClient.invalidateQueries({ queryKey: ["embolses"] });
    toast.success("Pérdida eliminada");
  };

  if (isLoading) return <p className="text-muted-foreground text-sm py-4">Cargando historial...</p>;
  if (!perdidas.length) return <p className="text-muted-foreground text-sm py-4">Sin historial de pérdidas.</p>;

  return (
    <div className="rounded-xl border shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b">
              <th className="py-3 px-4 text-left font-semibold">Fecha</th>
              <th className="py-3 px-4 text-left font-semibold">Semana / Color</th>
              <th className="py-3 px-4 text-center font-semibold text-destructive">Cantidad</th>
              <th className="py-3 px-4 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {perdidas.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/40">
                <td className="py-2 px-4 text-muted-foreground">
                  {p.fecha ? format(new Date(p.fecha), "dd/MM/yyyy") : "—"}
                </td>
                <td className="py-2 px-4 font-medium">
                  S{p.semana} — {p.color_name}
                </td>
                <td className="py-2 px-4 text-center">
                  {editingId === p.id ? (
                    <Input
                      type="number"
                      min="1"
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      className="w-20 h-7 text-center mx-auto"
                      autoFocus
                      onKeyDown={e => e.key === "Enter" && saveEdit(p)}
                    />
                  ) : (
                    <span className="text-destructive font-semibold">{p.cantidad}</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2 justify-center">
                    {editingId === p.id ? (
                      <>
                        <Button size="icon" variant="default" className="h-7 w-7" onClick={() => saveEdit(p)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => startEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDelete(p)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}