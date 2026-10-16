import { processChatMessage } from "../src/lib/ai/orchestrator.ts";

async function main() {
  const sampleQuestions = [
    "What are the details in the excel sheet?",
    "how many rows in excel?",
    "Show transactions from the excel file",
    "What is the balance of SATHIK from xl?",
    "What is the balance of Aslam from xl?",
    "tell me about customer Aslam",
    "tell me about customer DIVAN",
    "show me all transactions",
    "What is our total profit across all data?",
    "Who owes money right now?",
    "What are the India distributors?",
    "How much was distributed to MK?",
    "Compare this month with last month"
  ];

  console.log(`Testing ${sampleQuestions.length} sample questions...\n`);

  for (const q of sampleQuestions) {
    console.log(`================================================================`);
    console.log(`USER: "${q}"`);
    try {
      const res = await processChatMessage(q);
      console.log(`INTENT: ${res.intent} | PROVIDER: ${res.provider} (${res.model}) | TIME: ${res.executionTimeMs}ms`);
      console.log(`SOURCE: ${res.sourceIndicator.replace(/\n/g, ' - ')}`);
      console.log(`REPLY:\n${res.reply}\n`);
    } catch (err) {
      console.error(`ERROR:`, err.message);
    }
  }
}

main().catch(console.error);
