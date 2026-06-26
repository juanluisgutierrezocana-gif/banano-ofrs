import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Factory, ClipboardList, CalendarRange, BarChart3, Settings, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import AdminOnlyMessage from "@/components/avances/AdminOnlyMessage";

// Estructura fija de navegación, igual al boceto del cliente:
// PRODUC. (resumen) / INGR. DATOS / REPORTERIA / CONFIGUR.
const navItems = [
  { path: "/produccion", label: "Producción", icon: Factory, exact: true },
  { path: "/produccion/ingresar", label: "Ingresar Datos", icon: ClipboardList },
  { path: "/produccion/semanal", label: "Inventario Semanal", icon: CalendarRange },
  { path: "/produccion/reporteria", label: "Reportería", icon: BarChart3 },
  { path: "/produccion/configuraciones", label: "Configuraciones", icon: Settings },
];

export default function ProduccionLayout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Mismo patrón de bloqueo total que AvancesLayout: un Editor (role==='user')
  // sin el permiso granular 'produccion' no ve nada del módulo. Admin/Dueño
  // siempre pasan. Lector no queda bloqueado aquí (fuera de alcance).
  const { isAdmin, isEditor, hasPermiso } = useRole();
  const bloqueado = isEditor && !isAdmin && !hasPermiso("produccion");

  if (bloqueado) {
    return <AdminOnlyMessage />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-4 border-b border-sidebar-border"
        style={{ background: "#1a4a2e" }}>
        <button onClick={() => setOpen(true)} className="text-white">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Factory className="w-5 h-5 text-green-400" />
          <span className="font-heading font-bold text-white">Producción</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )} style={{ background: "linear-gradient(180deg, #0d2b1a 0%, #1a4a2e 100%)" }}>

        {/* Header sidebar */}
        <div className="p-6 flex items-center justify-between border-b border-green-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-white text-sm leading-tight">PRODUCCIÓN</h1>
              <span className="text-xs text-green-400 font-medium">PROCESO DIARIO</span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-green-400/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto flex flex-col">
          <div className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive ? "bg-green-600 text-white shadow-md" : "text-green-100/70 hover:text-white hover:bg-green-800/50"
                  )}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Botón salir debajo de Configuraciones */}
          <div className="pt-2">
            <div className="h-px bg-green-800/30 mx-2 mb-2" />
            <button
              onClick={() => { window.location.href = "/landing"; }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Salir a Pantalla Inicial
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
