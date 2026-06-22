import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, auth } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  // Combina el usuario de Supabase Auth con su rol, finca_id y los datos
  // de la finca (estado de cuenta, plan y fecha de vencimiento). Estos datos
  // son los que usará el gating de acceso (pantalla de pendiente/vencida).
  const buildUserWithFinca = async (authUser) => {
    const { data: userRecord } = await supabase
      .from('users')
      .select('role, finca_id')
      .eq('id', authUser.id)
      .maybeSingle();

    let finca = null;
    if (userRecord?.finca_id) {
      const { data: fincaRecord } = await supabase
        .from('fincas')
        .select('nombre, estado, plan, fecha_vencimiento')
        .eq('id', userRecord.finca_id)
        .maybeSingle();
      finca = fincaRecord ?? null;
    }

    return {
      ...authUser,
      role: userRecord?.role ?? 'viewer',
      finca_id: userRecord?.finca_id ?? null,
      finca,
    };
  };

  const checkAuthState = async () => {
    // Guard contra cuelgues: si el navegador tiene guardada una sesión vieja
    // (token de un usuario huérfano, o un lock interno de supabase-js que no
    // se liberó), getSession()/buildUserWithFinca pueden no resolver NUNCA,
    // dejando "Cargando..." para siempre sin ningún error en consola.
    // Verificado en producción: limpiar localStorage destrababa la carga al
    // instante, confirmando que el cuelgue viene de ahí y no de un error real.
    let timeoutId;
    try {
      setAuthError(null);

      const work = (async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(await buildUserWithFinca(session.user));
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      })();

      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Tiempo de espera agotado al verificar la sesión')),
          8000
        );
      });

      await Promise.race([work, timeout]);
      setAuthChecked(true);
    } catch (err) {
      console.error('Auth check failed:', err);
      setAuthError(err.message);
      // Si quedamos en un estado dudoso (timeout o sesión corrupta), no
      // dejamos al usuario autenticado a medias: tratamos como sesión inválida
      // para que pueda volver a iniciar sesión en vez de quedar atascado.
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
    } finally {
      clearTimeout(timeoutId);
      setIsLoadingAuth(false);
    }
  };

  // Escuchar cambios de autenticación
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(await buildUserWithFinca(session.user));
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async (email, password) => {
    try {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const resetPassword = async (email) => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      setAuthError(null);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    authChecked,
    login,
    register,
    logout,
    resetPassword,
    updatePassword,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
