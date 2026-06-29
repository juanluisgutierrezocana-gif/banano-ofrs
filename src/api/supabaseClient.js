import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Variables de entorno SUPABASE no configuradas');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// HELPER: Convierte filtros Base44 a queries de Supabase
// Soporta: { campo: valor }, { campo: { $gte, $lte, $gt, $lt, $ne, $in } }
// ============================================================
const applyFilters = (query, filters = {}) => {
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (value.$gte !== undefined) query = query.gte(key, value.$gte);
      if (value.$lte !== undefined) query = query.lte(key, value.$lte);
      if (value.$gt  !== undefined) query = query.gt(key,  value.$gt);
      if (value.$lt  !== undefined) query = query.lt(key,  value.$lt);
      if (value.$ne  !== undefined) query = query.neq(key, value.$ne);
      if (value.$in  !== undefined) query = query.in(key,  value.$in);
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
};

// ============================================================
// FACTORY: Genera cliente Base44-compatible para cada tabla
// Todos retornan { data, error } (Supabase style)
// ============================================================
const createEntity = (tableName) => ({
  async list(orderBy = null) {
    let query = supabase.from(tableName).select('*');
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      query = query.order(desc ? orderBy.slice(1) : orderBy, { ascending: !desc });
    }
    return await query;
  },

  async filter(filters = {}, orderBy = null) {
    let query = supabase.from(tableName).select('*');
    query = applyFilters(query, filters);
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      query = query.order(desc ? orderBy.slice(1) : orderBy, { ascending: !desc });
    }
    return await query;
  },

  async get(id) {
    return await supabase.from(tableName).select('*').eq('id', id).single();
  },

  async create(record) {
    return await supabase.from(tableName).insert([record]).select().single();
  },

  async update(id, updates) {
    return await supabase.from(tableName).update(updates).eq('id', id).select().single();
  },

  async delete(id) {
    return await supabase.from(tableName).delete().eq('id', id);
  },

  async deleteMany(filters = {}) {
    let query = supabase.from(tableName).delete();
    query = applyFilters(query, filters);
    return await query;
  },

  async bulkCreate(records) {
    return await supabase.from(tableName).insert(records).select();
  },
});

// ============================================================
// ENTIDADES (nombre Base44 → tabla Supabase)
// ============================================================

/** Trenada → trenadas */
export const trenadas = createEntity('trenadas');

/** Section (nombre, active) → sections
 *  OJO: distinto de SeccionAgricola (con acres/minifinca) */
export const sections = createEntity('sections');

/** ColorConfig (name, hex, active) → color_configs */
export const colors = createEntity('color_configs');

/** LaborAgricola (nombre, num_ciclos, activa) → tipos_labor */
export const laborAgricola = createEntity('tipos_labor');

/** RegistroLabor → registros_labor */
export const reports = createEntity('registros_labor');

/** SeccionAgricola (nombre, acres, minifinca, activa) → seccion_agricola */
export const seccionAgricola = createEntity('seccion_agricola');

/** OrdenCalibre → orden_calibre */
export const ordenCalibre = createEntity('orden_calibre');

/** Acres → orden_acres (mismo patrón que OrdenCalibre, tabla independiente) */
export const ordenAcres = createEntity('orden_acres');

/** Perdida → perdidas */
export const losses = createEntity('perdidas');

/** RegistroProduccion (datos diarios de proceso de banano) → registros_produccion */
export const produccion = createEntity('registros_produccion');

/** Tabla independiente de "Producción" (resumen rellenable a mano, sin
 *  fórmulas ni enlace a registros_produccion) → produccion_resumen */
export const produccionResumen = createEntity('produccion_resumen');

/** ProduccionSemanal (grid semanal por código de producto, días lunes-sábado) → produccion_semanal */
export const produccionSemanal = createEntity('produccion_semanal');

/** ProduccionCajasPalet (cajas/palet por día de la semana) → produccion_cajas_palet */
export const produccionCajasPalet = createEntity('produccion_cajas_palet');

