import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  produccion,
  produccionCajasPalet,
  produccionSemanal,
  calidadesProduccion,
  produccionVisibilidad,
} from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Factory, FileSpreadsheet, ListTree } from "lucide-react";
import { calcularDatosProceso } from "@/lib/produccionCalc";

// Helpers de semana (mismo criterio que Ingresar Datos)
function lunesDeSemanaDe(fechaStr) {
  const fecha = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  const diaSemana = fecha.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}
const DIA_A_CLAVE = { 1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado" };
function diaKeyDeFecha(fechaStr) {
  if (!fechaStr) return null;
  return DIA_A_CLAVE[new Date(fechaStr + "T00:00:00").getDay()] ?? null;
}

// Fila de solo lectura reutilizable para el panel de estadísticas
const FilaStat = ({ label, valor }) => (
  <tr className="border-b last:border-0">
    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap text-sm">{label}</td>
    <td className="py-1.5 text-right font-medium text-sm">{valor ?? "—"}</td>
  </tr>
);

export default function ProduccionHome() {
  // Fecha que controla toda la vista del Home
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const semana = lunesDeSemanaDe(fechaSeleccionada);
  const diaActual = diaKeyDeFecha(fechaSeleccionada);

  // --- Consultas Supabase ---

  // Calidades configuradas (fuente de verdad de las filas del Resumen)
  const { data: calidades = [] } = useQuery({
    queryKey: ["calidades-produccion"],
    queryFn: async () => {
      const { data, error } = await calidadesProduccion.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  // Producción semanal: contiene las cajas por día y los campos caj_prog_XXX
  const { data: filasSemana = [], isLoading: cargandoSemana } = useQuery({
    queryKey: ["produccion-semanal-home", semana],
    queryFn: async () => {
      const { data, error } = await produccionSemanal.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Registro diario (produccion) de la fecha seleccionada → calcula estadísticas
  const { data: registros = [] } = useQuery({
    queryKey: ["produccion-registros-home"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });
  const ultimo = registros.find((r) => r.fecha === fechaSeleccionada) ?? null;
  const calculado = ultimo ? calcularDatosProceso(ultimo) : null;

  // Cajas/palet del día (produccion_cajas_palet)
  const { data: filasCajasPalet = [] } = useQuery({
    queryKey: ["produccion-cajas-palet-home", semana],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.filter({ fecha_semana: semana });
      if (error) throw error;
      return data ?? [];
    },
  });
  const cajasPaletHoy = diaActual
    ? (filasCajasPalet.find((f) => f.dia === diaActual) ?? null)
    : null;

  // Visibilidad de calidades (grupo 'ingresar_calidades')
  const { data: visibilidad = [] } = useQuery({
    queryKey: ["produccion-visibilidad"],
    queryFn: async () => {
      const { data, error } = await produccionVisibilidad.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  const codigosOcultos = new Set(
    visibilidad
      .filter((v) => v.grupo === "ingresar_calidades" && v.visible === false)
      .map((v) => v.clave)
  );
  const codigosVisibles = calidades
    .map((c) => c.codigo)
    .filter((c) => !codigosOcultos.has(c));
  const calidadPorCodigo = Object.fromEntries(calidades.map((c) => [c.codigo, c]));

  // --- Helpers de cálculo ---

  // Valor de cajas del día actual para un código (desde producción_semanal)
  const getValorDia = (codigo) => {
    if (!diaActual) return 0;
    const fila = filasSemana.find((f) => f.codigo_producto === codigo);
    return Number(fila?.[diaActual]) || 0;
  };

  // Cajas programadas del día actual (caj_prog)
  const getCajProg = (codigo) => {
    if (!diaActual) return 0;
    const fila = filasSemana.find((f) => f.codigo_producto === codigo);
    return Number(fila?.[`caj_prog_${diaActual}`]) || 0;
  };

  // Totales del día
  const totalCajasHoy = useMemo(
    () => codigosVisibles.reduce((s, c) => s + getValorDia(c), 0),
    [codigosVisibles, filasSemana, diaActual]
  );
  const totalCajProgHoy = useMemo(
    () => codigosVisibles.reduce((s, c) => s + getCajProg(c), 0),
    [codigosVisibles, filasSemana, diaActual]
  );

  // Helpers de formateo
  const redondear = (v) =>
    v === null || v === undefined || Number.isNaN(v)
      ? null
      : Math.round(v * 100) / 100;
  const porcentaje = (v) =>
    v === null || v === undefined || Number.isNaN(v)
      ? null
      : `${(v * 100).toFixed(2)}%`;

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          <Factory className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground text-sm">Resumen del día</p>
        </div>
      </div>

      {/* Selector de fecha */}
      <Card className="mb-6">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Label htmlFor="fecha-home" className="text-sm font-medium whitespace-nowrap">
            Fecha
          </Label>
          <Input
            id="fecha-home"
            type="date"
            className="sm:w-48"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Cambia la fecha para ver el resumen de ese día.
          </p>
        </CardContent>
      </Card>

      {/* Layout 2 columnas: Resumen de Producción | Datos de Proceso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Columna 1: Resumen de Producción (Caj.Prog / Calidad / Total / Dif) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Resumen de Producción
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              {diaActual
                ? `Fecha: ${fechaSeleccionada}`
                : "Selecciona una fecha de lunes a sábado."}
            </p>
          </CardHeader>
          <CardContent>
            {cargandoSemana ? (
              <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
            ) : !diaActual ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Elige una fecha de lunes a sábado para ver el resumen.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse w-full">
                  <thead>
                    <tr className="text-center text-muted-foreground border-b bg-muted/30">
                      <th className="py-2 px-2 whitespace-nowrap">Caj.Prog</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Código</th>
                      <th className="py-2 px-3 text-left whitespace-nowrap">Calidad</th>
                      <th className="py-2 px-2 whitespace-nowrap">Total</th>
                      <th className="py-2 px-2 whitespace-nowrap">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codigosVisibles.map((codigo) => {
                      const total = getValorDia(codigo);
                      const cajProg = getCajProg(codigo);
                      const dif = total - cajProg;
                      return (
                        <tr key={codigo} className="border-b last:border-0">
                          <td className="py-1.5 px-2 text-center text-muted-foreground">
                            {cajProg || "—"}
                          </td>
                          <td className="py-1.5 px-3 font-medium whitespace-nowrap">
                            {calidadPorCodigo[codigo]?.codigo_corto ?? "—"}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap">
                            {calidadPorCodigo[codigo]?.label ?? codigo}
                          </td>
                          <td className="py-1.5 px-2 text-center font-semibold">
                            {total || "—"}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {dif !== 0 ? dif : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="py-2 px-2 text-center">{totalCajProgHoy || "—"}</td>
                      <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                      <td className="py-2 px-2 text-center">{totalCajasHoy || "—"}</td>
                      <td className="py-2 px-2 text-center">
                        {totalCajasHoy - totalCajProgHoy !== 0
                          ? totalCajasHoy - totalCajProgHoy
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Columna 2: Datos de Proceso (readonly, calculados del registro diario) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTree className="w-4 h-4" />
              Datos de Proceso
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              {ultimo
                ? `Registro del ${ultimo.fecha}`
                : "Sin registro para esta fecha."}
            </p>
          </CardHeader>
          <CardContent>
            {!ultimo ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No hay registro guardado para esta fecha. Ingresa datos en "Ingresar Datos".
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  <FilaStat label="Total Cajas" valor={redondear(calculado?.cajasTotal)} />
                  <FilaStat
                    label="Total Paletas"
                    valor={cajasPaletHoy?.palet ?? "—"}
                  />
                  <FilaStat label="Cajas Tercera" valor={ultimo.cajas_tercera} />
                  <FilaStat label="Rac. Cosechados" valor={ultimo.racimos_cosechados} />
                  <FilaStat label="Racimos Rechazados" valor={ultimo.racimos_rechazados} />
                  <FilaStat label="Racimos Procesados" valor={calculado?.racimosProcesados} />
                  <FilaStat label="Área Cosecha Día" valor={ultimo.acres} />
                  <FilaStat label="Factor Primera" valor={redondear(calculado?.factorPrimera)} />
                  <FilaStat label="Factor General" valor={redondear(calculado?.factorGeneral)} />
                  <FilaStat
                    label="DESPERDICIO RAC. RECH."
                    valor={porcentaje(calculado?.desperdicioMonte)}
                  />
                  <FilaStat
                    label="Desperdicio Real"
                    valor={porcentaje(calculado?.desperdicioGeneral)}
                  />
                  <FilaStat
                    label="Rechazo en Camión (Quintal)"
                    valor={ultimo.quintales_rechazo}
                  />
                  <FilaStat label="Calibre" valor={ultimo.calibre} />
                  <FilaStat label="Cuadrilla" valor={ultimo.cuadrilla} />
                  <FilaStat label="Empaque" valor={ultimo.empaque} />
                  <FilaStat label="Hrs. Trabajadas" valor={redondear(calculado?.horasTrabajadas)} />
                  <FilaStat label="Cajas Hora" valor={redondear(calculado?.cajasHora)} />
                  <FilaStat label="Cajas Persona" valor={redondear(calculado?.cajasPersona)} />
                  <FilaStat label="Peso Racimo" valor={redondear(calculado?.pesoRacimo)} />
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
