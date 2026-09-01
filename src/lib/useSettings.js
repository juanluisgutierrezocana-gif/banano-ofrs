import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";

export function useSettings() {
  const { data: settingsRows = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      // Se excluye `finca_logo`: es una imagen en base64 (hasta 2.7 MB) y este
      // hook solo necesita valores numéricos de configuración. Traerla aquí
      // fue una de las causas del agotamiento de egress en Supabase.
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .neq("key", "finca_logo");
      return data ?? [];
    },
    // Configuración que cambia muy rara vez: evita refetches innecesarios.
    staleTime: 5 * 60 * 1000,
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
