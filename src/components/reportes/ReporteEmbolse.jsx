import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, auth, users, trenadas, colors, sections, inventory, losses, laborAgricola, reports } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Package, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { exportStyledExcel } from "@/utils/excelExport";
import { format, startOfWeek, parseISO } from "date-fns";

const today = format(new Date(), "yyyy-MM-dd");
const firstOfYear = `${new Date().getFullYear()}-01-01`;

const GREENS = ["#0e5c28", "#1A7A38", "#2ea84f", "#3dba60", "#57cc77", "#76d98f", "#9fe5b2"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm min-w-[140px]">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{Number(p.value).toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

function DateFilter({ desde, hasta, onDesde, onHasta, total, totalLabel }) {
  return (
    <div className="flex items-end gap-4 flex-wrap bg-muted/50 rounded-lg p-3">
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Input type="date" value={desde} onChange={e => onDesde(e.target.value)} className="w-40 h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Input type="date" value={hasta} onChange={e => onHasta(e.target.value)} className="w-40 h-8 text-sm" />
      </div>
      <span className="inline-flex items-center bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium text-sm">
        Total: {Number(total).toLocaleString()} {totalLabel}
      </span>
    </div>
  );
}

// ── GRÁFICA 1: Embolse por semana con filtro por año y selección de semanas ──
function GraficaEmbolse({ embolses, loading }) {
  const currentYear = new Date().getFullYear();
  const [anio, setAnio] = useState(String(currentYear));
  const [showSelector, setShowSelector] = useState(false);
  const [semanasSeleccionadas, setSemanasSeleccionadas] = useState(new Set());

  // Todas las semanas disponibles para el año seleccionado
  const semanasDisponibles = useMemo(() => {
    const set = new Set();
    embolses.forEach(e => {
      // Filtrar por año si el embolse tiene fecha de creación, si no, mostrar todas
      set.add(e.semana);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [embolses]);

  // Inicializar selección con todas las semanas cuando cambian
  useEffect(() => {
    setSemanasSeleccionadas(new Set(semanasDisponibles));
  }, [semanasDisponibles.join(",")]);

  const toggleSemana = (s) => {
    setSemanasSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleTodas = () => {
    if (semanasSeleccionadas.size === semanasDisponibles.length) {
      setSemanasSeleccionadas(new Set());
    } else {
      setSemanasSeleccionadas(new Set(semanasDisponibles));
    }
  };

  const data = useMemo(() => {
    const map = {};
    embolses.forEach(e => {
      const k = e.semana;
      if (!semanasSeleccionadas.has(k)) return;
      if (!map[k]) map[k] = { semana: k, label: `S${k}`, total: 0 };
      map[k].total += e.total || 0;
    });
    return Object.values(map).sort((a, b) => a.semana - b.semana);
  }, [embolses, semanasSeleccionadas]);

  const total = data.reduce((s, d) => s + d.total, 0);

  const handleExport = () => exportStyledExcel({
    title: "Total de Embolse por Semana",
    sheetName: "Embolse",
    fileName: "embolse_por_semana.xlsx",
    headers: ["Semana", "Total Embolsado"],
    rows: data.map(d => [`Semana ${d.semana}`, d.total]),
    totalsRow: ["TOTAL", total],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-2">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <CardTitle className="font-heading text-base">Total de Embolse por Semana</CardTitle>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-md font-medium text-sm">
            Total: {total.toLocaleString()}
          </span>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={data.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selector de semanas */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSelector(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors"
          >
            <span>
              Semanas seleccionadas: {semanasSeleccionadas.size} / {semanasDisponibles.length}
            </span>
            {showSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSelector && (
            <div className="p-3 space-y-3 bg-background">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTodas}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  {semanasSeleccionadas.size === semanasDisponibles.length ? "Deseleccionar todas" : "Seleccionar todas"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {semanasDisponibles.map(s => {
                  const activa = semanasSeleccionadas.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSemana(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        activa
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      Sem. {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sin datos para las semanas seleccionadas</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} height={36} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" name="Embolsado" radius={[5, 5, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={GREENS[i % GREENS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── GRÁFICA 2: Racimos cosechados por semana (filtrable por fecha) ─────────
function GraficaCosecha({ trenadas, loading }) {
  const [desde, setDesde] = useState(firstOfYear);
  const [hasta, setHasta] = useState(today);

  const data = useMemo(() => {
    const from = parseISO(desde);
    const to = parseISO(hasta);
    const map = {};
    trenadas
      .filter(t => t.fecha && parseISO(t.fecha) >= from && parseISO(t.fecha) <= to)
      .forEach(t => {
        const ws = startOfWeek(parseISO(t.fecha), { weekStartsOn: 1 });
        const key = format(ws, "yyyy-MM-dd");
        const label = format(ws, "dd/MM");
        if (!map[key]) map[key] = { key, label, racimos: 0 };
        map[key].racimos += t.total_racimos || 0;
      });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [trenadas, desde, hasta]);

  const total = data.reduce((s, d) => s + d.racimos, 0);

  const handleExport = () => exportStyledExcel({
    title: `Racimos Cosechados por Semana (${desde} — ${hasta})`,
    sheetName: "Cosecha",
    fileName: "cosecha_por_semana.xlsx",
    headers: ["Semana (inicio)", "Total Racimos"],
    rows: data.map(d => [d.label, d.racimos]),
    totalsRow: ["TOTAL", total],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <CardTitle className="font-heading text-base">Racimos Cosechados por Semana</CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={data.length === 0}>
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateFilter desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} total={total} totalLabel="racimos" />
        {loading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sin datos en el rango seleccionado</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} height={36} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="racimos" name="Racimos"
                stroke="#1A7A38" strokeWidth={3}
                dot={{ r: 5, fill: "#1A7A38", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── GRÁFICA 3: Pérdidas por semana (filtrable por fecha) ───────────────────
function GraficaPerdidas({ loading }) {
  const [desde, setDesde] = useState(firstOfYear);
  const [hasta, setHasta] = useState(today);

  const { data: perdidas = [], isLoading: loadingP } = useQuery({
    queryKey: ["perdidas-reporte"],
    queryFn: async () => {
  const { data, error } = await losses.list();
  if (error) throw error;
  return data ?? [];
},
  });

  const data = useMemo(() => {
    const from = parseISO(desde);
    const to = parseISO(hasta);
    const map = {};
    perdidas
      .filter(p => p.fecha && parseISO(p.fecha) >= from && parseISO(p.fecha) <= to)
      .forEach(p => {
        const ws = startOfWeek(parseISO(p.fecha), { weekStartsOn: 1 });
        const key = format(ws, "yyyy-MM-dd");
        const label = format(ws, "dd/MM");
        if (!map[key]) map[key] = { key, label, perdidas: 0 };
        map[key].perdidas += p.cantidad || 0;
      });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [perdidas, desde, hasta]);

  const total = data.reduce((s, d) => s + d.perdidas, 0);

  const handleExport = () => exportStyledExcel({
    title: `Pérdidas por Semana (${desde} — ${hasta})`,
    sheetName: "Perdidas",
    fileName: "perdidas_por_semana.xlsx",
    headers: ["Semana (inicio)", "Total Pérdidas"],
    rows: data.map(d => [d.label, d.perdidas]),
    totalsRow: ["TOTAL", total],
  });

  const isLoading = loading || loadingP;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <CardTitle className="font-heading text-base">Pérdidas por Semana</CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={data.length === 0}>
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateFilter desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} total={total} totalLabel="pérdidas" />
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sin pérdidas en el rango seleccionado</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} height={36} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={48} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="perdidas" name="Pérdidas" fill="#ef4444" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── CONTENEDOR PRINCIPAL ───────────────────────────────────────────────────
export default function ReporteEmbolse() {
  const { data: embolses = [], isLoading: loadingEmbolses } = useQuery({
    queryKey: ["embolses-reporte"],
    queryFn: async () => {
  const { data, error } = await inventory.listEmbolse();
  if (error) throw error;
  return data ?? [];
},
  });

  const { data: trenadas = [], isLoading: loadingTrenadas } = useQuery({
    queryKey: ["trenadas-reporte"],
    queryFn: async () => {
  const { data, error } = await trenadas.list();
  if (error) throw error;
  return data ?? [];
},
  });

  return (
    <div className="space-y-6">
      <GraficaEmbolse embolses={embolses} loading={loadingEmbolses} />
      <GraficaCosecha trenadas={trenadas} loading={loadingTrenadas} />
      <GraficaPerdidas />
    </div>
  );
}