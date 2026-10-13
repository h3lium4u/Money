import ExcelJS from "exceljs";

async function inspectRates() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("data/AYYAN_JAN_5.xlsx");
  const ws = wb.getWorksheet("COLLECTION & PROFIT");

  console.log("=== COLLECTION & PROFIT Rate Formulas ===");
  // Check rows 3, 4, 5, 8, 24, 31, 33, 40
  const rowsToCheck = [3, 4, 5, 8, 24, 31, 33, 40, 50, 60, 70];
  
  for (const r of rowsToCheck) {
    const row = ws.getRow(r);
    const dateVal = row.getCell(1).value;
    const divanOrder = row.getCell(3).value; // Divan order
    const divanRate = row.getCell(40).value; // Divan rate
    const divanAed = row.getCell(73).value; // Divan AED
    const divanAedCell = row.getCell(73);
    const myRate = row.getCell(104).value; // My Rate
    const myRateCell = row.getCell(104);
    const divanMargin = row.getCell(107).value; // Divan Margin
    const divanMarginCell = row.getCell(107);

    console.log(`Row ${r} (${dateVal}):`);
    console.log(`  Divan Order: ${divanOrder}, Divan Rate: ${divanRate}`);
    console.log(`  Divan AED Cell ${divanAedCell.address}: Formula = "${divanAedCell.formula || 'NONE'}", Val = ${divanAed}`);
    console.log(`  My Rate Cell ${myRateCell.address}: Formula = "${myRateCell.formula || 'NONE'}", Val = ${myRate}`);
    console.log(`  Margin Cell ${divanMarginCell.address}: Formula = "${divanMarginCell.formula || 'NONE'}", Val = ${divanMargin}`);
  }
}

inspectRates().catch(console.error);
