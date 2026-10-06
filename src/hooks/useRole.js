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
  const permisos = user?.permisos || {};

  // Permiso granular asignado por un admin/dueño a un Editor (role==="user")
  // o Lector (role==="viewer") desde Configuraciones->Usuarios.
  // Admin/Dueño siempre pasan (acceso total). Editor/Lector pasan si el
  // permiso específico está activo en su campo `permisos` de la tabla users.
  const hasPermiso = (key) => isAdmin || permisos[key] === true;

  // Restricción por minifinca (Avances Agrícolas): permisos.minifincas es un
  // arreglo de nombres de minifinca (ej. ["MF1"]) asignado por un admin desde
  // Configuraciones->Usuarios. Si es null => sin restricción (admin/dueño, o
  // un usuario al que no se le marcó ninguna minifinca: ve y edita todas).
  // La misma regla se aplica en Supabase con RLS (función
  // minifincas_permitidas()), así que esto es solo la capa visual.
  const minifincasPermitidas =
    !isAdmin && Array.isArray(permisos.minifincas) && permisos.minifincas.length > 0
      ? permisos.minifincas
      : null;
  const puedeEditarMinifinca = (mf) =>
    minifincasPermitidas === null ||
    minifincasPermitidas.some((p) => (p || "").trim().toUpperCase() === (mf || "").trim().toUpperCase());

  return {
    isAdmin, isEditor, isViewer, isOwner, permisos, hasPermiso,
    minifincasPermitidas, puedeEditarMinifinca,
  };
}