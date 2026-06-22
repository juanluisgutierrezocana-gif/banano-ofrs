import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, Building2, MailCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Register() {
  const [nombreFinca, setNombreFinca] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!nombreFinca.trim()) {
      setError("Ingresa el nombre de tu finca");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      // El nombre de la finca viaja en user_metadata: RegisterComplete.jsx lo
      // lee desde ahí para crear la fila en `fincas` una vez confirmado el correo.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { finca_nombre: nombreFinca.trim() },
          emailRedirectTo: `${window.location.origin}/registro-completado`,
        },
      });
      if (signUpError) throw signUpError;
      setRegistered(true);
    } catch (err) {
      setError(err.message || "No se pudo completar el registro");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setError("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Mismo destino que el flujo por correo: ahí se crea la finca si aún no existe.
          redirectTo: `${window.location.origin}/registro-completado`
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Error al conectar con Google');
    }
  };

  if (registered) {
    return (
      <AuthLayout
        icon={MailCheck}
        title="Revisa tu correo"
        subtitle={`Enviamos un enlace de confirmación a ${email}`}
      >
        <p className="text-sm text-muted-foreground text-center">
          Haz clic en el enlace del correo para activar tu cuenta y comenzar tu
          prueba gratuita de 24 horas. Si no lo encuentras, revisa la carpeta de spam.
        </p>
        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya confirmaste?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crear tu cuenta"
      subtitle="Regístrate para comenzar"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continuar con Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">o</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="finca">Nombre de la finca</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="finca"
              type="text"
              autoComplete="organization"
              autoFocus
              placeholder="Finca La Gracia"
              value={nombreFinca}
              onChange={(e) => setNombreFinca(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}