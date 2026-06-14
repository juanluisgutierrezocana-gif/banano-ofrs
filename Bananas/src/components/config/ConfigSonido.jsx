import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { useTapSound, useSaveSound } from "@/hooks/useSound";

export default function ConfigSonido() {
  const { play: playTap } = useTapSound();
  const { play: playSave } = useSaveSound();

  const [tapEnabled, setTapEnabled] = useState(
    () => localStorage.getItem("tap_sound_enabled") === "true"
  );
  const [saveEnabled, setSaveEnabled] = useState(
    () => localStorage.getItem("save_sound_enabled") === "true"
  );

  const toggleTap = (val) => {
    setTapEnabled(val);
    localStorage.setItem("tap_sound_enabled", val ? "true" : "false");
  };

  const toggleSave = (val) => {
    setSaveEnabled(val);
    localStorage.setItem("save_sound_enabled", val ? "true" : "false");
  };

  return (
    <Card className="shadow border-0 mt-4">
      <CardHeader className="bg-primary text-primary-foreground rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Volume2 className="w-5 h-5" />
          </div>
          <CardTitle className="font-heading">Sonido de Recepción</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {/* Sonido al pulsar botón */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tapEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
            <div>
              <Label className="text-base font-semibold">Sonido al pulsar botón</Label>
              <p className="text-sm text-muted-foreground">Reproduce un tono al registrar cada racimo</p>
            </div>
          </div>
          <Switch checked={tapEnabled} onCheckedChange={toggleTap} />
        </div>
        {tapEnabled && (
          <Button variant="outline" size="sm" onClick={playTap}>
            <Volume2 className="w-4 h-4 mr-2" />
            Probar sonido
          </Button>
        )}

        <div className="border-t pt-4" />

        {/* Sonido al guardar trenada */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {saveEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
            <div>
              <Label className="text-base font-semibold">Sonido al guardar trenada</Label>
              <p className="text-sm text-muted-foreground">Reproduce un tono de confirmación al guardar</p>
            </div>
          </div>
          <Switch checked={saveEnabled} onCheckedChange={toggleSave} />
        </div>
        {saveEnabled && (
          <Button variant="outline" size="sm" onClick={playSave}>
            <Volume2 className="w-4 h-4 mr-2" />
            Probar sonido
          </Button>
        )}
      </CardContent>
    </Card>
  );
}