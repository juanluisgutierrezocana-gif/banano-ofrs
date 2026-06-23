import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// Si quedan menos de 2 horas, el banner cambia a un tono de advertencia.
const UMBRAL_URGENTE_MS = 2 * 60 * 60 * 1000;

function formatRestante(ms) {
  const totalMinutos = Math.max(0, Math.floor(ms / 60000));
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas <= 0) return `${minutos} min`;
  return `${horas}h ${minutos}m`;
}

// Mini-conteo del trial de 24h. Solo se renderiza mientras `finca.estado`
// sea "trial" y `fecha_vencimiento` siga en el futuro: si ya venció,
// AccountStatusGate bloquea el acceso antes de que este componente llegue
// a montarse, así que nunca debería mostrarse "0h 0m" en pantalla.
export default function TrialCountdownBanner({ finca }) {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 30000); // refresca cada 30s
    return () => clearInterval(intervalo);
  }, []);

  if (!finca || finca.estado !== "trial" || !finca.fecha_vencimiento) return null;

  const restanteMs = new Date(finca.fecha_vencimiento) - ahora;
  if (restanteMs <= 0) return null;

  const urgente = restanteMs <= UMBRAL_URGENTE_MS;

  return (
    <div
      className={`flex items-center justify-center gap-2 text-xs font-medium py-1.5 px-4 text-center ${
        urgente ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"
      }`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Prueba gratuita: quedan {formatRestante(restanteMs)}
    </div>
  );
}
