import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Confirma el correo de un usuario recién registrado usando la Admin API
// de Supabase (Service Role Key), sin depender de ningún toggle del
// dashboard (p. ej. "Confirm email", que ya no aparece en algunas versiones
// del panel de Supabase). Register.jsx llama esto justo después de
// signUp(), antes de iniciar sesión.
//
// Solo acepta un userId y solo hace una cosa: marcar email_confirm = true
// para ESA cuenta. No expone ni acepta nada más, así que no sirve para
// tomar control de otras cuentas (y los UUID de Supabase no son adivinables).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { userId } = body || {};
  if (!userId) {
    return Response.json({ error: 'Falta userId' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error('Error confirmando usuario:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ confirmed: true });
}
