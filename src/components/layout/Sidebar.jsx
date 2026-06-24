import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import BananoAnimation from "@/components/layout/BananoAnimation";
import { LayoutDashboard, Truck, FileBarChart, Settings, Package, AlertTriangle, Menu, X, Banana, FilePenLine, BarChart3, Ruler, LandPlot, LogOut, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";

async function getFincaSettings() {
  const { data } = await supabase.from("settings").select("*").in("key", ["finca_nombre", "finca_logo"]);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return { nombre: map.finca_nombre || null, logo: map.finca_logo || null };
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

// minRole controla qué tan restringida está cada sección:
// "viewer" -> cualquier usuario autenticado (incluye Lector)
// "editor" -> Editor y superiores (antes estas 4 quedaban ocultas para
//             Editor por error: un Editor "puede registrar y editar" pero
//             Recepción Fruta, Editar Trenadas, Orden de Calibre y Acres
//             estaban marcadas adminOnly, bloqueándole justo eso)
// "admin"  -> solo Administrador/Dueño (Configuraciones: gestiona usuarios)
// "owner"  -> solo Dueño (Panel Global)
const allNavItems = [
{ path: "/", label: "Panel Diario", icon: LayoutDashboard, minRole: "viewer" },
{ path: "/recepcion", label: "Recepción Fruta", icon: Truck, minRole: "editor" },
{ path: "/reporteria", label: "Reportería", icon: FileBarChart, minRole: "viewer" },
{ path: "/inventario", label: "Inventario", icon: Package, minRole: "viewer" },
{ path: "/perdidas", label: "Pérdidas", icon: AlertTriangle, minRole: "viewer" },
{ path: "/saldos", label: "Saldos", icon: BarChart3, minRole: "viewer" },
{ path: "/editar-trenadas", label: "Editar Trenadas", icon: FilePenLine, minRole: "editor" },
{ path: "/orden-calibre", label: "Orden de Calibre", icon: Ruler, minRole: "editor" },
{ path: "/acres", label: "Acres", icon: LandPlot, minRole: "editor" },
{ path: "/configuraciones", label: "Configuraciones", icon: Settings, minRole: "admin" },
{ path: "/panel-dueno", label: "Panel del Dueño", icon: Crown, minRole: "owner" }];


export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin, isOwner, isEditor } = useRole();
  const online = useOnlineStatus();
  const { data: finca } = useQuery({ queryKey: ["finca-settings"], queryFn: getFincaSettings, staleTime: 60000 });
  const navItems = allNavItems.filter((item) => {
    if (item.minRole === "owner") return isOwner;
    if (item.minRole === "admin") return isAdmin;
    if (item.minRole === "editor") return isEditor;
    return true; // "viewer": visible para cualquier usuario autenticado
  });

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center px-4">
        <button onClick={() => setOpen(true)} className="text-sidebar-foreground">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center overflow-hidden">
            {finca?.logo
              ? <img src={finca.logo} alt="Logo" className="w-full h-full object-contain" />
              : <Banana className="w-5 h-5 text-sidebar-primary-foreground" />}
          </div>
          <span className="font-heading font-bold text-sidebar-foreground">{finca?.nombre || "BANANO APP"}</span>
          <span className={cn("w-2.5 h-2.5 rounded-full ml-1 flex-shrink-0", online ? "bg-green-400" : "bg-red-500")} title={online ? "En línea" : "Sin conexión"} />
        </div>
      </div>

      {/* Mobile overlay */}
      {open &&
      <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />
      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-sidebar z-50 flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-lg overflow-hidden">
              {finca?.logo
                ? <img src={finca.logo} alt="Logo" className="w-full h-full object-contain" />
                : <Banana className="w-6 h-6 text-sidebar-primary-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-heading font-bold text-lg text-sidebar-foreground leading-none">BANANO APP</h1>
                <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", online ? "bg-green-400" : "bg-red-500")} title={online ? "En línea" : "Sin conexión"} />
              </div>
              <span className="text-xs text-sidebar-foreground/60 font-medium">{finca?.nombre || ".OFRS"}</span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-sidebar-foreground/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
            item.path !== "/" && location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive ?
                  "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" :
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}>

                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>);

          })}

          {/* Botón salir a pantalla inicial */}
          <button
            onClick={() => { window.location.href = "/landing"; }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 mt-2"
          >
            <LogOut className="w-5 h-5" />
            Salir a Pantalla Inicial
          </button>
        </nav>

        <BananoAnimation />

      </aside>
    </>);

}
