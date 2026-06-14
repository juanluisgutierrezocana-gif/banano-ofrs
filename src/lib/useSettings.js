import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

export function useSettings() {
  const { data: settingsRows = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      return data ?? [];
    },
  });

  // Convertir array de filas {key, value} a objeto plano
  const settings = {};
  settingsRows.forEach(row => {
    if (row?.key) settings[row.key] = row.value;
  });

  const getRangoMin = () => parseInt(settings.rango_min || "25");
  const getRangoMax = () => parseInt(settings.rango_max || "35");
  const getLineas   = () => parseInt(settings.lineas    || "4");

  return { settings, isLoading, getRangoMin, getRangoMax, getLineas };
}
