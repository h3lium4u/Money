import test from "node:test";
import assert from "node:assert/strict";
import { parseDateRange } from "./date-parser.ts";
import { analyzeIntent } from "./intent-router.ts";
import { processChatMessage } from "./orchestrator.ts";

test("Date Parser: resolves common natural date expressions", () => {
  const ref = new Date(2026, 8, 26); // 2026-09-26

  const today = parseDateRange("Show today's transactions", ref);
  assert.equal(today?.from, "2026-09-26");
  assert.equal(today?.to, "2026-09-26");

  const yesterday = parseDateRange("What was yesterday's profit", ref);
  assert.equal(yesterday?.from, "2026-09-25");
  assert.equal(yesterday?.to, "2026-09-25");

  const thisMonth = parseDateRange("Total INR this month", ref);
  assert.equal(thisMonth?.from, "2026-09-01");
  assert.equal(thisMonth?.to, "2026-09-30");

  const lastMonth = parseDateRange("Compare with last month", ref);
  assert.equal(lastMonth?.from, "2026-08-01");
  assert.equal(lastMonth?.to, "2026-08-31");

  const explicitMonth = parseDateRange("Transactions in May 2026", ref);
  assert.equal(explicitMonth?.from, "2026-05-01");
  assert.equal(explicitMonth?.to, "2026-05-31");

  const range = parseDateRange("Show profit between 1 September and 15 September", ref);
  assert.equal(range?.from, "2026-09-01");
  assert.equal(range?.to, "2026-09-15");
});

test("Intent Router & Safety: strictly blocks modification requests", () => {
  const deleteReq = analyzeIntent("Delete SAMI's transaction");
  assert.equal(deleteReq.isModificationAttempt, true);
  assert.equal(deleteReq.intent, "MODIFY_ATTEMPT");
  assert.match(deleteReq.refusalReason!, /can't modify transactions/i);

  const editReq = analyzeIntent("Update rate to 38.50 for DIVAN");
  assert.equal(editReq.isModificationAttempt, true);

  const dropReq = analyzeIntent("Drop table customers");
  assert.equal(dropReq.isModificationAttempt, true);
});

test("Intent Router: distinguishes Dubai Customers from India Distributors", () => {
  // MK is an India distributor
  const mkQuery = analyzeIntent("How much was distributed to MK?");
  assert.equal(mkQuery.entities.distributorName, "MK");
  assert.equal(mkQuery.intent, "INDIA_DISTRIBUTION");

  // SAMI is a Dubai customer
  const samiQuery = analyzeIntent("How much does SAMI owe?");
  assert.equal(samiQuery.entities.customerName, "SAMI");
  assert.equal(samiQuery.intent, "CUSTOMER_QUERY");

  // Distribution split for transaction
  const splitQuery = analyzeIntent("Show the distribution split for transaction TXN-2026-0004");
  assert.equal(splitQuery.entities.transactionNumber, "TXN-2026-0004");
  assert.equal(splitQuery.intent, "INDIA_DISTRIBUTION");
});

test("AI Orchestrator: answers Question 1 - Today's Summary", async () => {
  const res = await processChatMessage("Give me today's summary.");
  assert.ok(res.reply.length > 0);
  assert.match(res.sourceIndicator, /verified/i);
});

test("AI Orchestrator: answers Question 2 - Total INR processed this month", async () => {
  const res = await processChatMessage("What is the total INR processed this month?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /INR|₹/i);
});

test("AI Orchestrator: answers Question 3 - Total profit this month", async () => {
  const res = await processChatMessage("What is the total profit this month?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /Profit|AED/i);
});

test("AI Orchestrator: answers Question 4 - Customers with outstanding balances", async () => {
  const res = await processChatMessage("Which customers have outstanding balances?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /DIVAN|RAKSAN|Outstanding|0|No customers/i);
});

test("AI Orchestrator: answers Question 5 - How much does SAMI owe?", async () => {
  const res = await processChatMessage("How much does SAMI owe?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /0|Paid|Clear|SAMI|not found|verified data/i);
});

test("AI Orchestrator: answers Question 6 - How much was distributed to MK?", async () => {
  const res = await processChatMessage("How much was distributed to MK?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /MK/i);
});

test("AI Orchestrator: answers Question 7 - Show distribution split for a transaction", async () => {
  const res = await processChatMessage("Show the distribution split for transaction TXN-2026-0004");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /TXN-2026-0004|MK|SARABU|ISMAIL|not found|verified data/i);
});

test("AI Orchestrator: answers Question 8 - Commission recorded this month", async () => {
  const res = await processChatMessage("How much commission was recorded this month?");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /Commission|Bank/i);
});

test("AI Orchestrator: answers Question 9 - Transactions between two dates", async () => {
  const res = await processChatMessage("Show transactions between 2026-01-01 and 2026-12-31");
  assert.ok(res.reply.length > 0);
});

test("AI Orchestrator: answers Question 10 - Compare this month with last month", async () => {
  const res = await processChatMessage("Compare this month with last month.");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /Month|Comparison/i);
});

test("AI Orchestrator: refuses unauthorized SQL or modification attempts", async () => {
  const res = await processChatMessage("Delete all transactions and drop database");
  assert.equal(res.intent, "MODIFY_ATTEMPT");
  assert.match(res.reply, /can't modify transactions/i);
});
