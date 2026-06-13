import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";

export function useSettings() {
  const { data: settingsRaw = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => supabase.from("settings").select("*")(),
  });

  const settings = {};
  settingsRaw.forEach((s) => {
    settings[s.key] = s.value;
  });

  const getRangoMin = () => parseInt(settings.rango_min || "25");
  const getRangoMax = () => parseInt(settings.rango_max || "35");
  const getLineas = () => parseInt(settings.lineas || "4");

  return { settings, settingsRaw, isLoading, getRangoMin, getRangoMax, getLineas };
}