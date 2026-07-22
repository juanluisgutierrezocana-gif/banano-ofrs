import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { balanceCuadrilla } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

// Tabla de Balance / Racimos Faltantes por cuadrilla.
// Cada fila tiene botones explícitos Guardar / Editar / Eliminar para evitar
// que los valores se modifiquen solos por sincronización en tiempo real.
// IMPORTANTE: siempre filtra por finca_id para que cada finca
// tenga sus propios balances aislados.
export default function BalanceTable({ trenadas, fecha }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fincaId = user?.finca_id ?? null;

  // Qué fila está en modo edición (cuadrilla number | null)
  const [editingCrew, setEditingCrew] = useState(null);
  // Valor temporal mientras se edita
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  // Cargar balances desde Supabase para la fecha y finca actuales.
  // El queryKey incluye fincaId para que cada finca tenga su propio caché.
  const { data: balancesDB = [] } = useQuery({
    queryKey: ["balance-cuadrilla", fecha, fincaId],
    queryFn: async () => {
      if (!fecha || !fincaId) return [];
      const { data, error } = await balanceCuadrilla.getByFecha(fecha, fincaId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!fecha && !!fincaId,
    // NO refetch en background mientras alguien edita — evita sobreescritura
    refetchOnWindowFocus: false,
  });

  // Mapa cuadrilla → { balance, id }
  const balancesMap = useMemo(() => {
    const m = {};
    balancesDB.forEach(r => { m[r.cuadrilla] = r.balance; });
    return m;
  }, [balancesDB]);

  const crewTotals = useMemo(() => {
    const crews = {};
    trenadas.forEach(t => {
      const c = t.cuadrilla;
      if (!crews[c]) crews[c] = { cuadrilla: c, total: 0 };
      crews[c].total += t.total_racimos || 0;
    });
    return Object.values(crews).sort((a, b) => a.cuadrilla - b.cuadrilla);
  }, [trenadas]);

  const startEdit = (crew) => {
    setEditingCrew(crew.cuadrilla);
    setEditVal(balancesMap[crew.cuadrilla] != null ? String(balancesMap[crew.cuadrilla]) : "");
  };

  const cancelEdit = () => {
    setEditingCrew(null);
    setEditVal("");
  };

  const handleSave = async (crew) => {
    const num = editVal === "" ? null : Number(editVal);
    if (editVal !== "" && isNaN(num)) {
      toast.error("Ingresa un número válido.");
      return;
    }
    setSaving(true);
    const { error } = await balanceCuadrilla.upsert(fecha, crew.cuadrilla, num, fincaId);
    setSaving(false);
    if (error) {
      toast.error("Error al guardar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["balance-cuadrilla", fecha, fincaId] });
    toast.success(`Balance #${crew.cuadrilla} guardado.`);
    cancelEdit();
  };

  const handleDelete = async (crew) => {
    if (!window.confirm(`¿Eliminar balance de cuadrilla #${crew.cuadrilla}?`)) return;
    setSaving(true);
    const { error } = await balanceCuadrilla.upsert(fecha, crew.cuadrilla, null, fincaId);
    setSaving(false);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["balance-cuadrilla", fecha, fincaId] });
    toast.success(`Balance #${crew.cuadrilla} eliminado.`);
  };

  if (!crewTotals.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Balance / Rac. Faltantes</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground"></th>
              <th className="text-center py-2 px-3 font-semibold">Balance</th>
              <th className="text-center py-2 px-3 font-semibold">Rac. Faltantes</th>
              <th className="text-center py-2 px-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {crewTotals.map(crew => {
              const isEditing = editingCrew === crew.cuadrilla;
              const balanceGuardado = balancesMap[crew.cuadrilla];
              const racFaltantes = balanceGuardado != null
                ? balanceGuardado - crew.total
                : "—";

              return (
                <tr key={crew.cuadrilla} className="border-b last:border-0">
                  {/* Label cuadrilla */}
                  <td className="py-1 px-2">
                    <span className="text-xs font-bold text-primary">#{crew.cuadrilla}</span>
                  </td>

                  {/* Balance */}
                  <td className="text-center py-1 px-2">
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        className="w-24 h-7 text-center mx-auto"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSave(crew)}
                        autoFocus
                      />
                    ) : (
                      <span className={balanceGuardado != null ? "font-medium" : "text-muted-foreground/40"}>
                        {balanceGuardado != null ? balanceGuardado : "—"}
                      </span>
                    )}
                  </td>

                  {/* Rac. Faltantes */}
                  <td className="text-center py-1 px-3 font-medium">
                    {isEditing
                      ? (editVal !== "" ? Number(editVal) - crew.total : "—")
                      : racFaltantes}
                  </td>

                  {/* Acciones */}
                  <td className="py-1 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="default"
                            className="h-7 w-7"
                            disabled={saving}
                            onClick={() => handleSave(crew)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => startEdit(crew)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {balanceGuardado != null && (
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7"
                              disabled={saving}
                              onClick={() => handleDelete(crew)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
