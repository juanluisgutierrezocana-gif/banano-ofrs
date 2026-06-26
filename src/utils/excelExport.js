import XLSXStyle from "xlsx-js-style";

/**
 * Construye UNA hoja con formato profesional (título, encabezados,
 * filas alternadas, totales, bordes). Función interna reutilizada tanto
 * por exportStyledExcel (1 hoja) como por exportStyledWorkbook (N hojas).
 */
function buildStyledSheet({ title, headers, rows, totalsRow, sheetName }) {
  // ── Construir datos ──────────────────────────────────────────────
  const titleRow    = [title, ...Array(headers.length - 1).fill("")];
  const subtitleRow = [`Generado: ${new Date().toLocaleString("es-GT")}`, ...Array(headers.length - 1).fill("")];
  const emptyRow    = Array(headers.length).fill("");

  const allData = [titleRow, subtitleRow, emptyRow, headers, ...rows];
  if (totalsRow) allData.push(totalsRow);

  const ws = XLSXStyle.utils.aoa_to_sheet(allData);

  // ── Anchos de columna ────────────────────────────────────────────
  ws["!cols"] = headers.map((h, ci) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map(r => String(r[ci] ?? "").length),
      totalsRow ? String(totalsRow[ci] ?? "").length : 0
    );
    return { wch: Math.min(Math.max(maxLen + 3, 10), 42) };
  });

  // ── Merges para título y subtítulo ───────────────────────────────
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ];

  const HEADER_ROW  = 3;   // índice 0-based de la fila de encabezados
  const DATA_START  = 4;   // primera fila de datos
  const range       = XLSXStyle.utils.decode_range(ws["!ref"]);

  // ── Bordes reutilizables ─────────────────────────────────────────
  const borderThin = (rgb) => ({ style: "thin", color: { rgb } });
  const borderMed  = (rgb) => ({ style: "medium", color: { rgb } });

  const borderData = {
    top: borderThin("AAAAAA"), bottom: borderThin("AAAAAA"),
    left: borderThin("AAAAAA"), right: borderThin("AAAAAA"),
  };
  const borderHeader = {
    top: borderMed("0A5C26"), bottom: borderMed("0A5C26"),
    left: borderThin("0A5C26"), right: borderThin("0A5C26"),
  };
  const borderTotals = {
    top: borderMed("1A7A38"), bottom: borderMed("1A7A38"),
    left: borderThin("1A7A38"), right: borderThin("1A7A38"),
  };

  // ── Aplicar estilos ──────────────────────────────────────────────
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };

      const cell = ws[addr];

      if (R === 0) {
        // Título
        cell.s = {
          font: { name: "Calibri", sz: 15, bold: true, color: { rgb: "155724" } },
          fill: { patternType: "solid", fgColor: { rgb: "D4EDDA" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else if (R === 1) {
        // Subtítulo / fecha
        cell.s = {
          font: { name: "Calibri", sz: 9, italic: true, color: { rgb: "777777" } },
          fill: { patternType: "solid", fgColor: { rgb: "F8FFF8" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      } else if (R === 2) {
        // Fila vacía
        cell.s = { fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } } };
      } else if (R === HEADER_ROW) {
        // Encabezados
        cell.s = {
          font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
          fill: { patternType: "solid", fgColor: { rgb: "1A7A38" } },
          alignment: { horizontal: C === 0 ? "left" : "center", vertical: "center", wrapText: false },
          border: borderHeader,
        };
      } else if (totalsRow && R === range.e.r) {
        // Totales
        cell.s = {
          font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "0A3D1E" } },
          fill: { patternType: "solid", fgColor: { rgb: "B2DFBF" } },
          alignment: { horizontal: C === 0 ? "left" : "center", vertical: "center" },
          border: borderTotals,
        };
      } else if (R >= DATA_START) {
        // Datos alternados
        const isEven = (R - DATA_START) % 2 === 0;
        cell.s = {
          font: { name: "Calibri", sz: 11, color: { rgb: "222222" } },
          fill: { patternType: "solid", fgColor: { rgb: isEven ? "EAF5ED" : "FFFFFF" } },
          alignment: { horizontal: C === 0 ? "left" : "center", vertical: "center" },
          border: borderData,
        };
      }
    }
  }

  // ── Altura de filas ──────────────────────────────────────────────
  ws["!rows"] = allData.map((_, i) => {
    if (i === 0)          return { hpt: 26 };
    if (i === HEADER_ROW) return { hpt: 22 };
    return { hpt: 18 };
  });

  // ── Agregar tabla formateada a la hoja ───────────────────────────
  const tableRef = XLSXStyle.utils.encode_range({
    s: { r: HEADER_ROW, c: 0 },
    e: { r: range.e.r, c: range.e.c }
  });
  
  ws.table = {
    ref: tableRef,
    name: `Tabla_${sheetName.replace(/\s+/g, "_")}`,
    displayName: `Tabla_${sheetName.replace(/\s+/g, "_")}`,
    showHeader: 1,
    tableStyleInfo: {
      name: "TableStyleMedium2",
      showFirstColumn: 0,
      showLastColumn: 0,
      showRowStripes: 1,
      showColumnStripes: 0,
    }
  };

  return ws;
}

/**
 * Exporta un archivo Excel con UNA o VARIAS hojas, todas con el mismo
 * formato profesional (título, encabezados, filas alternadas, totales,
 * bordes). Usar cuando una página tiene varias tablas (ej. "Ingresar
 * Datos": Datos de Proceso + Producción Semanal + Cajas/Palet).
 *
 * sheets: [{ title, headers, rows, totalsRow, sheetName }, ...]
 */
export function exportStyledWorkbook({ fileName, sheets }) {
  const wb = XLSXStyle.utils.book_new();
  sheets.forEach((sheet) => {
    const ws = buildStyledSheet(sheet);
    // Excel limita el nombre de hoja a 31 caracteres y prohíbe : \ / ? * [ ]
    const nombreSeguro = sheet.sheetName.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
    XLSXStyle.utils.book_append_sheet(wb, ws, nombreSeguro);
  });
  XLSXStyle.writeFile(wb, fileName);
}

/**
 * Exporta datos a Excel con formato profesional usando xlsx-js-style
 * (1 sola hoja). Mantiene la firma original para no romper los reportes
 * que ya la usan; por debajo reutiliza exportStyledWorkbook.
 */
export function exportStyledExcel({ title, headers, rows, totalsRow, sheetName, fileName }) {
  exportStyledWorkbook({ fileName, sheets: [{ title, headers, rows, totalsRow, sheetName }] });
}