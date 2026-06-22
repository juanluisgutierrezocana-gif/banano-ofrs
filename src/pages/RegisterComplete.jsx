import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

// Página de destino tras confirmar el correo (signUp por email) o tras
// volver de Google OAuth. Supabase-js ya detectó la sesión desde la URL
// (detectSessionInUrl: true por default) antes de que este componente
// se monte, así que aquí solo falta: si el usuario es nuevo, crear su
// finca + su fila en `users` (admin de esa finca) con 24h de prueba.
export default function RegisterComplete() {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    const completeRegistration = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session?.user) {
          setStatus("error");
          setError(
            "No encontramos una sesión activa. Abre el enlace de confirmación desde este mismo navegador."
          );
          return;
        }

        const authUser = session.user;

        // Si ya existe la fila en `users`, este usuario ya fue provisionado
        // (p. ej. abrió el enlace de confirmación dos veces). No duplicar nada.
        const { data: existingUser, error: existingUserError } = await supabase
          .from("users")
          .select("id")
          .eq("id", authUser.id)
          .maybeSingle();
        if (existingUserError) throw existingUserError;

        if (!existingUser) {
          // id generado en el cliente para no depender de RETURNING tras el
          // INSERT (con RLS activo, el SELECT implícito de `.select()` podría
          // no ver la fila recién creada hasta que también exista `users`).
          const fincaId = crypto.randomUUID();
          const nombreFinca =
            authUser.user_metadata?.finca_nombre?.trim() ||
            authUser.user_metadata?.full_name?.trim() ||
            "Mi Finca";

          const { error: fincaError } = await supabase
            .from("fincas")
            .insert([{ id: fincaId, nombre: nombreFinca, email_contacto: authUser.email }]);
          if (fincaError) throw fincaError;

          const { error: userError } = await supabase
            .from("users")
            .insert([{ id: authUser.id, email: authUser.email, role: "admin", finca_id: fincaId }]);
          if (userError) throw userError;
        }

        setStatus("success");
      } catch (err) {
        console.error("Error completando registro:", err);
        setStatus("error");
        setError(err.message || "No pudimos completar tu registro.");
      }
    };

    completeRegistration();
  }, []);

  if (status === "loading") {
    return (
      <AuthLayout icon={Loader2} title="Activando tu cuenta" subtitle="Esto toma solo un momento">
        <div className="flex justify-center py-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (status === "error") {
    return (
      <AuthLayout icon={XCircle} title="No pudimos activar tu cuenta" subtitle={error}>
        <Button className="w-full h-12 font-medium" onClick={() => (window.location.href = "/login")}>
          Ir a iniciar sesión
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={CheckCircle2}
      title="¡Cuenta activada!"
      subtitle="Tu prueba gratuita de 24 horas ya comenzó"
    >
      <p className="text-sm text-muted-foreground text-center mb-6">
        Tienes acceso completo durante las próximas 24 horas. Cuando termine, podrás
        activar tu plan desde la pantalla de estado de cuenta.
      </p>
      <Button className="w-full h-12 font-medium" onClick={() => (window.location.href = "/")}>
        Entrar a la app
      </Button>
      <p className="text-center text-sm text-muted-foreground mt-4">
        <Link to="/login" className="text-primary font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
