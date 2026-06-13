import { useAuth } from "@/lib/AuthContext";

/**
 * role === "admin"  -> acceso total (administrador)
 * role === "user"   -> puede registrar y editar (editor)
 * role === "viewer" -> solo lectura (lector)
 */
export function useRole() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isEditor = role === "user" || isAdmin;
  const isViewer = role === "viewer";
  return { isAdmin, isEditor, isViewer };
}