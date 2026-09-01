import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Upload, Banana, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KEYS = { nombre: "finca_nombre", logo: "finca_logo" };

// Lee el setting de la finca actual; filtra por finca_id para evitar
// colisiones entre fincas (antes no filtraba y podía devolver el dato
// de otra finca o null cuando sí existía para la finca actual).
async function getSetting(key, fincaId) {
  if (!fincaId) return null;
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("key", key)
    .eq("finca_id", fincaId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Usa upsert con onConflict en (finca_id, key) para garantizar una sola
// fila por finca y clave, sin duplicados. Requiere el UNIQUE constraint
// settings_finca_id_key_unique en Supabase.
async function upsertSetting(key, value, fincaId) {
  if (!fincaId) throw new Error("finca_id requerido para guardar settings");
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, finca_id: fincaId }, { onConflict: "finca_id,key" });
  if (error) throw error;
}

// ============================================================
// COMPRESIÓN DE LOGO
// Antes el logo se guardaba como base64 crudo (hasta 2.7 MB) dentro de la
// tabla `settings`, y el Sidebar lo re-descargaba en cada navegación. Eso
// consumió 7.6 GB de egress y bloqueó el proyecto de Supabase (error 402).
// Con 256px + WebP 0.85 un logo queda en ~20-30 KB: 99% menos tráfico.
// ============================================================
const LOGO_MAX_PX = 256;
const LOGO_MAX_BYTES = 120 * 1024; // 120 KB de margen

function leerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.readAsDataURL(file);
  });
}

async function comprimirImagen(file) {
  // Los SVG ya son vectoriales y livianos; el canvas los rasterizaría y
  // perderían calidad. Se guardan tal cual si no exceden el límite.
  if (file.type === "image/svg+xml" && file.size <= LOGO_MAX_BYTES) {
    return await leerComoDataURL(file);
  }

  const dataUrl = await leerComoDataURL(file);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    image.src = dataUrl;
  });

  // Escala manteniendo proporción; nunca agranda una imagen ya pequeña
  const escala = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP conserva la transparencia y pesa mucho menos que PNG
  let salida = canvas.toDataURL("image/webp", 0.85);
  // base64 infla ~1.37x: si aún supera el límite, se baja la calidad
  if (salida.length > LOGO_MAX_BYTES * 1.37) {
    salida = canvas.toDataURL("image/webp", 0.6);
  }
  return salida;
}

export default function ConfigFinca() {
  const queryClient = useQueryClient();
  const fileRef = useRef();
  const { user } = useAuth();
  const fincaId = user?.finca_id;

  const { data: nombreSetting } = useQuery({
    queryKey: ["setting", KEYS.nombre, fincaId],
    queryFn: () => getSetting(KEYS.nombre, fincaId),
    enabled: !!fincaId,
  });
  const { data: logoSetting } = useQuery({
    queryKey: ["setting", KEYS.logo, fincaId],
    queryFn: () => getSetting(KEYS.logo, fincaId),
    enabled: !!fincaId,
  });

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
      await upsertSetting(KEYS.nombre, nombre, fincaId);

      // Si hay imagen nueva, comprimirla y guardarla en settings
      // (evita dependencia de Storage bucket y sus políticas)
      if (pendingFile) {
        setUploading(true);
        const base64 = await comprimirImagen(pendingFile);
        setUploading(false);
        await upsertSetting(KEYS.logo, base64, fincaId);
        setLogoPreview(base64);
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
              <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Se optimiza automáticamente a 256px.</p>
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
