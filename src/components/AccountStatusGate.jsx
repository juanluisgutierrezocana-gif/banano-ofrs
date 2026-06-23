import { Clock, Ban, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

// Link de checkout de Recurrente. Hasta que el sub-paso de configurar la
// cuenta de Recurrente esté listo, esta env var puede no existir: en ese
// caso mostramos un contacto de soporte en vez de un botón roto.
const RECURRENTE_LINK = import.meta.env.VITE_RECURRENTE_PAYMENT_LINK;
const SOPORTE_EMAIL = "juan.luis.gutierrez.ocana@gmail.com";

// `estado` válidos en fincas (check constraint): trial | pendiente | activo | suspendido | cancelado
const MOTIVOS = {
  pendiente: {
    icon: Clock,
    titulo: "Tu pago está pendiente",
    mensaje:
      "Todavía no confirmamos tu pago. Si ya pagaste, puede tardar unos minutos en reflejarse. Si no, activa tu plan abajo.",
  },
  vencida: {
    icon: Clock,
    titulo: "Tu período de prueba terminó",
    mensaje: "Activa tu plan para seguir usando el sistema sin interrupciones.",
  },
  suspendido: {
    icon: Ban,
    titulo: "Cuenta suspendida",
    mensaje: "Tu cuenta está suspendida. Activa tu plan para recuperar el acceso.",
  },
  cancelado: {
    icon: XCircle,
    titulo: "Cuenta cancelada",
    mensaje: "Tu suscripción fue cancelada. Activa un nuevo plan para volver a usar el sistema.",
  },
};

// Determina si la finca está bloqueada y por qué. `null` = acceso permitido.
function getMotivo(finca) {
  if (!finca) return null;
  if (finca.estado === "pendiente") return "pendiente";
  if (finca.estado === "suspendido") return "suspendido";
  if (finca.estado === "cancelado") return "cancelado";
  // Cubre tanto el trial vencido como un plan "activo" cuya fecha_vencimiento
  // ya pasó (renovación no procesada todavía).
  if (finca.fecha_vencimiento && new Date(finca.fecha_vencimiento) <= new Date()) {
    return "vencida";
  }
  return null;
}

export default function AccountStatusGate({ finca, children }) {
  const { logout } = useAuth();
  const motivo = getMotivo(finca);

  if (!motivo) return children;

  const { icon: Icon, titulo, mensaje } = MOTIVOS[motivo];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Icon className="w-7 h-7 text-amber-600" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{titulo}</h1>
          <p className="text-muted-foreground text-sm">{mensaje}</p>
        </div>

        {RECURRENTE_LINK ? (
          <a href={RECURRENTE_LINK} target="_blank" rel="noopener noreferrer">
            <Button className="w-full h-12 font-medium">Activar mi plan</Button>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            Escríbenos a{" "}
            <a className="text-primary font-medium hover:underline" href={`mailto:${SOPORTE_EMAIL}`}>
              {SOPORTE_EMAIL}
            </a>{" "}
            para activar tu plan.
          </p>
        )}

        {finca?.nombre && (
          <p className="text-xs text-muted-foreground">Finca: {finca.nombre}</p>
        )}

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
