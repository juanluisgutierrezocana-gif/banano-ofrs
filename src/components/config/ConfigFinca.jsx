import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Upload, Banana, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KEYS = { nombre: "finca_nombre", logo: "finca_logo" };

async function getSetting(key) {
  // FIXED: no destructuraba { error } — un fallo (ej. RLS) se ignoraba
  // en silencio y la consulta devolvía null como si simplemente no existiera.
  const { data, error } = await supabase.from("settings").select("*").eq("key", key);
  if (error) throw error;
  return data?.[0] || null;
}

async function upsertSetting(key, value, existing) {
  // FIXED: no destructuraba { error } ni lo lanzaba — un fallo (ej. RLS)
  // se ignoraba en silencio y saveMutation disparaba onSuccess igual.
  if (existing?.id) {
    const { error } = await supabase.from("settings").update({ key, value }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("settings").insert({ key, value });
    if (error) throw error;
  }
}

export default function ConfigFinca() {
  const queryClient = useQueryClient();
  const fileRef = useRef();

  const { data: nombreSetting } = useQuery({ queryKey: ["setting", KEYS.nombre], queryFn: () => getSetting(KEYS.nombre) });
  const { data: logoSetting } = useQuery({ queryKey: ["setting", KEYS.logo], queryFn: () => getSetting(KEYS.logo) });

  const [nombre, setNombre] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (nombreSetting?.value) setNombre(nombreSetting.value); }, [nombreSetting]);
  useEffect(() => { if (logoSetting?.value) setLogoPreview(logoSetting.value); }, [logoSetting]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Guardar nombre
      await upsertSetting(KEYS.nombre, nombre, nombreSetting);

      // Si hay imagen nueva, subirla primero
      if (pendingFile) {
        setUploading(true);
        const ext = pendingFile.name.split(".").pop();
        const fileName = `logos/finca_logo_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(fileName, pendingFile, { upsert: true });
        setUploading(false);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(uploadData.path);
        await upsertSetting(KEYS.logo, publicUrl, logoSetting);
        setLogoPreview(publicUrl);
        setPendingFile(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setting"] });
      queryClient.invalidateQueries({ queryKey: ["finca-settings"] });
      toast.success("Configuración de finca guardada");
    },
    onError: (error) => {
      setUploading(false);
      toast.error(`Error al guardar: ${error.message}`);
    }
  });

  const isPending = saveMutation.isPending || uploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Identidad de la Finca</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo de la empresa</Label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-sidebar flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                : <Banana className="w-8 h-8 text-sidebar-foreground/50" />
              }
            </div>
            <div className="space-y-1">
              <Button variant="outline" size="sm" onClick={() => fileRef.current.click()} disabled={isPending}>
                <Upload className="w-4 h-4 mr-1" /> Seleccionar imagen
              </Button>
              {pendingFile && (
                <p className="text-xs text-primary font-medium">
                  ✓ {pendingFile.name} — se subirá al guardar
                </p>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Cualquier tamaño.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                onClick={(e) => { e.target.value = null; }}
              />
            </div>
          </div>
        </div>

        {/* Nombre */}
        <div className="space-y-2">
          <Label>Nombre de la finca</Label>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Finca El Paraíso"
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">Aparece debajo del logo en la barra lateral.</p>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={isPending}>
          {isPending
            ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {uploading ? "Subiendo imagen..." : "Guardando..."}</>
            : <><Save className="w-4 h-4 mr-1" /> Guardar cambios</>
          }
        </Button>
      </CardContent>
    </Card>
  );
}
