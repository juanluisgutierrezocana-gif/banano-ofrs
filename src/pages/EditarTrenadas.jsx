import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Pencil, Save, X, History, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";

export default function EditarTrenadas() {
  const { isViewer } = useRole();
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // Contador de ediciones por día guardado en localStorage
  const editCountKey = `edits_${fecha}`;
  const [editCount, setEditCount] = useState(() => parseInt(localStorage.getItem(editCountKey) || "0"));

  // Actualiza contador cuando cambia la fecha
  React.useEffect(() => {
    setEditCount(parseInt(localStorage.getItem(`edits_${fecha}`) || "0"));
  }, [fecha]);

  const { data: trenadaList = [], isLoading } = useQuery({
    queryKey: ["trenadas-edit", fecha],
    queryFn: async () => {
      const { data, error } = await trenadas.filter({ fecha }, "correlativo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // 1. Leer racimos ANTERIORES para revertir su cosechado en inventario
      const { data: old, error: fetchError } = await trenadas.get(id);
      if (fetchError) throw fetchError;

      const { data: embolseList, error: embolseError } = await inventory.list();
      if (embolseError) throw embolseError;

      // 2. Revertir cosechado de los racimos viejos
      if (old?.racimos?.length) {
        await Promise.all(
          old.racimos.map(async r => {
            if (!r.embolse_id || !r.count) return;
            const embolse = (embolseList || []).find(e => e.id === r.embolse_id);
            if (!embolse) return;
            const newCosechado = Math.max(0, (embolse.cosechado || 0) - r.count);
            const newSaldo = embolse.total - newCosechado - (embolse.perdidas || 0);
            await inventory.update(r.embolse_id, { cosechado: newCosechado, saldo: newSaldo });
          })
        );
      }

      // 3. Aplicar cosechado de los racimos NUEVOS (re-fetch para valores ya revertidos)
      const newRacimos = data.racimos || [];
      if (newRacimos.length) {
        const { data: freshEmbolses, error: freshError } = await inventory.list();
        if (freshError) throw freshError;
        await Promise.all(
          newRacimos.map(async r => {
            if (!r.embolse_id || !r.count) return;
            const embolse = (freshEmbolses || []).find(e => e.id === r.embolse_id);
            if (!embolse) return;
            const newCosechado = (embolse.cosechado || 0) + Number(r.count);
            const newSaldo = embolse.total - newCosechado - (embolse.perdidas || 0);
            await inventory.update(r.embolse_id, { cosechado: newCosechado, saldo: newSaldo });
          })
        );
      }

      // 4. Guardar la trenada actualizada
      const { error } = await trenadas.update(id, data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trenadas-edit", fecha] });
      queryClient.invalidateQueries({ queryKey: ["trenadas", fecha] });

      // Incrementar contador de ediciones del día
      const key = `edits_${fecha}`;
      const newCount = (parseInt(localStorage.getItem(key) || "0")) + 1;
      localStorage.setItem(key, String(newCount));
      setEditCount(newCount);

      setEditingId(null);
      setEditData({});
      toast.success("Trenada actualizada correctamente");
    },
    onError: (error) => {
      toast.error(`Error al actualizar trenada: ${error.message}`);
    },
  });

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditData({
      hora: t.hora || "",
      cuadrilla: t.cuadrilla || "",
      conchero: t.conchero || "",
      cortero: t.cortero || "",
      seccion: t.seccion || "",
      linea: t.linea || "",
      racimos: (t.racimos || []).map(r => ({ ...r })),
    });
  };

  const saveEdit = (t) => {
    const racimos = editData.racimos.map(r => ({ ...r, count: Number(r.count) }));
    const total_racimos = racimos.reduce((s, r) => s + r.count, 0);
    const updated = {
      ...editData,
      cuadrilla: Number(editData.cuadrilla),
      racimos,
      total_racimos,
    };
    updateMutation.mutate({ id: t.id, data: updated });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // 1. Obtener la trenada para saber qué racimos revertir
      const { data: t, error: fetchError } = await trenadas.get(id);
      if (fetchError) throw fetchError;

      // 2. Revertir cosechado en cada embolse afectado
      if (t?.racimos?.length) {
        const { data: embolseList, error: embolseError } = await inventory.list();
        if (embolseError) throw embolseError;

        await Promise.all(
          t.racimos.map(async r => {
            if (!r.embolse_id || !r.count) return;
            const embolse = (embolseList || []).find(e => e.id === r.embolse_id);
            if (!embolse) return;
            const newCosechado = Math.max(0, (embolse.cosechado || 0) - r.count);
            const newSaldo = embolse.total - newCosechado - (embolse.perdidas || 0);
            await inventory.update(r.embolse_id, { cosechado: newCosechado, saldo: newSaldo });
          })
        );
      }

      // 3. Borrar la trenada
      const { error } = await trenadas.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trenadas-edit", fecha] });
      queryClient.invalidateQueries({ queryKey: ["trenadas", fecha] });
      queryClient.invalidateQueries({ queryKey: ["embolses"] });
      toast.success("Trenada eliminada");
    },
    onError: (error) => {
      toast.error(`Error al eliminar trenada: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Editar Trenadas</h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {fecha ? format(parseISO(fecha), "EEEE, d 'de' MMMM yyyy", { locale: es }) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-44 h-9"
          />
        </div>
      </div>

      {/* Contador de ediciones */}
      <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ediciones realizadas este día</p>
          <p className="text-2xl font-bold text-primary">{editCount}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Trenadas del día</p>
          <p className="text-2xl font-bold">{trenadaList.length}</p>
        </div>
      </div>

      {/* Tabla */}
      <Card className="shadow border-0">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg">Trenadas Registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Cargando...</p>
          ) : !trenadaList.length ? (
            <p className="text-center text-muted-foreground py-12">No hay trenadas para esta fecha</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="py-2 px-3 text-left">No.</th>
                    <th className="py-2 px-3 text-left">Hora</th>
                    <th className="py-2 px-3 text-left">Cuadrilla</th>
                    <th className="py-2 px-3 text-left">Conchero</th>
                    <th className="py-2 px-3 text-left">Cortero</th>
                    <th className="py-2 px-3 text-left">Sección</th>
                    <th className="py-2 px-3 text-left">Línea</th>
                    <th className="py-2 px-3 text-center">Total</th>
                    <th className="py-2 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trenadaList.map((t, idx) => {
                   const isEditing = editingId === t.id;
                   return (
                     <React.Fragment key={t.id}>
                       <tr className={`border-b ${isEditing ? "bg-accent/30" : "hover:bg-muted/40"}`}>
                         <td className="py-2 px-3 font-semibold text-primary">{idx + 1}</td>

                         {/* Hora */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input type="time" value={editData.hora} onChange={e => setEditData(d => ({ ...d, hora: e.target.value }))} className="h-7 w-24 text-xs" />
                             : t.hora || "-"}
                         </td>

                         {/* Cuadrilla */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input type="number" value={editData.cuadrilla} onChange={e => setEditData(d => ({ ...d, cuadrilla: e.target.value }))} className="h-7 w-16 text-xs" />
                             : `#${t.cuadrilla}`}
                         </td>

                         {/* Conchero */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input value={editData.conchero} onChange={e => setEditData(d => ({ ...d, conchero: e.target.value }))} className="h-7 w-28 text-xs" />
                             : t.conchero}
                         </td>

                         {/* Cortero */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input value={editData.cortero} onChange={e => setEditData(d => ({ ...d, cortero: e.target.value }))} className="h-7 w-28 text-xs" />
                             : t.cortero}
                         </td>

                         {/* Sección */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input value={editData.seccion} onChange={e => setEditData(d => ({ ...d, seccion: e.target.value }))} className="h-7 w-24 text-xs" />
                             : t.seccion}
                         </td>

                         {/* Línea */}
                         <td className="py-2 px-3">
                           {isEditing
                             ? <Input value={editData.linea} onChange={e => setEditData(d => ({ ...d, linea: e.target.value }))} className="h-7 w-20 text-xs" />
                             : t.linea || "-"}
                         </td>

                         {/* Total */}
                         <td className="py-2 px-3 text-center font-bold">
                           {isEditing
                             ? editData.racimos.reduce((s, r) => s + Number(r.count), 0)
                             : (t.total_racimos || 0)}
                         </td>

                         {/* Acciones */}
                         <td className="py-2 px-3 text-center">
                           {isViewer ? (
                             <span className="text-xs text-muted-foreground italic">Solo lectura</span>
                           ) : isEditing ? (
                             <div className="flex items-center justify-center gap-1">
                               <Button
                                 size="sm"
                                 className="h-7 px-2 bg-primary hover:bg-primary/90"
                                 onClick={() => saveEdit(t)}
                                 disabled={updateMutation.isPending}
                               >
                                 <Save className="w-3.5 h-3.5 mr-1" />
                                 Guardar
                               </Button>
                               <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit}>
                                 <X className="w-3.5 h-3.5" />
                               </Button>
                             </div>
                           ) : (
                             <div className="flex items-center justify-center gap-1">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="h-7 px-2"
                                 onClick={() => startEdit(t)}
                               >
                                 <Pencil className="w-3.5 h-3.5 mr-1" />
                                 Editar
                               </Button>
                               <Button
                                 size="sm"
                                 variant="destructive"
                                 className="h-7 px-2"
                                 onClick={() => { if (confirm("¿Seguro que deseas borrar esta trenada?")) deleteMutation.mutate(t.id); }}
                                 disabled={deleteMutation.isPending}
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </Button>
                             </div>
                           )}
                         </td>
                       </tr>

                       {/* Fila expandida: edición de racimos por color */}
                       {isEditing && editData.racimos && editData.racimos.length > 0 && (
                         <tr className="bg-accent/20 border-b">
                           <td colSpan={9} className="px-4 py-3">
                             <p className="text-xs font-semibold text-muted-foreground mb-2">Racimos por color:</p>
                             <div className="flex flex-wrap gap-3">
                               {editData.racimos.map((r, idx) => (
                                 <div key={idx} className="flex items-center gap-1.5">
                                   <span
                                     className="inline-block w-3 h-3 rounded-full border border-black/20 flex-shrink-0"
                                     style={{ backgroundColor: r.color_hex }}
                                   />
                                   <span className="text-xs font-medium">{r.color_name} S{r.week_age}</span>
                                   <Input
                                     type="number"
                                     min="0"
                                     value={r.count}
                                     onChange={e => {
                                       const newRacimos = [...editData.racimos];
                                       newRacimos[idx] = { ...newRacimos[idx], count: e.target.value };
                                       setEditData(d => ({ ...d, racimos: newRacimos }));
                                     }}
                                     className="h-7 w-16 text-xs"
                                   />
                                 </div>
                               ))}
                             </div>
                           </td>
                         </tr>
                       )}
                     </React.Fragment>
                   );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
