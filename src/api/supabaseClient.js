import { createClient } from '@supabase/supabase-js';

// Variables de entorno
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que existan las variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Variables de entorno SUPABASE no configuradas');
  console.error('Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local');
}

/**
 * Cliente Supabase - Reemplaza @base44/sdk
 * 
 * Uso:
 * import { supabase } from '@/api/supabaseClient';
 * const { data, error } = await supabase.from('trenadas').select('*');
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Funciones helper para operaciones comunes
 */

// ============================================
// TRENADAS (Cortes/Producciones)
// ============================================

export const trenadas = {
  // Obtener todas las trenadas de una fecha
  async getByDate(fecha) {
    return supabase
      .from('trenadas')
      .select('*')
      .eq('fecha', fecha)
      .order('hora', { ascending: true });
  },

  // Obtener trenada por ID
  async getById(id) {
    return supabase
      .from('trenadas')
      .select('*')
      .eq('id', id)
      .single();
  },

  // Crear nueva trenada
  async create(data) {
    return supabase
      .from('trenadas')
      .insert([data])
      .select()
      .single();
  },

  // Actualizar trenada
  async update(id, data) {
    return supabase
      .from('trenadas')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  },

  // Eliminar trenada
  async delete(id) {
    return supabase
      .from('trenadas')
      .delete()
      .eq('id', id);
  },

  // Obtener resumen diario
  async getSummaryByDate(fecha) {
    return supabase
      .from('v_resumen_diario')
      .select('*')
      .eq('fecha', fecha)
      .single();
  },

  // Obtener trending por hora
  async getTrendingByHour(fecha) {
    return supabase
      .from('trenadas')
      .select('hora, total_racimos')
      .eq('fecha', fecha)
      .order('hora', { ascending: true });
  },

  // Obtener trenadas por cuadrilla
  async getByCrew(cuadrilla, startDate, endDate) {
    return supabase
      .from('trenadas')
      .select('*')
      .eq('cuadrilla', cuadrilla)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: false });
  }
};

// ============================================
// EMBOLSE (Recepción de Fruta)
// ============================================

export const embolse = {
  async create(data) {
    return supabase
      .from('embolse')
      .insert([data])
      .select()
      .single();
  },

  async getByDate(fecha) {
    return supabase
      .from('embolse')
      .select('*')
      .eq('fecha', fecha)
      .order('hora', { ascending: true });
  },

  async getById(id) {
    return supabase
      .from('embolse')
      .select('*')
      .eq('id', id)
      .single();
  },

  async update(id, data) {
    return supabase
      .from('embolse')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  }
};

// ============================================
// COLORES (Color Config)
// ============================================

