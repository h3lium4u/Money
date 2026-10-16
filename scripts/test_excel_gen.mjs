import { generateNormalizedMasterWorkbook } from "../src/lib/reports/normalized-master-generator.ts";
import fs from "fs/promises";

async function main() {
  console.log("Generating normalized master workbook...");
  const t0 = Date.now();
  const buffer = await generateNormalizedMasterWorkbook();
  console.log(`Generated in ${Date.now() - t0}ms, size: ${buffer.length} bytes`);
  await fs.writeFile("Accounts_Business_Normalized_Master.xlsx", buffer);
  console.log("Wrote Accounts_Business_Normalized_Master.xlsx successfully!");
}

main().catch(console.error);
