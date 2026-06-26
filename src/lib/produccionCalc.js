// Fórmulas de "DATOS DE PROCESO" reproducidas exactamente de la hoja real
// del cliente (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12, celdas I10/I11).
// Solo se incluyen aquí las fórmulas que se verificaron click a click en esa
// hoja. El resto de campos del boceto (FACTOR 1RA, FACTOR GENERAL, FACTOR
// POTENCIAL, PESO RACIMO, % DESPERDICIO DEL MONTE, % DESPERDICIO GENERAL,
// "DIF: TOTAL - CAJ. PROG") todavía no tienen fórmula confirmada — agregarlos
// aquí cuando el cliente confirme cómo se calculan, NO antes.
export function calcularDatosProceso(registro) {
  const horaInicio = Number(registro.hora_inicio) || 0;
  const horaSalida = Number(registro.hora_salida) || 0;
  const tiempoPerdido = Number(registro.tiempo_perdido) || 0;
  const cuadrilla = Number(registro.cuadrilla) || 0;
  const empaque = Number(registro.empaque) || 0;
  const cajasPrimera = Number(registro.cajas_primera) || 0;
  const cajasSegunda = Number(registro.cajas_segunda) || 0;
  const racimosCosechados = Number(registro.racimos_cosechados) || 0;
  const racimosRechazados = Number(registro.racimos_rechazados) || 0;

  // HRAS. TRABAJADAS = HORA SALIDA - HORA INICIO - TIEMPO PERDIDO
  const horasTrabajadas = horaSalida - horaInicio - tiempoPerdido;

  // CAJAS HORA = (CAJAS 1RA + CAJAS 2DA) / HRAS. TRABAJADAS  (celda I10)
  const cajasHora = horasTrabajadas > 0 ? (cajasPrimera + cajasSegunda) / horasTrabajadas : 0;

  // CAJAS PERSONA = ((CAJAS HORA / HRAS. TRABAJADAS) / (CUADRILLA + EMPAQUE)) * 10
  // (celda I11, fórmula original: SI.ERROR(((I10/I7)/(I8+I9))*10;"0"))
  let cajasPersona = 0;
  try {
    const divisor = cuadrilla + empaque;
    cajasPersona = horasTrabajadas > 0 && divisor > 0
      ? ((cajasHora / horasTrabajadas) / divisor) * 10
      : 0;
  } catch {
    cajasPersona = 0;
  }

  // RAC. PROCESADOS = RAC. COSECHADOS - RAC. RECHAZADOS
  const racimosProcesados = racimosCosechados - racimosRechazados;

  return {
    horasTrabajadas,
    cajasHora,
    cajasPersona,
    racimosProcesados,
  };
}
