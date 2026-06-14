import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";

export function useSettings() {
  const { data: settingsRow = {}, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).maybeSingle();
      return data ?? {};
    },
  });

  const settings = settingsRow;

  const getRangoMin = () => parseInt(settings.rango_min || "25");
  const getRangoMax = () => parseInt(settings.rango_max || "35");
  const getLineas = () => parseInt(settings.lineas || "4");

  return { settings, isLoading, getRangoMin, getRangoMax, getLineas };
}