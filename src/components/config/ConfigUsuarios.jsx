import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ShieldCheck, Eye, Crown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLES = {
  admin:  { label: "Administrador", icon: ShieldCheck, color: "text-primary" },
  user:   { label: "Editor",        icon: Pencil,      color: "text-blue-600" },
  viewer: { label: "Lector",        icon: Eye,         color: "text-muted-foreground" },
};

export default function ConfigUsuarios() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => users.list(),
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

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Users className="w-5 h-5" />
          Gestión de Usuarios
          {!isLoading && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {users.length} {users.length === 1 ? "usuario" : "usuarios"}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
          <span><ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-primary" /><strong>Administrador</strong>: acceso total</span>
          <span><Pencil className="w-3.5 h-3.5 inline mr-1 text-blue-600" /><strong>Editor</strong>: puede registrar y editar</span>
          <span><Eye className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" /><strong>Lector</strong>: solo puede ver</span>
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando usuarios...</p>
        ) : !users.length ? (
          <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
        ) : (
          <div className="space-y-3">
            {users.map(u => {
              const isMe = u.id === currentUser?.id;
              const roleInfo = ROLES[u.role] || ROLES.user;
              const RoleIcon = roleInfo.icon;
              return (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
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

                    {!isMe && (
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
                    {!isMe ? (
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}