import { useAuth } from "@/lib/AuthContext";

/**
 * role === "owner"  -> dueño de la app: control total sobre TODAS las
 *                      fincas; además actúa como admin dentro de la finca
 *                      en la que esté operando en cada momento
 * role === "admin"  -> acceso total (administrador) dentro de su finca
 * role === "user"   -> puede registrar y editar (editor)
 * role === "viewer" -> solo lectura (lector)
 */
export function useRole() {
  const { user } = useAuth();
  const role = user?.role;
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;
  const isEditor = role === "user" || isAdmin;
  const isViewer = role === "viewer";
  return { isAdmin, isEditor, isViewer, isOwner };
}