import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, seccionAgricola, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Download, Filter, Grid3x3, CalendarDays } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportStyledExcel } from "@/utils/excelExport";

const ACRES_TO_HA = 0.404686;

// Labores cuyo campo "acres" en realidad representa un conteo de racimos
// (no acreaje real) — confirmado contra el export de la app original, donde
// estas dos labores siempre guardaron hectareas = 0 aunque "acres" tuviera
// valor. Para mantener consistencia con el dato original, se fuerza 0 aquí
// en vez de calcular acres * ACRES_TO_HA.
const LABORES_SIN_HECTAREAS = new Set(["EMBOLSE", "EMBOLSE-2026"]);

function calcularHectareas(r) {
  if (LABORES_SIN_HECTAREAS.has(r.labor_nombre)) return 0;
  return (r.acres || 0) * ACRES_TO_HA;
}

// Orden fijo solicitado para las tarjetas de labor en Reportería (pestaña
// "Registros" y el Excel descargable). Las labores que no estén en esta
// lista se muestran al final, en el orden en que aparezcan los datos.
// Comparación case-insensitive porque "resiembra" está en minúsculas en la
// base de datos mientras el resto de labores están en mayúsculas.
const ORDEN_LABORES = [
  "EMBOLSE",
  "PODA",
  "FERTILIZACION",
  "FERTILIZACION-2026",
  "SIGATOKA-2026",
  "RESIEMBRA-2026",
  "EMBOLSE-2026",
  "RESIEMBRA",
  "REP. LLUVIA",
  "EMBOLSE 2026",
  "PODA-DESHIJE-2026",
];

function ordenarPorLabor(entries) {
  return [...entries].sort((a, b) => {
    const idxA = ORDEN_LABORES.indexOf(a[0].toUpperCase());
    const idxB = ORDEN_LABORES.indexOf(b[0].toUpperCase());
    const posA = idxA === -1 ? ORDEN_LABORES.length : idxA;
    const posB = idxB === -1 ? ORDEN_LABORES.length : idxB;
    return posA - posB;
  });
}