export const colors = {
  async getAll() {
    return supabase
      .from('color_configs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
  },

  async getById(id) {
    return supabase
      .from('color_configs')
      .select('*')
      .eq('id', id)
      .single();
  },

  async create(data) {
    return supabase
      .from('color_configs')
      .insert([data])
      .select()
      .single();
  },

  async update(id, data) {
    return supabase
      .from('color_configs')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  }
};

// ============================================
// SECCIONES (Seccion Agricola)
// ============================================

export const sections = {
  async getAll() {
    return supabase
      .from('seccion_agricola')
      .select('*')
      .eq('is_active', true)
      .order('nombre', { ascending: true });
  },

  async getById(id) {
    return supabase
      .from('seccion_agricola')
      .select('*')
      .eq('id', id)
      .single();
  },

  async create(data) {
    return supabase
      .from('seccion_agricola')
      .insert([data])
      .select()
      .single();
  },

  async update(id, data) {
    return supabase
      .from('seccion_agricola')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  }
};

// ============================================
// INVENTARIO (Inventario Embolse)
// ============================================

export const inventory = {
  async getByWeek(semana) {
    return supabase
      .from('v_inventario_actual')
      .select('*')
      .eq('semana', semana);
  },

  async create(data) {
    return supabase
      .from('inventario_embolse')
      .insert([data])
      .select()
      .single();
  },

  async update(id, data) {
    return supabase
      .from('inventario_embolse')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  },

  async getSaldo(semana, colorId) {
    return supabase
      .from('inventario_embolse')
      .select('saldo, total_embolse, cosechado, perdidas')
      .eq('semana', semana)
      .eq('color_id', colorId)
      .single();
  }
};

// ============================================
// PÉRDIDAS
// ============================================

export const losses = {
  async create(data) {
    return supabase
      .from('perdidas')
      .insert([data])
      .select()
      .single();
  },

  async getByWeek(semana) {
    return supabase
      .from('perdidas')
      .select('*, color_configs(color_name, color_hex)')
      .eq('semana', semana)
      .order('created_at', { ascending: false });
  },

  async getByWeekAndColor(semana, colorId) {
    return supabase
      .from('perdidas')
      .select('*')
      .eq('semana', semana)
      .eq('color_id', colorId)
      .single();
  },

  async update(id, data) {
    return supabase
      .from('perdidas')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  }
};

// ============================================
// LABOR AGRÍCOLA
// ============================================

export const laborAgricola = {
  async create(data) {
    return supabase
      .from('labor_agricola')
      .insert([data])
      .select()
      .single();
  },

  async getBySection(seccionId, startDate, endDate) {
    return supabase
      .from('v_labor_por_seccion')
      .select('*')
      .eq('seccion_id', seccionId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);
  },

  async getById(id) {
    return supabase
      .from('labor_agricola')
      .select('*, registro_labor(*)')
      .eq('id', id)
      .single();
  },

  async update(id, data) {
    return supabase
      .from('labor_agricola')
      .update(data)
      .eq('id', id)
      .select()
      .single();
  },

  // Labor Details
  detalle: {
    async create(laborId, data) {
      return supabase
        .from('registro_labor')
        .insert([{ ...data, labor_id: laborId }])
        .select()
        .single();
    },

    async getByLabor(laborId) {
      return supabase
        .from('registro_labor')
        .select('*')
        .eq('labor_id', laborId);
    },

    async update(id, data) {
      return supabase
        .from('registro_labor')
        .update(data)
        .eq('id', id)
        .select()
        .single();
    },

    async delete(id) {
      return supabase
        .from('registro_labor')
        .delete()
        .eq('id', id);
    }
  }
};

// ============================================
// USUARIOS
// ============================================

export const users = {
  // Obtener perfil actual
  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return profile;
  },

  // Obtener todos los usuarios (solo admin)
  async getAll() {
    return supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });
  },

  // Crear usuario
  async create(email, password, userData) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) return { error: authError };

    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        ...userData
      }])
      .select()
      .single();

    return { data, error };
  },

  // Actualizar usuario
  async update(userId, data) {
    return supabase
      .from('users')
      .update(data)
      .eq('id', userId)
      .select()
      .single();
  },

  // Cambiar rol
  async changeRole(userId, newRole) {
    return supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();
  },

  // Desactivar usuario
  async deactivate(userId) {
    return supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single();
  }
};

// ============================================
// CONFIGURACIONES
// ============================================

export const settings = {
  async get() {
    return supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();
  },

  async update(data) {
    return supabase
      .from('settings')
      .update(data)
      .eq('id', data.id)
      .select()
      .single();
  }
};

// ============================================
// BOTONES
// ============================================

export const buttons = {
  async getAll() {
    return supabase
      .from('button_config')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });
  }
};

// ============================================
// AUTENTICACIÓN
// ============================================

export const auth = {
  // Login
  async signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  // Signup
  async signUp(email, password) {
    return supabase.auth.signUp({ email, password });
  },

  // Logout
  async signOut() {
    return supabase.auth.signOut();
  },

  // Reset password
  async resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
  },

  // Update password
  async updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword });
  },

  // Get session
  async getSession() {
    return supabase.auth.getSession();
  },

  // Subscribe to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ============================================
// REPORTES & ANALYTICS
// ============================================

export const reports = {
  // Resumen diario
  async getDailySummary(fecha) {
    return supabase
      .from('v_resumen_diario')
      .select('*')
      .eq('fecha', fecha)
      .single();
  },

  // Inventario actual
  async getCurrentInventory() {
    return supabase
      .from('v_inventario_actual')
      .select('*');
  },

  // Labor por sección
  async getLaborBySectionRange(startDate, endDate) {
    return supabase
      .from('v_labor_por_seccion')
      .select('*')
      .gte('fecha', startDate)
      .lte('fecha', endDate);
  },

  // Exportar datos a CSV
  async exportTrendas(startDate, endDate) {
    const { data } = await supabase
      .from('trenadas')
      .select('*')
      .gte('fecha', startDate)
      .lte('fecha', endDate);
    return data;
  },

  // Auditoria
  async getAuditLog(tableFilter = null) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (tableFilter) {
      query = query.eq('table_name', tableFilter);
    }

    return query;
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export const realtime = {
  // Escuchar cambios en trenadas
  subscribeTrendas(callback) {
    return supabase
      .channel('trenadas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trenadas' }, callback)
      .subscribe();
  },

  // Escuchar cambios en inventario
  subscribeInventory(callback) {
    return supabase
      .channel('inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_embolse' }, callback)
      .subscribe();
  },

  // Dejar de escuchar
  unsubscribe(channel) {
    return supabase.removeChannel(channel);
  }
};

export default supabase;
