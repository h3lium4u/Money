import { query } from "../src/lib/db.ts";

async function checkPaymentMethods() {
  const pmtCols = await query(`SELECT DISTINCT payment_method FROM customer_payments`);
  console.log("Distinct payment_methods in customer_payments:", pmtCols);
}

checkPaymentMethods().catch(console.error);
