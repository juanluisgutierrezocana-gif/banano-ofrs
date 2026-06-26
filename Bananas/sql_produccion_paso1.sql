-- ============================================================
-- PASO 1: Crear tabla registros_produccion (sin finca_id/RLS todavía)
-- ============================================================
CREATE TABLE IF NOT EXISTS registros_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  hora_inicio numeric,
  hora_salida numeric,
  tiempo_perdido numeric,
  cuadrilla numeric,
  empaque numeric,
  acres numeric,
  racimos_cosechados numeric,
  racimos_rechazados numeric,
  no_manos numeric,
  peso_pinzote numeric,
  calibre text,
  quintales_rechazo numeric,
  cajas_tercera numeric,
  cajas_primera numeric,
  cajas_segunda numeric,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PASO 2: Introspección de registros_labor (tabla ya existente con
-- finca_id + RLS funcionando) para replicar EXACTAMENTE el mismo patrón
-- en registros_produccion. Copia el resultado de estas dos consultas y
-- pégamelo en el chat.
-- ============================================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'registros_labor'
ORDER BY ordinal_position;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'registros_labor';
