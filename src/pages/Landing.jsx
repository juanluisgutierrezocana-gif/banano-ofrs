import { Link } from "react-router-dom";
import { Banana, ChevronRight, Sprout, Factory, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { useRole } from "@/hooks/useRole";

export default function Landing() {
  const { isAdmin, hasPermiso } = useRole();
  const { data: finca } = useQuery({
    queryKey: ["finca-settings-landing"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("finca_name").limit(1).maybeSingle();
      return { nombre: data?.finca_name || null, logo: null };
    },
    staleTime: 60000,
  });

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative"
      style={{ background: "linear-gradient(135deg, #0d2b1a 0%, #1a4a2e 50%, #0f3520 100%)" }}
    >
      {/* Decoración de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #4ade80, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #22c55e, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: "radial-gradient(circle, #86efac, transparent)" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
        {/* Logo / Icono */}
        <div
          className="mb-6 w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          {finca?.logo
            ? <img src={finca.logo} alt="Logo" className="w-full h-full object-contain p-2" />
            : <Banana className="w-12 h-12 text-white" />}
        </div>

        {/* Título */}
        <h1 className="text-5xl font-heading font-bold text-white mb-2 tracking-tight">
          BANANO APP
        </h1>
        {finca?.nombre && (
          <p className="text-green-300 text-lg font-medium mb-2">{finca.nombre}</p>
        )}
        <p className="text-green-400/70 text-sm mb-10 max-w-xs leading-relaxed">
          Sistema de gestión y control de producción bananera
        </p>

        {/* Botones */}
        <div className="flex flex-col gap-4 w-full">
          {/* Botón Recibir Fruta: gateado por permiso granular.
              Admin/Dueño siempre lo ven; un Editor solo si el admin
              le activó 'recepcion_fruta' en Configuraciones→Usuarios. */}
          {(isAdmin || hasPermiso("recepcion_fruta")) && (
          <Link
            to="/recepcion"
            className="w-full flex items-center justify-between gap-3 py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-xl active:scale-95"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white" }}
          >
            <div className="flex items-center gap-3">
              <Banana className="w-6 h-6" />
              <span>Recibir Fruta</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-80" />
          </Link>
          )}

          {/* Botón Avances Agrícolas: gateado por permiso granular.
              Admin/Dueño siempre lo ven; un Editor (role==='user') solo si
              el admin le activó 'avances_agricolas' desde
              Configuraciones->Usuarios. Sin el permiso, el botón no
              aparece en este menú (única vía de acceso a esa sección). */}
          {(isAdmin || hasPermiso("avances_agricolas")) && (
            <Link
              to="/avances-agricolas"
              className="w-full flex items-center justify-between gap-3 py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-xl active:scale-95 border-2"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(74,222,128,0.35)", color: "white" }}
            >
              <div className="flex items-center gap-3">
                <Sprout className="w-6 h-6 text-green-400" />
                <span>Avances Agrícolas</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </Link>
          )}

          {/* Botón Producción: mismo patrón de permiso granular que Avances
              Agrícolas. Admin/Dueño siempre lo ven; un Editor solo si el
              admin le activó 'produccion' desde Configuraciones->Usuarios. */}
          {(isAdmin || hasPermiso("produccion")) && (
            <Link
              to="/produccion"
              className="w-full flex items-center justify-between gap-3 py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-xl active:scale-95 border-2"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(74,222,128,0.35)", color: "white" }}
            >
              <div className="flex items-center gap-3">
                <Factory className="w-6 h-6 text-green-400" />
                <span>Producción</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </Link>
          )}
        </div>

        {/* Separador con mata de banano */}
        <div className="mt-10 mb-4 flex flex-col items-center">
          <div className="text-5xl select-none" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>🌿</div>
        </div>

        {/* Cerrar sesión */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-green-600 hover:text-green-400 transition-colors text-sm font-medium py-2 px-4 rounded-xl hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>

        {/* Footer */}
        <div className="mt-8 flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-green-800/50" />
          <span className="text-green-700 text-xs">●</span>
          <div className="flex-1 h-px bg-green-800/50" />
        </div>
        <p className="text-green-800 text-xs mt-4">© 2026 Banano App · Todos los derechos reservados</p>
      </div>
    </div>
  );
}