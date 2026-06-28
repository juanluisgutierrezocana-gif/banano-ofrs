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
  const cuadrilla = Number(registro.cuadrilla) || 0;
  const empaque = Number(registro.empaque) || 0;
  const cajasPrimera = Number(registro.cajas_primera) || 0;
  const cajasSegunda = Number(registro.cajas_segunda) || 0;
  const cajasTercera = Number(registro.cajas_tercera) || 0;
  const quintalesRechazo = Number(registro.quintales_rechazo) || 0;
  const racimosCosechados = Number(registro.racimos_cosechados) || 0;
  const racimosRechazados = Number(registro.racimos_rechazados) || 0;
  const acres = Number(registro.acres) || 0;

  // HRAS. TRABAJADAS = HORA SALIDA - HORA INICIO - 1 (hora fija de almuerzo,
  // NO el campo "Tiempo Perdido" — confirmado por el cliente: la fórmula real
  // del Excel resta 1 constante, no el tiempo perdido ingresado).
  const horasTrabajadas = horaSalida - horaInicio - 1;

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

  // FACTOR APROVECHAMIENTO = (CAJAS 1RA + CAJAS 2DA + CAJAS 3RA) / RAC. PROCESADOS
  // Mide el aprovechamiento total del racimo procesado (incluye Tercera),
  // a diferencia de Factor Primera (solo 1ra) y Factor General (1ra+2da).
  // NOTA: columna nueva pedida por el cliente en Reportería; fórmula
  // a confirmar contra el Excel real si difiere.
  const factorAprovechamiento = racimosProcesados > 0
    ? (cajasPrimera + cajasSegunda + cajasTercera) / racimosProcesados
    : 0;

  // % RECORRIDO = RAC. PROCESADOS / RAC. COSECHADOS
  // Columna nueva pedida por el cliente en Reportería.
  const pctRecorrido = racimosCosechados > 0 ? racimosProcesados / racimosCosechados : 0;

  // HORAS PERDIDAS PLANTA = campo "Tiempo Perdido" ingresado en el registro
  // (NO se usa para Horas Trabajadas — ver nota arriba — pero sí se reporta
  // como columna propia en Reportería).
  const horasPerdidas = Number(registro.tiempo_perdido) || 0;

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
    cajasSegunda,
    librasProcesadas,
    pesoRacimo,
    factorPrimera,
    factorGeneral,
    factorAprovechamiento,
    factorPotencial,
    pctRecorrido,
    quintalesRechazo,
    horasPerdidas,
    desperdicioMonte,
    desperdicioGeneral,
  };
}

// Suma los campos crudos de un grupo de registros diarios (de una semana o
// un mes) y vuelve a calcular factores/desperdicio/peso racimo sobre esas
// SUMAS — no promedia los valores ya calculados día por día. Así es como
// el Excel real del cliente obtiene sus resúmenes semanal y mensual.
// Usado por la Reportería (Resumen Semanal / Resumen Mensual).
export function calcularDatosProcesoAgregado(registros) {
  const sum = (campo) =>
    registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

  const racimosCosechados = sum("racimos_cosechados");
  const racimosRechazados = sum("racimos_rechazados");
  const racimosProcesados = racimosCosechados - racimosRechazados;
  const cajasPrimera = sum("cajas_primera");
  const cajasSegunda = sum("cajas_segunda");
  const cajasTercera = sum("cajas_tercera");
  const quintalesRechazo = sum("quintales_rechazo");
  const cajasTotal = cajasPrimera + cajasSegunda;

  // Horas Planta = suma de las horas trabajadas de cada día del grupo.
  const horasTrabajadas = registros.reduce(
    (acc, r) => acc + calcularDatosProceso(r).horasTrabajadas,
    0
  );

  // Horas Perdidas Planta = suma del campo "Tiempo Perdido" de cada día.
  const horasPerdidas = sum("tiempo_perdido");

  // Mismas fórmulas de PESO RACIMO / FACTOR GENERAL / FACTOR POTENCIAL /
  // DESPERDICIO GENERAL que calcularDatosProceso(), pero con los totales
  // del grupo en vez de los valores de un solo día.
  const pesoTotalCajas =
    (cajasSegunda + cajasPrimera) * 41.5 + cajasTercera * 42.5 + quintalesRechazo * 100;
  const pesoRacimo = racimosCosechados > 0 ? pesoTotalCajas / racimosCosechados : 0;

  // FACTOR PRIMERA = CAJAS 1RA / RAC. PROCESADOS (igual que calcularDatosProceso).
  const factorPrimera = racimosProcesados > 0 ? cajasPrimera / racimosProcesados : 0;
  const factorGeneral = racimosProcesados > 0 ? cajasTotal / racimosProcesados : 0;
  // FACTOR APROVECHAMIENTO = (1RA + 2DA + 3RA) / RAC. PROCESADOS — distinto
  // de Factor Primera y Factor General (ver misma nota en calcularDatosProceso).
  const factorAprovechamiento = racimosProcesados > 0
    ? (cajasPrimera + cajasSegunda + cajasTercera) / racimosProcesados
    : 0;
  const factorPotencial = pesoRacimo / 41.5;

  // % RECORRIDO = RAC. PROCESADOS / RAC. COSECHADOS
  const pctRecorrido = racimosCosechados > 0 ? racimosProcesados / racimosCosechados : 0;

  const pesoRechazo = cajasTercera * 42.5 + quintalesRechazo * 100;
  const desperdicioGeneral = pesoTotalCajas > 0 ? pesoRechazo / pesoTotalCajas : 0;

  return {
    diasPlanta: registros.length,
    racimosCosechados,
    racimosRechazados,
    racimosProcesados,
    cajasTotal,
    cajasPrimera,
    cajasSegunda,
    cajasTercera,
    quintalesRechazo,
    horasTrabajadas,
    horasPerdidas,
    pesoRacimo,
    factorPrimera,
    factorGeneral,
    factorAprovechamiento,
    factorPotencial,
    pctRecorrido,
    desperdicioGeneral,
  };
}
