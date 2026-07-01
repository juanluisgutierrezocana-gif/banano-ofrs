import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import StepInicio from "@/components/recepcion/StepInicio";
import StepConteo from "@/components/recepcion/StepConteo";
import StepConfirmacion from "@/components/recepcion/StepConfirmacion";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { ShieldOff } from "lucide-react";

export default function RecepcionFruta() {
  const { user: currentUser, isLoadingAuth } = useAuth();
  const { isAdmin, isEditor, isViewer } = useRole();
  const [step, setStep] = useState(1);
  const [trenadaInfo, setTrenadaInfo] = useState(null);
  const [savedTrenada, setSavedTrenada] = useState(null);

  // Para Editors (no admins): verifica el permiso recepcion_fruta directamente
  // en DB —no desde el cache de AuthContext— porque ese cache se carga al login
  // y no se actualiza si el admin cambia permisos mientras el editor está activo.
  // staleTime: 0 garantiza que cada visita a esta página re-consulta DB.
  const necesitaVerificar = isEditor && !isAdmin;
  const { data: freshPermisos, isLoading: loadingPermisos } = useQuery({
    queryKey: ["permiso-recepcion", currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("permisos")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (error) throw error;
      return data?.permisos ?? {};
    },
    enabled: necesitaVerificar && !!currentUser?.id,
    staleTime: 0, // siempre re-fetch: refleja cambios de permiso de inmediato
  });

  const handleIniciar = (info) => { setTrenadaInfo(info); setStep(2); };
  const handleSave = (trenada) => { setSavedTrenada(trenada); setStep(3); };
  const handleNueva = () => { setTrenadaInfo(null); setSavedTrenada(null); setStep(1); };

  // DEBUG TEMPORAL — borrar después de confirmar
  console.log("[RecepcionFruta] debug", {
    isLoadingAuth,
    isAdmin,
    isEditor,
    isViewer,
    necesitaVerificar,
    loadingPermisos,
    freshPermisos,
    currentUserId: currentUser?.id,
    currentUserRole: currentUser?.role,
  });

  // Esperar auth inicial (evita flash de contenido)
  if (isLoadingAuth) return null;

  if (isViewer) return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-6">Recepción de Fruta</h1>
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <ShieldOff className="w-12 h-12 opacity-40" />
        <p className="text-lg font-medium">Solo lectura — no tienes permiso para editar</p>
        <p className="text-sm">Contacta a un administrador para solicitar acceso.</p>
      </div>
    </div>
  );

  // Editor: esperar verificación DB, luego decidir
  if (necesitaVerificar) {
    if (loadingPermisos) return null;
    if (!freshPermisos?.recepcion_fruta) {
      window.location.replace("/landing");
      return null;
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-6">
        Recepción de Fruta
      </h1>

      {step === 1 && <StepInicio onNext={handleIniciar} />}
      {step === 2 && <StepConteo info={trenadaInfo} onSave={handleSave} onBack={() => setStep(1)} />}
      {step === 3 && <StepConfirmacion trenada={savedTrenada} onNueva={handleNueva} />}
    </div>
  );
}
