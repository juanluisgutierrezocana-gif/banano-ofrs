// Fórmulas de "DATOS DE PROCESO" reproducidas exactamente de la hoja real
// del cliente (INF. PROCESO E INVENTARIOS, hoja LA GRACIA12). Todas las
// celdas fueron verificadas click a click en esa hoja, incluyendo
// FACTOR 1RA (I18), FACTOR GENERAL (I19), FACTOR POTENCIAL (I20),
// PESO RACIMO (I24), DESPERDICIO DEL MONTE (I21) y DESPERDICIO GENERAL/
// REAL (I22). Antes estos 6 campos se llenaban a mano; ahora se calculan
// igual que el resto de "Datos de Proceso".
export function calcularDatosProceso(registro) {
  const horaInicio = Number(registro.hora_inicio) || 0;
  const horaSalida = Number(registro.hora_salida) || 0;
  const tiempoPerdido = Number(registro.tiempo_perdido) || 0;
  const cuadrilla = Number(registro.cuadrilla) || 0;
  const empaque = Number(registro.empaque) || 0;
  const cajasPrimera = Number(registro.cajas_primera) || 0;
  const cajasSegunda = Number(registro.cajas_segunda) || 0;
  const cajasTercera = Number(registro.cajas_tercera) || 0;
  const quintalesRechazo = Number(registro.quintales_rechazo) || 0;
  const racimosCosechados = Number(registro.racimos_cosechados) || 0;
  const racimosRechazados = Number(registro.racimos_rechazados) || 0;
  const acres = Number(registro.acres) || 0;

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

  // CAJAS EMPAQUE = CAJAS HORA / EMPAQUE
  // Verificado contra el ejemplo real del boceto (FINCA LA GRACIA, SEMANA 12):
  // 174 / 3 = 58.
  const cajasEmpaque = empaque > 0 ? cajasHora / empaque : 0;

  // HECTAREAS = ACRES x 0.404686 (conversión estándar acre -> hectárea)
  // Verificado contra el ejemplo real del boceto: 80.4 x 0.404686 ≈ 32.54.
  const hectareas = acres * 0.404686;

  // TOTAL CAJAS = CAJAS 1RA + CAJAS 2DA (NO incluye Cajas Tercera).
  // Confirmado con el cliente: "Suma de CAJAS DE PRIMERA + CAJAS SEGUNDA".
  const cajasTotal = cajasPrimera + cajasSegunda;

  // PESO RACIMO = ((CAJAS 2DA + CAJAS 1RA) x 41,5 + CAJAS 3RA x 42,5 + QUINTALES x 100) / RAC. COSECHADOS
  // (celda I24: =SI.ERROR(((((D19+D18)*41,5)+(D17*42,5)+(I29*100))/I15);"0"), I29=+D16)
  // Verificado: ((48+1518)*41.5 + 226*42.5 + 25*100) / 1367 = 56.40
  const pesoTotalCajas = (cajasSegunda + cajasPrimera) * 41.5 + cajasTercera * 42.5 + quintalesRechazo * 100;
  const pesoRacimo = racimosCosechados > 0 ? pesoTotalCajas / racimosCosechados : 0;

  // FACTOR 1RA = CAJAS 1RA / RAC. PROCESADOS
  // (celda I18: =SI.ERROR((D18)/(I15-I16);"0")). Verificado: 1518/1318 = 1.15
  const factorPrimera = racimosProcesados > 0 ? cajasPrimera / racimosProcesados : 0;

  // FACTOR GENERAL = (CAJAS 1RA + CAJAS 2DA) / RAC. PROCESADOS
  // (celda I19: =SI.ERROR(((D18+D19)/(I15-I16));"0")). Verificado: 1566/1318 = 1.19
  const factorGeneral = racimosProcesados > 0 ? (cajasPrimera + cajasSegunda) / racimosProcesados : 0;

  // FACTOR POTENCIAL = PESO RACIMO / 41,5
  // (celda I20: =SI.ERROR((I24/41,5);"0")). Verificado: 56.40/41.5 = 1.36
  const factorPotencial = pesoRacimo / 41.5;

  // DESPERDICIO DEL MONTE = (PESO POTENCIAL - PESO BUENO) / PESO POTENCIAL
  // PESO POTENCIAL = PESO RACIMO x RAC. PROCESADOS (celda K21: =+I24*I17)
  // PESO BUENO = (CAJAS 1RA + CAJAS 2DA) x 41,5 (celda K20: =+I27*41,5, I27=+D19+D18)
  // (celda I21: =SI.ERROR((L21/K21);"0"), L21=+K21-K20). Verificado: 12.57%
  const pesoPotencial = pesoRacimo * racimosProcesados;
  const pesoBueno = (cajasPrimera + cajasSegunda) * 41.5;
  const desperdicioMonte = pesoPotencial > 0 ? (pesoPotencial - pesoBueno) / pesoPotencial : 0;

  // DESPERDICIO GENERAL/REAL = PESO RECHAZO / PESO TOTAL
  // PESO RECHAZO = CAJAS 3RA x 42,5 + QUINTALES x 100 (celda L22)
  // PESO TOTAL = PESO BUENO + PESO RECHAZO = PESO TOTAL CAJAS (celda K22)
  // (celda I22: =SI.ERROR((L22/K22);"0")). Verificado: 15.70%
  const pesoRechazo = cajasTercera * 42.5 + quintalesRechazo * 100;
  const desperdicioGeneral = pesoTotalCajas > 0 ? pesoRechazo / pesoTotalCajas : 0;

  // LIBRAS PROCESADAS = RAC. PROCESADOS x PESO RACIMO.
  // Confirmado con el cliente contra el ejemplo del boceto: 1318 x 56.40 ≈ 74,331.
  const librasProcesadas = racimosProcesados * pesoRacimo;

  return {
    horasTrabajadas,
    cajasHora,
    cajasPersona,
    racimosProcesados,
    cajasEmpaque,
    hectareas,
    cajasTotal,
    librasProcesadas,
    pesoRacimo,
    factorPrimera,
    factorGeneral,
    factorPotencial,
    desperdicioMonte,
    desperdicioGeneral,
  };
}
