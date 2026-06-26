import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Users, ShieldCheck, Eye, Crown, Pencil, Trash2, UserPlus, Loader2, Shield, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";

const ROLES = {
  admin:  { label: "Administrador", icon: ShieldCheck, color: "text-primary" },
  user:   { label: "Editor",        icon: Pencil,      color: "text-blue-600" },
  viewer: { label: "Lector",        icon: Eye,         color: "text-muted-foreground" },
};

// Permisos granulares que un admin/dueño puede activar por Editor
// (role==='user'): una entrada por cada pestaña de Configuraciones más el
// acceso a Avances Agrícolas. Ver useRole.hasPermiso para cómo se consumen.
const PERMISOS = [
  { key: "config_rango", label: "Rango Racimos" },
  { key: "config_lineas", label: "Líneas" },
  { key: "config_secciones", label: "Secciones" },
  { key: "config_colores", label: "Colores" },
  { key: "config_botones", label: "Botones" },
  { key: "config_usuarios", label: "Usuarios" },
  { key: "config_sonido", label: "Sonido" },
  { key: "config_finca", label: "Finca" },
  { key: "avances_agricolas", label: "Avances Agrícolas" },
  { key: "produccion", label: "Producción" },
];

export default function ConfigUsuarios() {
  const { user: currentUser } = useAuth();
  const { hasPermiso } = useRole();
  const queryClient = useQueryClient();
  // isTrueAdmin = rol real admin/dueño (no por permiso). El panel de
  // permisos solo lo ve/controla un admin/dueño real, para que un Editor
  // con el permiso config_usuarios no pueda auto-otorgarse más permisos.
  const isTrueAdmin = currentUser?.role === "admin" || currentUser?.role === "owner";
  const [expandedId, setExpandedId] = useState(null);

  const { data: userList = [], isLoading } = useQuery({
    // Scoped a la finca actual: esta pantalla es "Configuraciones->Usuarios"
    // de UNA finca, no el panel global del dueño (ese es PanelDueno.jsx).
    // users.list() sin filtro devuelve TODO globalmente cuando RLS detecta
    // is_owner() (bypass de finca_id) — por eso el owner veía los 14
    // usuarios de todas las fincas en vez de solo los de la suya.
    queryKey: ["users-list", currentUser?.finca_id],
    enabled: !!currentUser?.finca_id,
    queryFn: async () => {
      const { data, error } = await users.filter({ finca_id: currentUser.finca_id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }) => users.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Rol actualizado correctamente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Usuario eliminado");
    },
  });

  const permisosMutation = useMutation({
    mutationFn: ({ id, permisos }) => users.update(id, { permisos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (error) => toast.error(`Error al actualizar permisos: ${error.message}`),
  });

  // --- Invitar colaborador a ESTA finca (vía /api/admin/create-user) ---
  // El endpoint, cuando quien llama es 'admin', ignora cualquier finca_id
  // recibido y usa la propia del caller; cuando es 'owner', exige finca_id
  // explícito. Por eso siempre mandamos currentUser.finca_id: funciona
  // igual para ambos roles y nunca permite invitar a otra finca desde aquí.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "user" });

  const inviteMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no encontrada, vuelve a iniciar sesión");

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ...payload, finca_id: currentUser.finca_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al invitar colaborador");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list", currentUser?.finca_id] });
      toast.success("Colaborador agregado correctamente");
      setInviteOpen(false);
      setNewUser({ email: "", password: "", full_name: "", role: "user" });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="font-heading flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestión de Usuarios
            {!isLoading && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {userList.length} {userList.length === 1 ? "usuario" : "usuarios"}
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span><ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-primary" /><strong>Administrador</strong>: acceso total</span>
            <span><Pencil className="w-3.5 h-3.5 inline mr-1 text-blue-600" /><strong>Editor</strong>: puede registrar y editar</span>
            <span><Eye className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" /><strong>Lector</strong>: solo puede ver</span>
          </p>
        </div>

        {(isTrueAdmin || hasPermiso("config_usuarios")) && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="w-4 h-4 mr-1" /> Invitar colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar colaborador a la finca</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nombre (opcional)</Label>
                  <Input
                    value={newUser.full_name}
                    onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rol</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(role) => setNewUser((u) => ({ ...u, role }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Editor</SelectItem>
                      <SelectItem value="viewer">Lector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={inviteMutation.isPending || !newUser.email || !newUser.password}
                  onClick={() => inviteMutation.mutate(newUser)}
                >
                  {inviteMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Invitando...</>
                    : "Invitar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando usuarios...</p>
        ) : !userList.length ? (
          <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
        ) : (
          <div className="space-y-3">
            {userList.map(u => {
              const isMe = u.id === currentUser?.id;
              const isOwnerRow = u.role === "owner";
              const roleInfo = isOwnerRow
                ? { label: "Dueño", icon: Crown, color: "text-secondary" }
                : (ROLES[u.role] || ROLES.user);
              const RoleIcon = roleInfo.icon;
              const mostrarPermisos = isTrueAdmin && u.role === "user";
              const expanded = expandedId === u.id;
              return (
                <div key={u.id}>
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm flex items-center gap-1">
                          {u.full_name || u.email}
                          {isMe && <Crown className="w-3.5 h-3.5 text-secondary ml-1" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="flex items-center gap-1 hidden sm:flex">
                        <RoleIcon className={`w-3.5 h-3.5 ${roleInfo.color}`} />
                        {roleInfo.label}
                      </Badge>

                      {mostrarPermisos && (
                        <button
                          onClick={() => setExpandedId(expanded ? null : u.id)}
                          className="flex items-center gap-0.5 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                          title="Permisos de este editor"
                        >
                          <Shield className="w-4 h-4" />
                          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      )}

                      {!isMe && !isOwnerRow && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${u.full_name || u.email}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isOwnerRow ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5" /> Dueño
                        </Badge>
                      ) : !isMe ? (
                        <Select
                          value={u.role || "user"}
                          onValueChange={role => updateMutation.mutate({ id: u.id, role })}
                          disabled={updateMutation.isPending}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-primary" /> Administrador
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-blue-600" /> Editor
                              </div>
                            </SelectItem>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-muted-foreground" /> Lector
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Tú</span>
                      )}
                    </div>
                  </div>

                  {/* Panel deslizable de permisos: solo admin/dueño real lo ve,
                      para que un Editor con permiso config_usuarios no pueda
                      auto-otorgarse más permisos a sí mismo o a otros. */}
                  {mostrarPermisos && (
                    <Collapsible open={expanded}>
                      <CollapsibleContent>
                        <div className="mt-2 mb-1 p-4 rounded-xl border border-dashed bg-muted/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISOS.map((p) => (
                            <div key={p.key} className="flex items-center justify-between gap-2">
                              <Label htmlFor={`perm-${u.id}-${p.key}`} className="text-xs font-normal cursor-pointer">
                                {p.label}
                              </Label>
                              <Switch
                                id={`perm-${u.id}-${p.key}`}
                                checked={u.permisos?.[p.key] === true}
                                disabled={permisosMutation.isPending}
                                onCheckedChange={(checked) =>
                                  permisosMutation.mutate({
                                    id: u.id,
                                    permisos: { ...(u.permisos || {}), [p.key]: checked },
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
