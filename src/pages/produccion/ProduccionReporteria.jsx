import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { produccion, produccionCajasPalet } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { calcularDatosProceso, calcularDatosProcesoAgregado } from "@/lib/produccionCalc";
import { exportStyledExcel } from "@/utils/excelExport";

// Reportería v1: tabla diaria con todos los campos verificados. Los 3
// reportes del boceto (general por día/semana/mes/año, producción por
// día/semana/mes/año, gráficas) se agregarán sobre esta misma fuente de
// datos una vez confirmadas las fórmulas restantes con el cliente.

// Lunes de la semana que contiene `fechaStr` — mismo criterio que usa
// "Ingresar Datos" (lunesDeSemanaDe en ProduccionIngresar.jsx), para que
// las semanas del Resumen Semanal calcen exactamente con esa página.
function lunesDeSemanaDe(fechaStr) {
  const fecha = new Date(fechaStr + "T00:00:00");
  const diaSemana = fecha.getDay(); // 0 = domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diff);
  return lunes.toISOString().slice(0, 10);
}

// Número de semana calendario (ISO 8601) del lunes recibido.
function numeroSemanaISO(lunesStr) {
  const d = new Date(lunesStr + "T00:00:00");
  const diaNum = d.getDay() || 7; // lunes=1 ... domingo=7
  d.setDate(d.getDate() + 4 - diaNum); // jueves de esa misma semana
  const inicioAno = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - inicioAno) / 86400000 + 1) / 7);
}

// Agrupa los registros diarios por semana (lunes a sábado) y suma el
// Total Palet correspondiente desde produccion_cajas_palet.
function agruparPorSemana(registros, filasCajasPalet) {
  const grupos = {};
  registros.forEach((r) => {
    if (!r.fecha) return;
    const lunes = lunesDeSemanaDe(r.fecha);
    if (!grupos[lunes]) grupos[lunes] = [];
    grupos[lunes].push(r);
  });

  return Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunes, filas]) => {
      const totalPalet = filasCajasPalet
        .filter((cp) => cp.fecha_semana === lunes)
        .reduce((acc, cp) => acc + (Number(cp.palet) || 0), 0);
      return {
        lunes,
        semanaNum: numeroSemanaISO(lunes),
        totalPalet,
        ...calcularDatosProcesoAgregado(filas),
      };
    });
}

