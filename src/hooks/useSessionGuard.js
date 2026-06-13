import { useEffect, useRef } from "react";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";

// Genera un ID único para esta pestaña/dispositivo
function getTabToken() {
  let token = sessionStorage.getItem("tab_session_token");
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("tab_session_token", token);
  }
  return token;
}

/**
 * Para usuarios con rol "user" (no admin):
 * - Al montar, registra el token de esta sesión en su perfil.
 * - Cada 15 segundos verifica que el token siga siendo el suyo.
 * - Si otro dispositivo tomó la sesión, hace logout automáticamente.
 */
export function useSessionGuard(user, logout) {
  const tabToken = useRef(getTabToken());

  useEffect(() => {
    if (!user || user.role === "admin") return;

    let cancelled = false;

    // Registrar esta sesión
    const register = async () => {
      await auth.updateMe({ session_token: tabToken.current });
    };

    // Verificar que la sesión siga siendo válida
    const verify = async () => {
      try {
        const fresh = await auth.getUser();
        if (!cancelled && fresh.session_token !== tabToken.current) {
          // Otro dispositivo tomó la sesión → cerrar esta
          logout(false);
          alert("Tu sesión fue iniciada en otro dispositivo. Se cerrará esta sesión.");
          auth.redirectToLogin(window.location.href);
        }
      } catch (_) {}
    };

    register();
    const interval = setInterval(verify, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);
}