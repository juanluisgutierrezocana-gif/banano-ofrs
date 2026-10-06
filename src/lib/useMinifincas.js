import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, seccionAgricola } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

// ============================================================
// Catálogo de MINIFINCAS (MF1, MF2, MF3...)
// Se guarda en la tabla `settings` (key = "minifincas", value = JSON array)
// por finca, igual que finca_nombre — no requiere tablas nuevas.
// La lista final = catálogo guardado ∪ minifincas ya usadas en secciones,
// así las MF existentes (MF1, MF2) aparecen aunque nunca se hayan "creado".
// ============================================================
const SETTING_KEY = "minifincas";

const normalizar = (mf) => (mf || "").trim().toUpperCase();

export function useMinifincas() {
  const { user } = useAuth();
  const fincaId = user?.finca_id ?? null;
  const queryClient = useQueryClient();

  // Catálogo guardado en settings
  const { data: catalogo = [], isLoading: loadingCat } = useQuery({
    queryKey: ["minifincas-catalogo", fincaId],
    enabled: !!fincaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .eq("finca_id", fincaId)
        .maybeSingle();
      if (error) throw error;
      try {
        const arr = JSON.parse(data?.value || "[]");
        return Array.isArray(arr) ? arr.map(normalizar).filter(Boolean) : [];
      } catch {
        return [];
      }
    },
  });

  // Secciones (para incluir MF ya usadas y contar secciones por MF)
  const { data: secciones = [], isLoading: loadingSec } = useQuery({
    queryKey: ["secciones-agricolas"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const usadas = secciones.map((s) => normalizar(s.minifinca)).filter(Boolean);
  const minifincas = [...new Set([...catalogo, ...usadas])].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );

  // Cuántas secciones tiene cada MF (para no permitir borrar una MF en uso)
  const conteoSecciones = {};
  usadas.forEach((mf) => { conteoSecciones[mf] = (conteoSecciones[mf] || 0) + 1; });

  const guardarCatalogo = async (lista) => {
    if (!fincaId) throw new Error("finca_id requerido");
    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: SETTING_KEY, value: JSON.stringify(lista), finca_id: fincaId },
        { onConflict: "finca_id,key" }
      );
    if (error) throw error;
  };

  const crearMutation = useMutation({
    mutationFn: async (nombre) => {
      const mf = normalizar(nombre);
      if (!mf) throw new Error("Escribe el nombre de la minifinca");
      if (minifincas.includes(mf)) throw new Error(`${mf} ya existe`);
      // Se guarda la lista completa (incluye las que venían de secciones)
      await guardarCatalogo([...minifincas, mf]);
      return mf;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["minifincas-catalogo"] }),
  });

  const eliminarMutation = useMutation({
    mutationFn: async (nombre) => {
      const mf = normalizar(nombre);
      if (conteoSecciones[mf]) {
        throw new Error(`${mf} tiene ${conteoSecciones[mf]} secciones; muévelas a otra minifinca antes de borrarla`);
      }
      await guardarCatalogo(minifincas.filter((x) => x !== mf));
      return mf;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["minifincas-catalogo"] }),
  });

  return {
    minifincas,
    conteoSecciones,
    isLoading: loadingCat || loadingSec,
    crearMinifinca: crearMutation.mutateAsync,
    creando: crearMutation.isPending,
    eliminarMinifinca: eliminarMutation.mutateAsync,
    eliminando: eliminarMutation.isPending,
  };
}
