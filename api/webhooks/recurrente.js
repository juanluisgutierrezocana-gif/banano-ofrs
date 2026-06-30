import { Webhook } from 'svix';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Días de acceso que otorga cada pago exitoso. Mientras solo exista un
// plan, esto es un valor fijo; si más adelante hay varios planes
// (mensual/anual) se puede leer de event.product.id en vez de ser fijo.
const DIAS_ACCESO_POR_PAGO = 30;

// Decide qué actualizar en `fincas` según el tipo de evento de Recurrente.
// Devuelve null si el evento no requiere cambios (ej. intent.pending,
// intent.failed de un solo intento que no afecta una suscripción activa).
function getActualizacionPorEvento(event) {
  // intent.succeeded: cobro exitoso por CUALQUIER método de pago (tarjeta,
  // transferencia, cripto, etc.) — los fondos ya están acreditados.
  if (event.event_type === 'intent.succeeded') {
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + DIAS_ACCESO_POR_PAGO);
    return {
      estado: 'activo',
      fecha_activacion: new Date().toISOString(),
      fecha_vencimiento: vencimiento.toISOString(),
    };
  }

  switch (event.event_type) {
    // Primer cobro automático fallido de una suscripción: damos margen
    // (la pantalla de AccountStatusGate ya cubre "pendiente" sin bloquear
    // de forma tan dura como "suspendido").
    case 'subscription.past_due':
      return { estado: 'pendiente' };
    // Suscripción pausada manualmente desde Recurrente.
    case 'subscription.paused':
      return { estado: 'suspendido' };
    // Tercer reintento fallido: Recurrente cancela la suscripción.
    case 'subscription.cancel':
      return { estado: 'cancelado' };
    default:
      return null;
  }
}

// Vercel Functions (Web API estándar: Request/Response) en vez del estilo
// Node (req,res). request.text() entrega el body CRUDO sin que Vercel lo
// parsee como JSON primero — imprescindible porque la firma de svix se
// calcula sobre el string EXACTO que mandó Recurrente; si se re-serializa
// el JSON, la verificación falla siempre.
export async function POST(request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  // --- 1. Verificar la firma (svix-id / svix-timestamp / svix-signature) ---
  const secret = process.env.RECURRENTE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('❌ Falta RECURRENTE_WEBHOOK_SECRET en el entorno');
    return Response.json({ error: 'Webhook no configurado' }, { status: 500 });
  }

  let event;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, headers);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return Response.json({ error: 'Firma inválida' }, { status: 400 });
  }

  // --- 2. Buscar la finca por el email del cliente que pagó ---
  const email = event?.customer?.email;
  if (!email) {
    // Sin email no hay forma de saber a qué finca pertenece. Respondemos
    // 200 para que Recurrente NO reintente: no es un error transitorio.
    console.warn('Webhook sin customer.email:', event?.event_type, event?.id);
    return Response.json({ received: true, ignored: 'sin email' });
  }

  const { data: finca, error: fincaError } = await supabaseAdmin
    .from('fincas')
    .select('id')
    .eq('email_contacto', email)
    .maybeSingle();

  if (fincaError) {
    console.error('Error buscando finca por email:', fincaError);
    return Response.json({ error: 'Error de base de datos' }, { status: 500 });
  }

  if (!finca) {
    // Sin finca asociada: puede ser alguien que pagó ANTES de registrarse
    // (pre-pago). Solo nos interesa guardarlo si fue un cobro exitoso —
    // eventos de suscripción (past_due/paused/cancel) sin finca no aplican.
    if (event.event_type !== 'intent.succeeded') {
      console.warn(`Webhook de ${email} sin finca asociada (event_type=${event.event_type})`);
      return Response.json({ received: true, ignored: 'finca no encontrada' });
    }

    // Guardamos el pago en pagos_pendientes para que, cuando esta persona
    // se registre, Register.jsx/RegisterComplete.jsx lo encuentren por email
    // y activen la cuenta directo (sin trial) en vez de ignorar el pago.
    // onConflict + ignoreDuplicates: si Recurrente reintenta el webhook
    // (mismo evento.id), no se duplica la fila.
    const { error: pagoError } = await supabaseAdmin
      .from('pagos_pendientes')
      .upsert(
        {
          email,
          evento_id: event.id,
          monto: event?.amount_in_cents ?? null,
          moneda: event?.currency ?? null,
        },
        { onConflict: 'evento_id', ignoreDuplicates: true }
      );

    if (pagoError) {
      console.error('Error guardando pago pendiente:', pagoError);
      return Response.json({ error: 'Error de base de datos' }, { status: 500 });
    }

    console.log(`Pago pendiente guardado para ${email} (evento ${event.id}) — sin finca asociada todavía.`);
    return Response.json({ received: true, pendiente: true });
  }

  // --- 3. Aplicar el cambio de estado según el evento ---
  const updates = getActualizacionPorEvento(event);
  if (!updates) {
    return Response.json({ received: true, ignored: event.event_type });
  }

  const { error: updateError } = await supabaseAdmin
    .from('fincas')
    .update(updates)
    .eq('id', finca.id);

  if (updateError) {
    console.error('Error actualizando finca:', updateError);
    return Response.json({ error: 'Error de base de datos' }, { status: 500 });
  }

  console.log(`Finca ${finca.id} (${email}) actualizada por ${event.event_type}:`, updates);
  return Response.json({ received: true });
}
