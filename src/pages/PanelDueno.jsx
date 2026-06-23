import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, users, fincas, ownerActiveFinca } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Crown, ShieldCheck, Eye, Pencil, Trash2, LogIn, UserPlus, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

// `estado` válidos en fincas (mismo check constraint que usa AccountStatusGate)
const ESTADOS = ["trial", "pendiente", "activo", "suspendido", "cancelado"];
const ESTADO_BADGE = {
  trial: "secondary",
  pendiente: "secondary",
  activo: "default",
  suspendido: "destructive",
  cancelado: "destructive",
};

const ROLES = {
  admin: { label: "Administrador", icon: ShieldCheck, color: "text-primary" },
  user: { label: "Editor", icon: Pencil, color: "text-blue-600" },
  viewer: { label: "Lector", icon: Eye, color: "text-muted-foreground" },
};

// Convierte un ISO a "YYYY-MM-DD" para precargar un <input type="date">.
function toDateInputValue(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function PanelDueno() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // --- Datos compartidos por ambas pestañas ---
  const { data: fincasList = [], isLoading: loadingFincas } = useQuery({
    queryKey: ["owner-fincas"],
    queryFn: async () => {
      const { data, error } = await fincas.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: usersList = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["owner-users"],
    queryFn: async () => {
      const { data, error } = await users.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const nombrePorFincaId = useMemo(
    () => Object.fromEntries(fincasList.map((f) => [f.id, f.nombre])),
    [fincasList]
  );

  // --- Mutaciones: fincas ---
  const updateFincaMutation = useMutation({
    mutationFn: ({ id, updates }) => fincas.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-fincas"] });
      toast.success("Cuenta de la finca actualizada");
    },
    onError: (error) => toast.error(`Error al actualizar: ${error.message}`),
  });

  const enterFincaMutation = useMutation({
    mutationFn: (fincaId) => ownerActiveFinca.set(currentUser.id, fincaId),
    onSuccess: (_data, fincaId) => {
      toast.success(`Entrando a ${nombrePorFincaId[fincaId] || "la finca"}...`);
      // Recarga completa: limpia toda caché de React Query y fuerza a
      // AuthContext a re-evaluar la sesión, para no mezclar datos de la
      // finca anterior con los de la nueva.
      window.location.href = "/";
    },
    onError: (error) => toast.error(`Error al entrar a la finca: ${error.message}`),
  });

  // --- Mutaciones: usuarios ---
  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }) => users.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-users"] });
      toast.success("Rol actualizado");
    },
    onError: (error) => toast.error(`Error al actualizar rol: ${error.message}`),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-users"] });
      toast.success("Usuario eliminado");
    },
    onError: (error) => toast.error(`Error al eliminar: ${error.message}`),
  });

  // --- Crear usuario (vía /api/admin/create-user, con service_role en el servidor) ---
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "user", finca_id: "" });

  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no encontrada, vuelve a iniciar sesión");

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear usuario");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-users"] });
      toast.success("Usuario creado correctamente");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", full_name: "", role: "user", finca_id: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Crown className="w-6 h-6 text-secondary" />
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Panel del Dueño</h1>
      </div>

      <Tabs defaultValue="fincas" className="w-full">
        <TabsList>
          <TabsTrigger value="fincas">Fincas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>

        {/* ===================== FINCAS ===================== */}
        <TabsContent value="fincas">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Todas las fincas
                {!loadingFincas && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {fincasList.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFincas ? (
                <p className="text-center text-muted-foreground py-8">Cargando fincas...</p>
              ) : !fincasList.length ? (
                <p className="text-center text-muted-foreground py-8">No hay fincas registradas</p>
              ) : (
                <div className="space-y-3">
                  {fincasList.map((f) => (
                    <FincaRow
                      key={f.id}
                      finca={f}
                      onSave={(updates) => updateFincaMutation.mutate({ id: f.id, updates })}
                      onEnter={() => enterFincaMutation.mutate(f.id)}
                      entering={enterFincaMutation.isPending && enterFincaMutation.variables === f.id}
                      saving={updateFincaMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== USUARIOS ===================== */}
        <TabsContent value="usuarios">
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="font-heading flex items-center gap-2">
                Todos los usuarios
                {!loadingUsers && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {usersList.length}
                  </Badge>
                )}
              </CardTitle>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="w-4 h-4 mr-1" /> Nuevo usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear nuevo usuario</DialogTitle>
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
                      <Label>Finca</Label>
                      <Select
                        value={newUser.finca_id}
                        onValueChange={(finca_id) => setNewUser((u) => ({ ...u, finca_id }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecciona una finca" /></SelectTrigger>
                        <SelectContent>
                          {fincasList.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      disabled={createUserMutation.isPending || !newUser.email || !newUser.password || !newUser.finca_id}
                      onClick={() => createUserMutation.mutate(newUser)}
                    >
                      {createUserMutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creando...</>
                        : "Crear usuario"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <p className="text-center text-muted-foreground py-8">Cargando usuarios...</p>
              ) : !usersList.length ? (
                <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
              ) : (
                <div className="space-y-3">
                  {usersList.map((u) => {
                    const isMe = u.id === currentUser?.id;
                    const isOwnerRow = u.role === "owner";
                    const roleInfo = ROLES[u.role] || ROLES.user;
                    const RoleIcon = roleInfo.icon;
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                            {(u.full_name || u.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm flex items-center gap-1">
                              {u.full_name || u.email}
                              {isMe && <Crown className="w-3.5 h-3.5 text-secondary ml-1" />}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.email} · {nombrePorFincaId[u.finca_id] || "sin finca"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {isOwnerRow ? (
                            <Badge variant="default" className="flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5" /> Dueño
                            </Badge>
                          ) : (
                            <>
                              {!isMe && (
                                <button
                                  onClick={() => {
                                    if (confirm(`¿Eliminar a ${u.full_name || u.email}?`)) {
                                      deleteUserMutation.mutate(u.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <Select
                                value={u.role || "user"}
                                onValueChange={(role) => updateRoleMutation.mutate({ id: u.id, role })}
                                disabled={updateRoleMutation.isPending}
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
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Fila de una finca: muestra estado/plan/vencimiento y permite editarlos
// en línea, además del botón para "entrar" a operar dentro de ella.
function FincaRow({ finca, onSave, onEnter, entering, saving }) {
  const [editing, setEditing] = useState(false);
  const [estado, setEstado] = useState(finca.estado || "trial");
  const [plan, setPlan] = useState(finca.plan || "");
  const [vencimiento, setVencimiento] = useState(toDateInputValue(finca.fecha_vencimiento));

  const handleSave = () => {
    onSave({
      estado,
      plan: plan || null,
      fecha_vencimiento: vencimiento ? new Date(vencimiento).toISOString() : null,
    });
    setEditing(false);
  };

  return (
    <div className="p-3 rounded-xl border bg-card space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-sm">{finca.nombre}</p>
          <p className="text-xs text-muted-foreground">{finca.email_contacto}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ESTADO_BADGE[finca.estado] || "secondary"}>{finca.estado}</Badge>
          {finca.plan && <Badge variant="outline">{finca.plan}</Badge>}
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> {editing ? "Cancelar" : "Editar cuenta"}
          </Button>
          <Button size="sm" onClick={onEnter} disabled={entering}>
            {entering
              ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              : <LogIn className="w-3.5 h-3.5 mr-1" />}
            Entrar
          </Button>
        </div>
      </div>

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plan</Label>
            <Input className="h-9" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ej: mensual" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimiento</Label>
            <Input className="h-9" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
