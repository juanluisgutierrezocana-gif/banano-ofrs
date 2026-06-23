import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Crea un usuario (login + fila en `users`) desde el panel de administración.
// SOLO puede ejecutarlo alguien ya autenticado con rol 'admin' u 'owner' —
// se verifica aquí mismo contra `public.users`, nunca contra el body (el
// body nunca dice quién llama; confiar en él sería un hueco de seguridad).
//
// Un 'admin' solo puede crear usuarios DENTRO de su propia finca (el
// finca_id del body se ignora). Un 'owner' puede elegir cualquier finca.
//
// El rol del usuario NUEVO nunca puede ser 'owner': ese rol solo se otorga
// con un UPDATE manual en el SQL Editor de Supabase, nunca desde la app.
export async function POST(request) {
  // --- 1. Verificar quién llama (token de sesión del usuario, no la Service Role Key) ---
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'Falta el token de autorización' }, { status: 401 });
  }

  const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !caller) {
    return Response.json({ error: 'Sesión inválida' }, { status: 401 });
  }

  const { data: callerRecord, error: callerRecordError } = await supabaseAdmin
    .from('users')
    .select('role, finca_id')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerRecordError) {
    console.error('Error leyendo el usuario que llama:', callerRecordError);
    return Response.json({ error: 'Error de base de datos' }, { status: 500 });
  }

  const callerRole = callerRecord?.role;
  if (callerRole !== 'admin' && callerRole !== 'owner') {
    return Response.json({ error: 'No tienes permiso para crear usuarios' }, { status: 403 });
  }

  // --- 2. Leer y validar el body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { email, password, full_name, role, finca_id } = body || {};

  if (!email || !password) {
    return Response.json({ error: 'Falta email o password' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  // El rol del nuevo usuario solo puede ser uno de estos tres. 'owner' queda
  // deliberadamente fuera de esta lista: nunca se otorga desde la app.
  const ROLES_PERMITIDOS = ['admin', 'user', 'viewer'];
  if (!ROLES_PERMITIDOS.includes(role)) {
    return Response.json(
      { error: `role debe ser uno de: ${ROLES_PERMITIDOS.join(', ')}` },
      { status: 400 }
    );
  }

  // Un admin solo puede crear usuarios dentro de SU finca (se ignora
  // cualquier finca_id que venga en el body). Un owner debe indicar a cuál.
  let targetFincaId;
  if (callerRole === 'admin') {
    targetFincaId = callerRecord.finca_id;
  } else {
    if (!finca_id) {
      return Response.json({ error: 'Falta finca_id' }, { status: 400 });
    }
    const { data: finca, error: fincaError } = await supabaseAdmin
      .from('fincas')
      .select('id')
      .eq('id', finca_id)
      .maybeSingle();

    if (fincaError) {
      console.error('Error verificando finca:', fincaError);
      return Response.json({ error: 'Error de base de datos' }, { status: 500 });
    }
    if (!finca) {
      return Response.json({ error: 'finca_id no existe' }, { status: 400 });
    }
    targetFincaId = finca_id;
  }

  // --- 3. Crear el usuario en Supabase Auth (ya confirmado, sin correo) ---
  const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined,
  });

  if (createError) {
    console.error('Error creando usuario en Auth:', createError);
    const status = createError.status && createError.status >= 400 ? createError.status : 500;
    return Response.json({ error: createError.message }, { status });
  }

  // --- 4. Crear su fila en public.users (perfil de la app) ---
  const { error: profileError } = await supabaseAdmin.from('users').insert([{
    id: newAuthUser.user.id,
    email,
    full_name: full_name || null,
    role,
    finca_id: targetFincaId,
  }]);

  if (profileError) {
    // Si el perfil falla, no dejamos un usuario "fantasma" que puede
    // iniciar sesión pero no tiene perfil ni finca: se revierte el alta en Auth.
    console.error('Error creando perfil en users, revirtiendo Auth:', profileError);
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
    return Response.json({ error: 'Error de base de datos al crear el perfil' }, { status: 500 });
  }

  return Response.json({
    id: newAuthUser.user.id,
    email,
    full_name: full_name || null,
    role,
    finca_id: targetFincaId,
  });
}
