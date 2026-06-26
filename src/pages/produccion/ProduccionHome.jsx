import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { produccion } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Factory } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso } from "@/lib/produccionCalc";

// Columnas que se llenan a mano directamente en esta tabla porque su
// fórmula todavía no está confirmada con el cliente (boceto "PRODUCCIÓN E
// INVENTARIO SEMANAL"). Se guardan tal cual las escribe el usuario, sin
// ningún cálculo de por medio.
const CAMPOS_MANUALES = [
  { field: "factor_primera", label: "Factor 1ra" },
  { field: "factor_general", label: "Factor General" },
  { field: "factor_potencial", label: "Factor Potencial" },
  { field: "peso_racimo", label: "Peso Racimo" },
  { field: "desperdicio_monte", label: "Desperdicio del Monte" },
  { field: "desperdicio_general", label: "Desperdicio General" },
];

// Columnas que en "Ingresar Datos" vienen del registro diario (ahí se
// siguen mostrando igual). El cliente pidió que en ESTA tabla también se
// puedan rellenar de forma independiente, igual que las columnas manuales
// de arriba. No es una copia separada del dato: edita el mismo registro.
const CAMPOS_REGISTRO = [
  { field: "racimos_cosechados", label: "Racimos Cosechados" },
  { field: "racimos_rechazados", label: "Racimos Rechazados" },
  { field: "cajas_primera", label: "Cajas 1ra" },
  { field: "cajas_segunda", label: "Cajas 2da" },
  { field: "cajas_tercera", label: "Cajas 3ra" },
  { field: "quintales_rechazo", label: "Quintales Rechazo" },
];

export default function ProduccionHome() {
  const queryClient = useQueryClient();
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ultimo = registros[0];
  const calculado = ultimo ? calcularDatosProceso(ultimo) : null;

  // Valores locales de los campos manuales, para poder editarlos sin
  // disparar un guardado en cada tecla (se guarda al salir del campo).
  const [valores, setValores] = useState({});

  useEffect(() => {
    if (ultimo) {
      const inicial = {};
      [...CAMPOS_REGISTRO, ...CAMPOS_MANUALES].forEach(({ field }) => {
        inicial[field] = ultimo[field] ?? "";
      });
      setValores(inicial);
    }
  }, [ultimo?.id]);

  const handleChange = (field, value) => {
    setValores((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = async (field) => {
    if (!ultimo) return;
    const raw = valores[field];
    const nuevoValor = raw === "" ? null : parseFloat(raw);
    const valorActual = ultimo[field] ?? null;
    if (nuevoValor === valorActual) return; // sin cambios, no llamamos a Supabase

    const { error } = await produccion.update(ultimo.id, { [field]: nuevoValor });
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["produccion-registros"] });
  };

  // Celda de solo lectura (valores que se calculan, sin fórmula confirmada
  // todavía para guardar un override manual aquí).
  const CeldaFija = ({ valor }) => (
    <td className="py-2 px-3 text-center whitespace-nowrap">{valor ?? "—"}</td>
  );

  // Celda editable e independiente: se guarda al salir del campo, igual
  // que Factor 1ra/General/etc.
  const CeldaEditable = ({ field }) => (
    <td className="py-1 px-2">
      <input
        type="number"
        step="0.01"
        className="w-24 text-center rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        value={valores[field] ?? ""}
        onChange={(e) => handleChange(field, e.target.value)}
        onBlur={() => handleBlur(field)}
        placeholder="—"
      />
    </td>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Resumen del último día registrado</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
      ) : !ultimo ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Aún no hay registros de producción. Empieza en <strong>Ingresar Datos</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Día: <span className="font-semibold text-foreground">{ultimo.fecha}</span>
          </p>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-center text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-3 whitespace-nowrap">Racimos Cosechados</th>
                      <th className="py-2 px-3 whitespace-nowrap">Racimos Rechazados</th>
                      <th className="py-2 px-3 whitespace-nowrap">Racimos Procesados</th>
                      <th className="py-2 px-3 whitespace-nowrap">Cajas 1ra</th>
                      <th className="py-2 px-3 whitespace-nowrap">Cajas 2da</th>
                      <th className="py-2 px-3 whitespace-nowrap">Cajas 3ra</th>
                      <th className="py-2 px-3 whitespace-nowrap">Quintales Rechazo</th>
                      {CAMPOS_MANUALES.map(({ field, label }) => (
                        <th key={field} className="py-2 px-3 whitespace-nowrap">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <CeldaEditable field="racimos_cosechados" />
                      <CeldaEditable field="racimos_rechazados" />
                      <CeldaFija valor={calculado?.racimosProcesados} />
                      <CeldaEditable field="cajas_primera" />
                      <CeldaEditable field="cajas_segunda" />
                      <CeldaEditable field="cajas_tercera" />
                      <CeldaEditable field="quintales_rechazo" />
                      {CAMPOS_MANUALES.map(({ field }) => (
                        <CeldaEditable key={field} field={field} />
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3">
            Todas las columnas de esta tabla (excepto Racimos Procesados, que se calcula) se
            escriben a mano de forma independiente y se guardan automáticamente al salir del campo.
          </p>
        </>
      )}
    </div>
  );
}
