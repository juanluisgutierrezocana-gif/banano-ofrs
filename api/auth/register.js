import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Crea el usuario directo y confirmado con la Admin API de Supabase
// (email_confirm: true desde la creación). A diferencia de
// supabase.auth.signUp() desde el navegador, esto NO dispara ningún correo
// de confirmación — por eso no choca con el rate limit del SMTP compartido
// de Supabase (causa real de "email rate limit exceeded" al registrarse).
//
// El cliente, justo después de llamar a este endpoint, inicia sesión
// normal con supabase.auth.signInWithPassword().
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { email, password, fincaNombre } = body || {};
  if (!email || !password) {
    return Response.json({ error: 'Falta email o password' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { finca_nombre: fincaNombre || null },
  });

  if (error) {
    console.error('Error creando usuario:', error);
    const status = error.status && error.status >= 400 ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }

  return Response.json({ userId: data.user.id });
}