/** Costo Caja rellenable por período (diario/semanal/mensual) → produccion_costos
 *  Una fila por (periodo_tipo, periodo_key); se guarda con upsert. */
const produccionCostosBase = createEntity('produccion_costos');
export const produccionCostos = {
  ...produccionCostosBase,
  async upsert(periodoTipo, periodoKey, costoCaja) {
    return await supabase
      .from('produccion_costos')
      .upsert(
        { periodo_tipo: periodoTipo, periodo_key: periodoKey, costo_caja: costoCaja },
        { onConflict: 'periodo_tipo,periodo_key' }
      )
      .select()
      .single();
  },
};

/** Visibilidad de columnas/calidades en Producción e Ingresar Datos →
 *  produccion_visibilidad. Una fila por (grupo, clave); se guarda con
 *  upsert. grupo: 'produccion_columnas' | 'ingresar_calidades'. */
const produccionVisibilidadBase = createEntity('produccion_visibilidad');
export const produccionVisibilidad = {
  ...produccionVisibilidadBase,
  async upsert(grupo, clave, visible) {
    return await supabase
      .from('produccion_visibilidad')
      .upsert(
        { grupo, clave, visible },
        { onConflict: 'grupo,clave' }
      )
      .select()
      .single();
  },
};

// ============================================================
// INVENTARIO / EMBOLSE
// Con aliases para compatibilidad (createEmbolse, updateEmbolse, etc.)
// ============================================================
const embolseBase = createEntity('inventario_embolse');
export const inventory = {
  ...embolseBase,
  async listEmbolse(orderBy = null) {
    return embolseBase.list(orderBy);
  },
  async createEmbolse(data) {
    return embolseBase.create(data);
  },
  async updateEmbolse(id, data) {
    return embolseBase.update(id, data);
  },
  async deleteEmbolse(id) {
    return embolseBase.delete(id);
  },
};

// ============================================================
// SETTINGS (clave-valor)
// ============================================================
const settingsBase = createEntity('settings');
export const settings = {
  ...settingsBase,
  async getByKey(key) {
    return await supabase.from('settings').select('*').eq('key', key).single();
  },
  async setByKey(key, value) {
    return await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();
  },
};

// ============================================================
// USERS
// ============================================================
const usersBase = createEntity('users');
export const users = {
  ...usersBase,
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: null };
    return await supabase.from('users').select('*').eq('id', user.id).single();
  },
};

// ============================================================
// FINCAS (tenants) — solo el rol 'owner' puede ver/editar TODAS
// (RLS: fincas_select_own / fincas_update_owner con OR is_owner()).
// Para un admin normal, RLS limita esto a su propia finca.
// ============================================================
export const fincas = createEntity('fincas');

// ============================================================
// OWNER_ACTIVE_FINCA — en qué finca está "operando" el dueño en
// este momento. PK es user_id (no id), por eso no usa createEntity.
// ============================================================
export const ownerActiveFinca = {
  async get(userId) {
    return await supabase.from('owner_active_finca').select('*').eq('user_id', userId).maybeSingle();
  },
  async set(userId, activeFincaId) {
    return await supabase
      .from('owner_active_finca')
      .upsert(
        { user_id: userId, active_finca_id: activeFincaId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
  },
};

// ============================================================
// AUTH
// ============================================================
export const auth = {
  async signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
  },
  async signUp(email, password) {
    return await supabase.auth.signUp({ email, password });
  },
  async signOut() {
    return await supabase.auth.signOut();
  },
  async resetPassword(email) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },
  async updatePassword(newPassword) {
    return await supabase.auth.updateUser({ password: newPassword });
  },
  async getSession() {
    return await supabase.auth.getSession();
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ============================================================
// REALTIME
// ============================================================
export const realtime = {
  subscribeTrenadas(callback) {
    return supabase
      .channel('trenadas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trenadas' }, callback)
      .subscribe();
  },
  unsubscribe(channel) {
    return supabase.removeChannel(channel);
  },
};

export default supabase;