export default function ProduccionReporteria() {
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["produccion-registros"],
    queryFn: async () => {
      const { data, error } = await produccion.list("-fecha");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: filasCajasPalet = [] } = useQuery({
    queryKey: ["produccion-cajas-palet-historial"],
    queryFn: async () => {
      const { data, error } = await produccionCajasPalet.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const [vista, setVista] = useState("diario"); // "diario" | "semanal"

  const resumenSemanal = useMemo(
    () => agruparPorSemana(registros, filasCajasPalet),
    [registros, filasCajasPalet]
  );

  const handleExportar = () => {
    if (registros.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = [
      "Fecha", "Rac. Cosech.", "Rac. Rechaz.", "Rac. Procesados",
      "Cajas 1ra", "Cajas 2da", "Cajas Tercera",
      "Hrs. Trabajadas", "Cajas/Hora", "Cajas/Persona",
    ];
    const rows = registros.map((r) => {
      const c = calcularDatosProceso(r);
      return [
        r.fecha,
        r.racimos_cosechados ?? "",
        r.racimos_rechazados ?? "",
        c.racimosProcesados,
        r.cajas_primera ?? "",
        r.cajas_segunda ?? "",
        r.cajas_tercera ?? "",
        c.horasTrabajadas.toFixed(1),
        c.cajasHora.toFixed(1),
        c.cajasPersona.toFixed(2),
      ];
    });
    exportStyledExcel({
      title: "Reportería de Producción — Histórico Diario",
      headers,
      rows,
      sheetName: "Reporteria",
      fileName: `reporteria_produccion_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Reportería de Producción</h1>
            <p className="text-muted-foreground text-sm">
              {vista === "diario" ? "Histórico diario" : "Resumen semanal"}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportar}>
          <Download className="w-4 h-4" />
          Exportar a Excel
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={vista === "diario" ? "default" : "outline"} onClick={() => setVista("diario")}>
          Diario
        </Button>
        <Button size="sm" variant={vista === "semanal" ? "default" : "outline"} onClick={() => setVista("semanal")}>
          Resumen Semanal
        </Button>
      </div>

      {vista === "diario" && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registros ({registros.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
          ) : registros.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hay registros aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Rac. Cosech.</th>
                    <th className="py-2 pr-3">Rac. Rechaz.</th>
                    <th className="py-2 pr-3">Rac. Procesados</th>
                    <th className="py-2 pr-3">Cajas 1ra</th>
                    <th className="py-2 pr-3">Cajas 2da</th>
                    <th className="py-2 pr-3">Cajas Tercera</th>
                    <th className="py-2 pr-3">Hrs. Trabajadas</th>
                    <th className="py-2 pr-3">Cajas/Hora</th>
                    <th className="py-2 pr-3">Cajas/Persona</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => {
                    const c = calcularDatosProceso(r);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-medium">{r.fecha}</td>
                        <td className="py-2 pr-3">{r.racimos_cosechados ?? "—"}</td>
                        <td className="py-2 pr-3">{r.racimos_rechazados ?? "—"}</td>
                        <td className="py-2 pr-3">{c.racimosProcesados}</td>
                        <td className="py-2 pr-3">{r.cajas_primera ?? "—"}</td>
                        <td className="py-2 pr-3">{r.cajas_segunda ?? "—"}</td>
                        <td className="py-2 pr-3">{r.cajas_tercera ?? "—"}</td>
                        <td className="py-2 pr-3">{c.horasTrabajadas.toFixed(1)}</td>
                        <td className="py-2 pr-3">{c.cajasHora.toFixed(1)}</td>
                        <td className="py-2 pr-3">{c.cajasPersona.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {vista === "semanal" && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen Semanal ({resumenSemanal.length} semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          {resumenSemanal.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No hay datos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30">
                    <th className="py-2 px-2" rowSpan={2}>Sem</th>
                    <th className="py-1 px-2 border-b" colSpan={7}>Racimos y Cajas</th>
                    <th className="py-1 px-2 border-b" colSpan={3}>Factores</th>
                    <th className="py-1 px-2 border-b" colSpan={2}>Desperdicio</th>
                    <th className="py-1 px-2 border-b" colSpan={2}>Días y Hrs</th>
                  </tr>
                  <tr className="text-center text-muted-foreground border-b bg-muted/30 text-xs">
                    <th className="py-2 px-2 whitespace-nowrap">Rac. Cosech.</th>
                    <th className="py-2 px-2 whitespace-nowrap">Rac. Rechaz.</th>
                    <th className="py-2 px-2 whitespace-nowrap">Rac. Procesados</th>
                    <th className="py-2 px-2 whitespace-nowrap">Total Cajas 1ra y 2da</th>
                    <th className="py-2 px-2 whitespace-nowrap">Cajas 1ra</th>
                    <th className="py-2 px-2 whitespace-nowrap">Cajas Tercera</th>
                    <th className="py-2 px-2 whitespace-nowrap">Total Palet</th>
                    <th className="py-2 px-2 whitespace-nowrap">F. General</th>
                    <th className="py-2 px-2 whitespace-nowrap">F. Aprovech.</th>
                    <th className="py-2 px-2 whitespace-nowrap">F. Potencial</th>
                    <th className="py-2 px-2 whitespace-nowrap">% Desperdicio</th>
                    <th className="py-2 px-2 whitespace-nowrap">Peso Racimo</th>
                    <th className="py-2 px-2 whitespace-nowrap">Horas Planta</th>
                    <th className="py-2 px-2 whitespace-nowrap">Días Planta</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenSemanal.map((s) => (
                    <tr key={s.lunes} className="border-b last:border-0 hover:bg-muted/30 text-center">
                      <td className="py-2 px-2 font-medium">{s.semanaNum}</td>
                      <td className="py-2 px-2">{s.racimosCosechados}</td>
                      <td className="py-2 px-2">{s.racimosRechazados}</td>
                      <td className="py-2 px-2">{s.racimosProcesados}</td>
                      <td className="py-2 px-2">{s.cajasTotal}</td>
                      <td className="py-2 px-2">{s.cajasPrimera}</td>
                      <td className="py-2 px-2">{s.cajasTercera}</td>
                      <td className="py-2 px-2">{s.totalPalet || "—"}</td>
                      <td className="py-2 px-2">{s.factorGeneral.toFixed(2)}</td>
                      <td className="py-2 px-2">{s.factorAprovechamiento.toFixed(2)}</td>
                      <td className="py-2 px-2">{s.factorPotencial.toFixed(2)}</td>
                      <td className="py-2 px-2">{(s.desperdicioGeneral * 100).toFixed(2)}%</td>
                      <td className="py-2 px-2">{s.pesoRacimo.toFixed(2)}</td>
                      <td className="py-2 px-2">{s.horasTrabajadas.toFixed(1)}</td>
                      <td className="py-2 px-2">{s.diasPlanta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