function getWeek(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

export default function ReporteLaborAgricola() {
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroLabor, setFiltroLabor] = useState("");
  const [filtroSemana, setFiltroSemana] = useState("");
  const [filtroSeccion, setFiltroSeccion] = useState("");
  const [filtroCiclo, setFiltroCiclo] = useState("");
  const [descargando, setDescargando] = useState(false);

  const { data: registros = [], isLoading: loadingRegistros } = useQuery({
    queryKey: ["registros-labor-reporte"],
    queryFn: async () => {
      const { data, error } = await supabase.from("registros_labor").select("*").order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: labores = [], isLoading: loadingLabores } = useQuery({
    queryKey: ["labores-agricolas-reporte"],
    queryFn: async () => {
      const { data, error } = await laborAgricola.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: secciones = [], isLoading: loadingSecciones } = useQuery({
    queryKey: ["secciones-agricolas-reporte"],
    queryFn: async () => {
      const { data, error } = await seccionAgricola.list("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Para la sección de Tablas
  const [laborSeleccionado, setLaborSeleccionado] = useState("");
  const [descargandoTabla, setDescargandoTabla] = useState(false);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      let cumple = true;
      
      if (filtroFechaInicio && r.fecha < filtroFechaInicio) cumple = false;
      if (filtroFechaFin && r.fecha > filtroFechaFin) cumple = false;
      if (filtroLabor && r.labor_id !== filtroLabor) cumple = false;
      if (filtroSemana && r.semana !== parseInt(filtroSemana)) cumple = false;
      if (filtroSeccion && r.seccion_id !== filtroSeccion) cumple = false;
      if (filtroCiclo && r.ciclo !== parseInt(filtroCiclo)) cumple = false;
      
      return cumple;
    });
  }, [registros, filtroFechaInicio, filtroFechaFin, filtroLabor, filtroSemana, filtroSeccion, filtroCiclo]);

  const registrosPorLabor = useMemo(() => {
    const agrupad = {};
    registrosFiltrados.forEach((r) => {
      // Se agrupa por labor_nombre (no por labor_id) porque varios registros
      // importados de la app original tienen labor_id NULL. Si se agrupara por
      // labor_id, todos los NULL colapsan en una sola clave "null" y mezclan
      // labores distintas (ej: PODA, FERTILIZACION, resiembra, etc. aparecían
      // juntas bajo una sola tarjeta). labor_nombre siempre viene poblado.
      const clave = r.labor_nombre;
      if (!agrupad[clave]) {
        agrupad[clave] = { nombre: r.labor_nombre, registros: [] };
      }
      agrupad[clave].registros.push(r);
    });
    return agrupad;
  }, [registrosFiltrados]);

  // Tabla por Labor: Secciones (vertical) x Semanas (horizontal)
  const laborPorSemana = useMemo(() => {
    const activeLabores = labores.filter(l => l.activa !== false);
    const semanas = [...new Set(registros.map(r => r.semana))].filter(Boolean).sort((a, b) => a - b);
    const seccionesActivas = secciones.filter(s => s.activa !== false);

    // Por labor: { [seccion_id]: { [semana]: { acres, extra } } }
    const porLabor = {};
    activeLabores.forEach(l => {
      porLabor[l.id] = {};
    });
    registros.forEach(r => {
      if (!porLabor[r.labor_id]) return;
      if (!porLabor[r.labor_id][r.seccion_id]) {
        porLabor[r.labor_id][r.seccion_id] = { nombre: r.seccion_nombre };
      }
      if (!porLabor[r.labor_id][r.seccion_id][r.semana]) {
        porLabor[r.labor_id][r.seccion_id][r.semana] = { acres: 0, extra: 0 };
      }
      porLabor[r.labor_id][r.seccion_id][r.semana].acres += r.acres || 0;
      porLabor[r.labor_id][r.seccion_id][r.semana].extra += r.unidad_extra_valor || 0;
    });

    return { labores: activeLabores, semanas, secciones: seccionesActivas, porLabor };
  }, [registros, labores, secciones]);

  const handleDescargarLaborSemana = () => {
    const { labores: activeLabores, semanas, secciones: secc, porLabor } = laborPorSemana;
    activeLabores.forEach(labor => {
      const datosLabor = porLabor[labor.id] || {};
      const seccionesConDatos = secc.filter(s => datosLabor[s.id]);
      if (seccionesConDatos.length === 0) return;
      const headers = ["Sección", ...semanas.map(s => `Sem ${s}`), "Total"];
      const rows = seccionesConDatos.map(s => {
        const total = semanas.reduce((sum, sem) => sum + (datosLabor[s.id]?.[sem]?.acres || 0), 0);
        return [
          s.nombre,
          ...semanas.map(sem => {
            const d = datosLabor[s.id]?.[sem];
            return d?.acres > 0 ? d.acres.toFixed(2) : "";
          }),
          total > 0 ? total.toFixed(2) : "",
        ];
      });
      const totalsRow = ["TOTAL",
        ...semanas.map(sem => {
          const t = seccionesConDatos.reduce((sum, s) => sum + (datosLabor[s.id]?.[sem]?.acres || 0), 0);
          return t > 0 ? t.toFixed(2) : "";
        }),
        seccionesConDatos.reduce((sum, s) => sum + semanas.reduce((s2, sem) => s2 + (datosLabor[s.id]?.[sem]?.acres || 0), 0), 0).toFixed(2),
      ];
      exportStyledExcel({
        title: `${labor.nombre} — Secciones por Semana`,
        headers,
        rows,
        totalsRow,
        sheetName: labor.nombre.slice(0, 30),
        fileName: `${labor.nombre.replace(/\s+/g, "-")}-semanas-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
    });
  };

  // Para tabla matriz secciones x ciclos
  const laborActualSeleccionado = labores.find(l => l.id === laborSeleccionado);
  const registrosLaborSeleccionado = useMemo(() => {
    if (!laborSeleccionado) return [];
    return registros.filter(r => r.labor_id === laborSeleccionado);
  }, [registros, laborSeleccionado]);

  const matrizDatos = useMemo(() => {
    if (!laborActualSeleccionado) return null;
    
    const ciclos = Array.from({ length: laborActualSeleccionado.num_ciclos || 9 }, (_, i) => i + 1);
    const seccionesActivas = secciones.filter(s => s.activa !== false);
    
    const matriz = {};
    registrosLaborSeleccionado.forEach((r) => {
      const key = `${r.seccion_id}_${r.ciclo}`;
      if (!matriz[key]) {
        matriz[key] = { seccion: r.seccion_nombre, acres: 0, ciclo: r.ciclo };
      }
      matriz[key].acres += r.acres || 0;
    });

    const totalAcres = seccionesActivas.reduce((sum, s) => sum + (s.acres || 0), 0);

    return {
      ciclos,
      secciones: seccionesActivas,
      matriz,
      totalAcres,
    };
  }, [laborActualSeleccionado, registrosLaborSeleccionado, secciones]);

  const handleDescargarTablaMatriz = async () => {
    if (!matrizDatos) return;
    
    setDescargandoTabla(true);
    const { ciclos, secciones: secc, matriz } = matrizDatos;

    // Preparar datos para exportStyledExcel
    const headers = ["Secc./Ac.", ...ciclos.map((c) => `C${c}`)];
    const rows = secc.map((s) => [
      `${s.nombre}\n${s.acres} ac`,
      ...ciclos.map((c) => {
        const key = `${s.id}_${c}`;
        const val = matriz[key]?.acres || 0;
        return val > 0 ? val : "";
      }),
    ]);
    const totalsRow = [
      "TOTAL",
      ...ciclos.map((c) => {
        const total = secc.reduce((sum, s) => {
          const key = `${s.id}_${c}`;
          return sum + (matriz[key]?.acres || 0);
        }, 0);
        return total > 0 ? total.toFixed(2) : "";
      }),
    ];

    exportStyledExcel({
      title: `Tabla de Labor - ${laborActualSeleccionado.nombre}`,
      headers,
      rows,
      totalsRow,
      sheetName: laborActualSeleccionado.nombre,
      fileName: `tabla-labor-${laborActualSeleccionado.nombre.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    });

    setDescargandoTabla(false);
  };

  const handleDescargarExcel = async () => {
    setDescargando(true);
    
    // Crear hoja con registros filtrados por labor (orden fijo, ver ORDEN_LABORES)
    ordenarPorLabor(Object.entries(registrosPorLabor)).forEach(([laborId, { nombre, registros: regs }]) => {
      const headers = ["Fecha", "Semana", "Sección", "Minifinca", "Ciclo", "Acres", "Hectáreas"];
      const rows = regs.map((r) => [
        r.fecha,
        r.semana,
        r.seccion_nombre,
        r.minifinca || "—",
        r.ciclo,
        r.acres,
        calcularHectareas(r).toFixed(4),
      ]);
      const totalsRow = [
        "TOTAL",
        "",
        "",
        "",
        "",
        regs.reduce((sum, r) => sum + (r.acres || 0), 0).toFixed(2),
        regs.reduce((sum, r) => sum + calcularHectareas(r), 0).toFixed(4),
      ];

      exportStyledExcel({
        title: `Registros de Labor - ${nombre}`,
        headers,
        rows,
        totalsRow,
        sheetName: nombre.slice(0, 30),
        fileName: `registros-${nombre.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
    });

    setDescargando(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Reportería</h1>
          <p className="text-muted-foreground text-sm">Descarga reportes profesionales de labores agrícolas</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="registros" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="registros" className="gap-2">
            <Filter className="w-4 h-4" /> Registros
          </TabsTrigger>
          <TabsTrigger value="tablas" className="gap-2">
            <Grid3x3 className="w-4 h-4" /> Tablas por Labor
          </TabsTrigger>
          <TabsTrigger value="semanas" className="gap-2">
            <CalendarDays className="w-4 h-4" /> Labor por Semana
          </TabsTrigger>
        </TabsList>

      <TabsContent value="registros">
      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fecha-inicio" className="text-xs">Fecha Inicio</Label>
              <Input
                id="fecha-inicio"
                type="date"
                value={filtroFechaInicio}
                onChange={(e) => setFiltroFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha-fin" className="text-xs">Fecha Fin</Label>
              <Input
                id="fecha-fin"
                type="date"
                value={filtroFechaFin}
                onChange={(e) => setFiltroFechaFin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labor" className="text-xs">Labor</Label>
              <select
                id="labor"
                value={filtroLabor}
                onChange={(e) => setFiltroLabor(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                {labores.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semana" className="text-xs">Semana</Label>
              <Input
                id="semana"
                type="number"
                min="1"
                max="53"
                placeholder="1-53"
                value={filtroSemana}
                onChange={(e) => setFiltroSemana(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seccion" className="text-xs">Sección</Label>
              <select
                id="seccion"
                value={filtroSeccion}
                onChange={(e) => setFiltroSeccion(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todas</option>
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciclo" className="text-xs">Ciclo</Label>
              <Input
                id="ciclo"
                type="number"
                min="1"
                max="53"
                placeholder="1-53"
                value={filtroCiclo}
                onChange={(e) => setFiltroCiclo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setFiltroFechaInicio("");
                setFiltroFechaFin("");
                setFiltroLabor("");
                setFiltroSemana("");
                setFiltroSeccion("");
                setFiltroCiclo("");
              }}
              variant="outline"
              className="text-xs"
            >
              Limpiar Filtros
            </Button>
            <Button
              onClick={handleDescargarExcel}
              disabled={registrosFiltrados.length === 0 || descargando}
              className="text-xs gap-2"
            >
              <Download className="w-4 h-4" />
              {descargando ? "Generando..." : "Descargar Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tablas por Labor */}
      {loadingRegistros || loadingLabores || loadingSecciones ? (
        <p className="text-xs text-muted-foreground text-center py-8">Cargando...</p>
      ) : registrosFiltrados.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Sin registros para los filtros seleccionados.</p>
      ) : (
        <div className="space-y-6">
          {ordenarPorLabor(Object.entries(registrosPorLabor)).map(([laborId, { nombre, registros: regs }]) => {
            const totalAcres = regs.reduce((sum, r) => sum + (r.acres || 0), 0);
            // hectareas se calcula desde acres porque registros_labor no tiene columna "hectareas"
            // (excepto EMBOLSE/EMBOLSE-2026, ver calcularHectareas)
            const totalHectareas = regs.reduce((sum, r) => sum + calcularHectareas(r), 0);
            
            return (
              <Card key={laborId} className="overflow-hidden">
                <div className="bg-green-900 text-white px-6 py-4">
                  <h2 className="text-lg font-bold">{nombre.toUpperCase()}</h2>
                </div>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#2d5016" }}>
                        <th className="px-4 py-3 text-left font-bold text-white border border-gray-300">Fecha</th>
                        <th className="px-4 py-3 text-center font-bold text-white border border-gray-300">Semana</th>
                        <th className="px-4 py-3 text-left font-bold text-white border border-gray-300">Sección</th>
                        <th className="px-4 py-3 text-left font-bold text-white border border-gray-300">Minifinca</th>
                        <th className="px-4 py-3 text-center font-bold text-white border border-gray-300">Ciclo</th>
                        <th className="px-4 py-3 text-center font-bold text-white border border-gray-300">Acres</th>
                        <th className="px-4 py-3 text-center font-bold text-white border border-gray-300">Hectáreas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regs.map((r, idx) => (
                        <tr key={r.id} style={{ backgroundColor: idx % 2 === 0 ? "#f5f5f5" : "#ffffff" }}>
                          <td className="px-4 py-2.5 border border-gray-300">{r.fecha}</td>
                          <td className="px-4 py-2.5 border border-gray-300 text-center text-muted-foreground">Sem. {r.semana}</td>
                          <td className="px-4 py-2.5 border border-gray-300 font-medium">{r.seccion_nombre}</td>
                          <td className="px-4 py-2.5 border border-gray-300 text-muted-foreground">{r.minifinca || "—"}</td>
                          <td className="px-4 py-2.5 border border-gray-300 text-center">{r.ciclo}</td>
                          <td className="px-4 py-2.5 border border-gray-300 text-center font-semibold">{r.acres}</td>
                          {/* registros_labor no tiene columna "hectareas" — se calcula desde acres
                              usando ACRES_TO_HA, excepto EMBOLSE/EMBOLSE-2026 (ver calcularHectareas). */}
                          <td className="px-4 py-2.5 border border-gray-300 text-center">{calcularHectareas(r).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: "#558B2F" }}>
                        <td colSpan="5" className="px-4 py-3 text-right font-bold text-white border border-gray-300">TOTAL</td>
                        <td className="px-4 py-3 text-center font-bold text-white border border-gray-300">{totalAcres.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-bold text-white border border-gray-300">{totalHectareas.toFixed(4)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </TabsContent>

      <TabsContent value="tablas">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-primary" /> Selecciona una Labor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="labor-tabla" className="text-sm">Labor</Label>
                <select
                  id="labor-tabla"
                  value={laborSeleccionado}
                  onChange={(e) => setLaborSeleccionado(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Seleccionar una labor...</option>
                  {labores.filter(l => l.activa !== false).map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              {laborSeleccionado && (
                <Button
                  onClick={handleDescargarTablaMatriz}
                  disabled={descargandoTabla}
                  className="gap-2 w-full"
                >
                  <Download className="w-4 h-4" />
                  {descargandoTabla ? "Generando..." : "Descargar Tabla a Excel"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {laborSeleccionado && matrizDatos && (
          <Card>
            <div className="bg-green-900 text-white px-6 py-4">
              <h2 className="text-lg font-bold">{laborActualSeleccionado.nombre.toUpperCase()}</h2>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: "800px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#2d5016" }}>
                    <th className="px-4 py-3 text-left font-bold text-white border border-gray-400" style={{ minWidth: "120px" }}>Secc./Ac.</th>
                    {matrizDatos.ciclos.map((c) => (
                      <th key={c} className="px-3 py-3 text-center font-bold text-white border border-gray-400" style={{ minWidth: "80px" }}>
                        C{c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrizDatos.secciones.map((s) => (
                    <tr key={s.id} style={{ backgroundColor: "#FFFFFF" }}>
                      <td className="px-4 py-2.5 border border-gray-300 font-medium bg-gray-50">
                        <div>{s.nombre}</div>
                        <div className="text-xs text-muted-foreground">{s.acres} ac</div>
                      </td>
                      {matrizDatos.ciclos.map((c) => {
                        const key = `${s.id}_${c}`;
                        const valor = matrizDatos.matriz[key]?.acres || 0;
                        const bgColor = valor > 0 ? (valor > 100 ? "#FCE4EC" : "#E8F5E9") : "#FFFFFF";
                        
                        return (
                          <td
                            key={c}
                            className="px-3 py-2.5 border border-gray-300 text-center"
                            style={{ backgroundColor: bgColor }}
                          >
                            {valor > 0 ? valor.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#558B2F" }}>
                    <td className="px-4 py-3 font-bold text-white border border-gray-400">TOTAL</td>
                    {matrizDatos.ciclos.map((c) => {
                      const total = matrizDatos.secciones.reduce((sum, s) => {
                        const key = `${s.id}_${c}`;
                        return sum + (matrizDatos.matriz[key]?.acres || 0);
                      }, 0);
                      
                      return (
                        <td key={c} className="px-3 py-3 text-center font-bold text-white border border-gray-400">
                          {total > 0 ? total.toFixed(2) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* TAB: Labor por Semana — una tabla por labor, secciones vertical, semanas horizontal */}
      <TabsContent value="semanas">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <p className="text-sm text-muted-foreground">Una tabla por labor: secciones (↕) × semanas (→)</p>
          <Button
            onClick={handleDescargarLaborSemana}
            disabled={laborPorSemana.semanas.length === 0}
            className="gap-2 text-xs"
            size="sm"
          >
            <Download className="w-4 h-4" /> Descargar Excel (todas las labores)
          </Button>
        </div>

        {laborPorSemana.semanas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sin registros disponibles.</p>
        ) : (
          <div className="space-y-6">
            {laborPorSemana.labores.map((labor) => {
              const datosLabor = laborPorSemana.porLabor[labor.id] || {};
              const seccionesConDatos = laborPorSemana.secciones.filter(s => datosLabor[s.id]);
              if (seccionesConDatos.length === 0) return null;
              const { semanas } = laborPorSemana;
              const tieneExtra = !!labor.unidad_extra;

              return (
                <Card key={labor.id} className="overflow-hidden">
                  <div className="bg-green-900 text-white px-6 py-3 flex items-center justify-between">
                    <h2 className="text-base font-bold">{labor.nombre.toUpperCase()}</h2>
                    {tieneExtra && (
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{labor.unidad_extra}</span>
                    )}
                  </div>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(500, semanas.length * 65 + 160)}px`, width: "100%" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#2d5016" }}>
                          <th className="px-4 py-3 text-left font-bold text-white border border-gray-400" style={{ minWidth: "140px" }}>Sección</th>
                          {semanas.map(s => (
                            <th key={s} className="px-2 py-3 text-center font-bold text-white border border-gray-400" style={{ minWidth: "60px" }}>
                              Sem {s}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center font-bold text-white border border-gray-400" style={{ minWidth: "65px" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seccionesConDatos.map((s, idx) => {
                          const datosSec = datosLabor[s.id] || {};
                          const totalAcres = semanas.reduce((sum, sem) => sum + (datosSec[sem]?.acres || 0), 0);
                          const totalExtra = semanas.reduce((sum, sem) => sum + (datosSec[sem]?.extra || 0), 0);
                          return (
                            <tr key={s.id} style={{ backgroundColor: idx % 2 === 0 ? "#f5f5f5" : "#ffffff" }}>
                              <td className="px-4 py-2.5 border border-gray-300 font-medium">
                                <div>{s.nombre}</div>
                                <div className="text-muted-foreground text-xs">{s.acres} ac</div>
                              </td>
                              {semanas.map(sem => {
                                const d = datosSec[sem];
                                const acres = d?.acres || 0;
                                const extra = d?.extra || 0;
                                return (
                                  <td key={sem} className="px-2 py-2.5 border border-gray-300 text-center" style={{ backgroundColor: acres > 0 ? "#E8F5E9" : undefined }}>
                                    {acres > 0 ? (
                                      <div>
                                        <div className="font-medium">{acres.toFixed(1)}</div>
                                        {tieneExtra && extra > 0 && (
                                          <div className="text-muted-foreground" style={{ fontSize: "10px" }}>
                                            {extra % 1 === 0 ? extra : extra.toFixed(1)} {labor.unidad_extra?.slice(0, 3)}
                                          </div>
                                        )}
                                      </div>
                                    ) : "—"}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2.5 border border-gray-400 text-center font-bold" style={{ backgroundColor: "#c8e6c9" }}>
                                <div>{totalAcres > 0 ? totalAcres.toFixed(1) : "—"}</div>
                                {tieneExtra && totalExtra > 0 && (
                                  <div className="text-muted-foreground font-normal" style={{ fontSize: "10px" }}>
                                    {totalExtra % 1 === 0 ? totalExtra : totalExtra.toFixed(1)} {labor.unidad_extra?.slice(0, 3)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: "#558B2F" }}>
                          <td className="px-4 py-3 font-bold text-white border border-gray-400">TOTAL</td>
                          {semanas.map(sem => {
                            const total = seccionesConDatos.reduce((sum, s) => sum + (datosLabor[s.id]?.[sem]?.acres || 0), 0);
                            return (
                              <td key={sem} className="px-2 py-3 text-center font-bold text-white border border-gray-400">
                                {total > 0 ? total.toFixed(1) : "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center font-bold text-white border border-gray-400">
                            {seccionesConDatos.reduce((sum, s) => sum + semanas.reduce((s2, sem) => s2 + (datosLabor[s.id]?.[sem]?.acres || 0), 0), 0).toFixed(1)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
      </Tabs>
    </div>
  );
}