import { supabase } from "@/api/supabaseClient";

// Días de trial gratis al registrarse sin pago previo (comportamiento
// actual de Register.jsx / RegisterComplete.jsx).
const DIAS_TRIAL_GRATIS = 1; // 24h
// Días de acceso que otorga un pago de Recurrente (igual que en
// api/webhooks/recurrente.js — si cambia ahí, cambiar también aquí).
const DIAS_ACCESO_POR_PAGO = 30;

// Decide con qué estado debe nacer una finca nueva:
// - Si existe un pago en `pagos_pendientes` para este email (alguien que
//   pagó en Recurrente ANTES de registrarse) y aún no se usó, la finca
//   nace "activo" por 30 días y el pago se marca como usado.
// - Si no hay pago, nace "trial" por 24h (default actual).
//
// Se llama con el cliente supabase normal (anon key + sesión ya
// autenticada del usuario), por eso las policies de pagos_pendientes
// filtran por email = auth.jwt() ->> 'email'.
export async function obtenerEstadoInicialFinca(email) {
  const ahora = new Date();

  const { data: pago, error: pagoError } = await supabase
    .from("pagos_pendientes")
    .select("id")
    .eq("email", email)
    .eq("usado", false)
    .order("fecha_pago", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pagoError) {
    // No bloqueamos el registro por esto: seguimos con el trial gratis.
    console.error("Error consultando pagos_pendientes:", pagoError);
  }

  if (pago) {
    const vencimiento = new Date(
      ahora.getTime() + DIAS_ACCESO_POR_PAGO * 24 * 60 * 60 * 1000
    );

    // Marcamos el pago como usado ANTES de devolver "activo": si esto
    // falla, no activamos la cuenta con un pago que podría reutilizarse.
    const { error: marcarUsadoError } = await supabase
      .from("pagos_pendientes")
      .update({ usado: true, fecha_usado: ahora.toISOString() })
      .eq("id", pago.id);

    if (marcarUsadoError) {
      console.error("Error marcando pago_pendiente como usado:", marcarUsadoError);
    } else {
      return {
        estado: "activo",
        fecha_activacion: ahora.toISOString(),
        fecha_vencimiento: vencimiento.toISOString(),
      };
    }
  }

  const vencimientoTrial = new Date(
    ahora.getTime() + DIAS_TRIAL_GRATIS * 24 * 60 * 60 * 1000
  );
  return {
    estado: "trial",
    fecha_activacion: ahora.toISOString(),
    fecha_vencimiento: vencimientoTrial.toISOString(),
  };
}
