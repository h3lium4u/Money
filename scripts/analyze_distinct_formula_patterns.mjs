import fs from "fs";

function analyzePatterns() {
  const content = fs.readFileSync("qa-artifacts/02-workbook-formulas.csv", "utf8");
  const lines = content.split("\n").slice(1);

  const patternMap = new Map();
  const sheetStats = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Parse CSV line
    // Format: "Worksheet","Cell",Row,Col,"Formula","CachedResult","Category","ValidationStatus"
    const match = line.match(/^"([^"]+)","([^"]+)",(\d+),(\d+),"((?:[^"]|"")*)","((?:[^"]|"")*)","([^"]+)","([^"]+)"$/);
    if (!match) continue;

    const [, worksheet, cell, row, col, formulaEscaped, cached, category] = match;
    const formula = formulaEscaped.replace(/""/g, '"');

    if (!sheetStats[worksheet]) {
      sheetStats[worksheet] = { count: 0, categories: {} };
    }
    sheetStats[worksheet].count++;
    sheetStats[worksheet].categories[category] = (sheetStats[worksheet].categories[category] || 0) + 1;

    // Normalize formula to archetype pattern by replacing coordinates (e.g. A1, $B$2) with placeholder
    const normalized = formula
      .replace(/\$?[A-Z]+\$?\d+/g, "REF")
      .replace(/\s+/g, "");

    const key = `${worksheet} :: ${normalized}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        worksheet,
        normalizedPattern: normalized,
        exampleFormula: formula,
        exampleCell: cell,
        category,
        count: 0,
        sampleCached: cached
      });
    }
    patternMap.get(key).count++;
  }

  console.log("=== SHEET FORMULA DISTRIBUTION ===");
  for (const [sheet, stats] of Object.entries(sheetStats)) {
    console.log(`\nSheet: ${sheet} (Total: ${stats.count} formulas)`);
    for (const [cat, cnt] of Object.entries(stats.categories)) {
      console.log(`  - ${cat}: ${cnt}`);
    }
  }

  console.log(`\n=== DISTINCT FORMULA PATTERNS FOUND: ${patternMap.size} unique patterns ===`);
  
  // Sort patterns by frequency
  const sorted = Array.from(patternMap.values()).sort((a, b) => b.count - a.count);
  for (let i = 0; i < Math.min(25, sorted.length); i++) {
    const p = sorted[i];
    console.log(`${i + 1}. [${p.worksheet}] Pattern: "${p.normalizedPattern}" (Occurrences: ${p.count}, Example: ${p.exampleCell}="${p.exampleFormula}")`);
  }

  // Save distinct patterns to qa-artifacts/06-distinct-formula-archetypes.json
  fs.writeFileSync("qa-artifacts/06-distinct-formula-archetypes.json", JSON.stringify(sorted, null, 2));
  console.log("\n✔ Saved qa-artifacts/06-distinct-formula-archetypes.json");
}

analyzePatterns();
