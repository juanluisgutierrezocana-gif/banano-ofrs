import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import StepInicio from "@/components/recepcion/StepInicio";
import StepConteo from "@/components/recepcion/StepConteo";
import StepConfirmacion from "@/components/recepcion/StepConfirmacion";
import { useRole } from "@/hooks/useRole";
import { ShieldOff } from "lucide-react";

export default function RecepcionFruta() {
  const { isAdmin, isEditor, isViewer, hasPermiso } = useRole();
  const [step, setStep] = useState(1);
  const [trenadaInfo, setTrenadaInfo] = useState(null);
  const [savedTrenada, setSavedTrenada] = useState(null);

  const handleIniciar = (info) => {
    setTrenadaInfo(info);
    setStep(2);
  };

  const handleSave = (trenada) => {
    setSavedTrenada(trenada);
    setStep(3);
  };

  const handleNueva = () => {
    setTrenadaInfo(null);
    setSavedTrenada(null);
    setStep(1);
  };

  // Editor sin permiso recepcion_fruta → redirige a pantalla inicial
  if (isEditor && !isAdmin && !hasPermiso("recepcion_fruta")) {
    return <Navigate to="/landing" replace />;
  }

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