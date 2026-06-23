import { createClient } from '@supabase/supabase-js';

// Cliente con Service Role Key: SOLO para funciones serverless (api/*).
// Nunca importar esto desde código que corre en el navegador — la Service
// Role Key ignora RLS por completo. Por eso la variable NO tiene el
// prefijo VITE_ (así Vite nunca la incluye en el bundle del cliente).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌ ERROR: faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función'
  );
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
