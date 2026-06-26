import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccionSemanal, produccionCajasPalet } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";

// Códigos de producto tal como aparecen en el boceto "PRODUCCIÓN E INVENTARIO
// SEMANAL" (imagen 4). Confirmados con el cliente, incluyendo 3LB y 3LBS
// como códigos distintos.
const CODIGOS = [
  "DMD", "DM9", "PRIM", "PREM", "3LB", "IP", "24COUNT",
  "ROSY NORMAL", "ROSY CONSUMER", "DM BANABAC", "DM BANABAC MINI", "3LBS",
];

const DIAS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
];

// Devuelve la fecha (YYYY-MM-DD) del lunes de la semana actual, para
// preseleccionar la semana al entrar a la pantalla.
function lunesDeEstaSemana() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ProduccionSemanal() {
  const queryClient = useQueryClient();
  const [semana, setSemana] = useState(lunesDeEstaSemana());

  // --- Tabla 1: grid semanal por código de producto ---
  const { data: filas = [], isLoading: cargandoGrid } = useQuery({
    queryKey: ["produccion-semanal", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Tabla 2: Cajas/Palet por día ---
  const { data: filasCajasPalet = [], isLoading: cargandoCajasPalet } = useQuery({
    queryKey: ["produccion-cajas-palet", semana],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Estado local editable del grid: { [codigo]: { id, lunes, martes, ..., meta } }
  const [valoresGrid, setValoresGrid] = useState({});
  useEffect(() => {
    const inicial = {};
    CODIGOS.forEach((codigo) => {
      const fila = filas.find((f) => f.codigo_producto === codigo);
      inicial[codigo] = {
        id: fila?.id ?? null,
        lunes: fila?.lunes ?? "",
        martes: fila?.martes ?? "",
        miercoles: fila?.miercoles ?? "",
        jueves: fila?.jueves ?? "",
        viernes: fila?.viernes ?? "",
        sabado: fila?.sabado ?? "",
        meta: fila?.meta ?? "",
      };
    });
    setValoresGrid(inicial);
  }, [filas, semana]);

  // Estado local editable de Cajas/Palet: { [dia]: { id, cajas, palet } }
  const [valoresCajasPalet, setValoresCajasPalet] = useState({});
  useEffect(() => {
    const inicial = {};
    DIAS.forEach(({ key }) => {
      const fila = filasCajasPalet.find((f) => f.dia === key);
      inicial[key] = {
        id: fila?.id ?? null,
        cajas: fila?.cajas ?? "",
        palet: fila?.palet ?? "",
      };
    });
    setValoresCajasPalet(inicial);
  }, [filasCajasPalet, semana]);

  const handleChangeGrid = (codigo, campo, valor) => {
    setValoresGrid((prev) => ({
      ...prev,
      [codigo]: { ...prev[codigo], [campo]: valor },
    }));
  };

  const handleBlurGrid = async (codigo, campo) => {
    const fila = valoresGrid[codigo];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filas.find((f) => f.codigo_producto === codigo);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionSemanal.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      // Aún no existe fila para este código en esta semana: la creamos.
      const { data, error } = await produccionSemanal.create({
        fecha_semana: semana,
        codigo_producto: codigo,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresGrid((prev) => ({
        ...prev,
        [codigo]: { ...prev[codigo], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-semanal", semana] });
  };

  const handleChangeCajasPalet = (dia, campo, valor) => {
    setValoresCajasPalet((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: valor },
    }));
  };

  const handleBlurCajasPalet = async (dia, campo) => {
    const fila = valoresCajasPalet[dia];
    const raw = fila[campo];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const filaOriginal = filasCajasPalet.find((f) => f.dia === dia);
    const valorActual = filaOriginal?.[campo] ?? null;
    if (nuevoValor === valorActual) return;

    if (fila.id) {
      const { error } = await produccionCajasPalet.update(fila.id, { [campo]: nuevoValor });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
    } else {
      const { data, error } = await produccionCajasPalet.create({
        fecha_semana: semana,
        dia,
        [campo]: nuevoValor,
      });
      if (error) {
        toast.error("No se pudo guardar: " + error.message);
        return;
      }
      setValoresCajasPalet((prev) => ({
        ...prev,
        [dia]: { ...prev[dia], id: data.id },
      }));
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-cajas-palet", semana] });
  };

  // Totales calculados en pantalla (no se guardan en la base de datos).
  const totalPorCodigo = (codigo) =>
    DIAS.reduce((suma, { key }) => suma + numero(valoresGrid[codigo]?.[key]), 0);

  const totalPorDia = (diaKey) =>
    CODIGOS.reduce((suma, codigo) => suma + numero(valoresGrid[codigo]?.[diaKey]), 0);

  const totalMetas = CODIGOS.reduce((suma, codigo) => suma + numero(valoresGrid[codigo]?.meta), 0);
  const granTotal = CODIGOS.reduce((suma, codigo) => suma + totalPorCodigo(codigo), 0);

  const inputClase =
    "w-20 text-center rounded-md border border-input bg-background px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <CalendarRange className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción e Inventario Semanal</h1>
          <p className="text-muted-foreground text-sm">Grid semanal por código de producto y Cajas/Palet por día</p>
        </div>
      </div>

      <div className="mb-6 max-w-xs space-y-1.5">
        <Label htmlFor="semana" className="text-xs">Semana (lunes)</Label>
        <Input id="semana" type="date" value={semana} onChange={(e) => setSemana(e.target.value)} />
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Producción Semanal por Código</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoGrid ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                    {DIAS.map(({ key, label }) => (
                      <th key={key} className="py-2 px-2 whitespace-nowrap">{label}</th>
                    ))}
                    <th className="py-2 px-3 whitespace-nowrap">Total</th>
                    <th className="py-2 px-3 whitespace-nowrap">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {CODIGOS.map((codigo) => (
                    <tr key={codigo} className="border-b last:border-0">
                      <td className="py-1.5 px-3 font-medium whitespace-nowrap">{codigo}</td>
                      {DIAS.map(({ key }) => (
                        <td key={key} className="py-1 px-1">
                          <input
                            type="number"
                            step="1"
                            className={inputClase}
                            value={valoresGrid[codigo]?.[key] ?? ""}
                            onChange={(e) => handleChangeGrid(codigo, key, e.target.value)}
                            onBlur={() => handleBlurGrid(codigo, key)}
                            placeholder="—"
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-center font-semibold">{totalPorCodigo(codigo) || "—"}</td>
                      <td className="py-1 px-1">
                        <input
                          type="number"
                          step="1"
                          className={inputClase}
                          value={valoresGrid[codigo]?.meta ?? ""}
                          onChange={(e) => handleChangeGrid(codigo, "meta", e.target.value)}
                          onBlur={() => handleBlurGrid(codigo, "meta")}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-semibold bg-muted/30">
                    <td className="py-2 px-3 whitespace-nowrap">TOTAL</td>
                    {DIAS.map(({ key }) => (
                      <td key={key} className="py-2 px-2 text-center">{totalPorDia(key) || "—"}</td>
                    ))}
                    <td className="py-2 px-3 text-center">{granTotal || "—"}</td>
                    <td className="py-2 px-3 text-center">{totalMetas || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Las celdas de cada código y la columna Meta se escriben a mano y se guardan
            automáticamente al salir del campo. Total y TOTAL se calculan en pantalla.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cajas / Palet por Día</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoCajasPalet ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-3 text-left whitespace-nowrap">Día</th>
                    <th className="py-2 px-3 whitespace-nowrap">Cajas</th>
                    <th className="py-2 px-3 whitespace-nowrap">Palet</th>
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map(({ key, label }) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="py-1.5 px-3 font-medium whitespace-nowrap">{label}</td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          step="1"
                          className={inputClase}
                          value={valoresCajasPalet[key]?.cajas ?? ""}
                          onChange={(e) => handleChangeCajasPalet(key, "cajas", e.target.value)}
                          onBlur={() => handleBlurCajasPalet(key, "cajas")}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          step="1"
                          className={inputClase}
                          value={valoresCajasPalet[key]?.palet ?? ""}
                          onChange={(e) => handleChangeCajasPalet(key, "palet", e.target.value)}
                          onBlur={() => handleBlurCajasPalet(key, "palet")}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Se escribe a mano (sin fórmula confirmada todavía) y se guarda automáticamente
            al salir del campo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
