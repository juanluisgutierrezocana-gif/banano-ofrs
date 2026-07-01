// Constantes compartidas de "Producción" — fuente única de verdad para que
// "Configuración" (ProduccionConfiguraciones.jsx) pueda generar sus botones
// de mostrar/ocultar sin duplicar (y arriesgar que se desincronicen) las
// listas de columnas/calidades que ya usan ProduccionHome.jsx y
// ProduccionIngresar.jsx.

// --- Tabla "Producción" (ProduccionHome.jsx) ---
// Columnas del resumen diario rellenable a mano (tabla produccion_resumen).
export const CAMPOS_RESUMEN = [
  { field: "racimos_cosechados", label: "Racimos Cosechados" },
  { field: "racimos_rechazados", label: "Racimos Rechazados" },
  { field: "racimos_procesados", label: "Racimos Procesados" },
  { field: "cajas_primera", label: "Cajas 1ra" },
  { field: "cajas_segunda", label: "Cajas 2da" },
  { field: "cajas_tercera", label: "Cajas 3ra" },
  { field: "quintales_rechazo", label: "Quintales Rechazo" },
  { field: "factor_primera", label: "Factor 1ra" },
  { field: "factor_general", label: "Factor General" },
  { field: "factor_potencial", label: "Factor Potencial" },
  { field: "peso_racimo", label: "Peso Racimo" },
  { field: "desperdicio_monte", label: "DESPERDICIO REC. RECH." },
  { field: "desperdicio_general", label: "Desperdicio General" },
];

// --- Tablas "Ingresar Datos" (ProduccionIngresar.jsx) ---
// Calidades de la "Producción Semanal por Código" / "Resumen de Producción".
export const CODIGOS_SEMANA = [
  "DMD", "DM9", "PRIM", "PREM", "3LB", "IP", "24COUNT", "24COUNT_G39",
  "ROSY NORMAL", "ROSY CONSUMER", "DM BANABAC", "DM BANABAC MINI", "3LBS",
];

// Texto de "Calidad" a mostrar en pantalla para cada código interno de
// CODIGOS_SEMANA. Por defecto es igual a la clave; solo hace falta una
// entrada aquí cuando el código interno no coincide con el texto visible.
export const CALIDAD_LABEL = {
  "24COUNT_G39": "24COUNT",
};

// Código corto (columna "CODIGO" de la hoja real) que corresponde a cada
// calidad de CODIGOS_SEMANA (columna "CALIDAD").
export const CODIGO_CORTO = {
  DMD: "C68",
  DM9: "C23",
  PRIM: "CH1",
  PREM: "G01",
  "3LB": "CQ2",
  IP: "CH7",
  "24COUNT": "C39",
  "24COUNT_G39": "G39",
  "ROSY NORMAL": "G05",
  "ROSY CONSUMER": "GQ5",
  "DM BANABAC": "GP7",
  "DM BANABAC MINI": "GP7",
  "3LBS": "CP9",
};

// Valor "CAJ." por default de cada calidad.
export const CAJ_DEFAULT = {
  DMD: 48,
  DM9: 48,
  PRIM: 48,
  PREM: 48,
  "3LB": 45,
  IP: 48,
  "24COUNT": 45,
  "24COUNT_G39": 45,
  "ROSY NORMAL": 48,
  "ROSY CONSUMER": 48,
  "DM BANABAC": 54,
  "DM BANABAC MINI": 32,
  "3LBS": 48,
};
