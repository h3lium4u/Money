import test from "node:test";
import assert from "node:assert/strict";
import { formatBytes, getStorageStatus, getDatabaseUsage } from "./system-health.ts";

test("formatBytes formats values correctly", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(81920), "80 KB");
  assert.equal(formatBytes(325058560), "310 MB");
  assert.equal(formatBytes(199229440), "190 MB");
  assert.equal(formatBytes(524288000), "500 MB");
  assert.equal(formatBytes(1073741824), "1 GB");
  assert.equal(formatBytes(null), "Unavailable");
  assert.equal(formatBytes(undefined), "Unavailable");
});

test("getStorageStatus correctly applies defined thresholds", () => {
  // 0–70% -> normal
  assert.equal(getStorageStatus(0).status, "normal");
  assert.equal(getStorageStatus(50).status, "normal");
  assert.equal(getStorageStatus(62).status, "normal");
  assert.equal(getStorageStatus(69.9).status, "normal");

  // 70–85% -> getting-high
  assert.equal(getStorageStatus(70).status, "getting-high");
  assert.equal(getStorageStatus(75).status, "getting-high");
  assert.equal(getStorageStatus(84.9).status, "getting-high");

  // 85–95% -> high
  assert.equal(getStorageStatus(85).status, "high");
  assert.equal(getStorageStatus(90).status, "high");
  assert.equal(getStorageStatus(94.9).status, "high");

  // 95%+ -> critical
  assert.equal(getStorageStatus(95).status, "critical");
  assert.equal(getStorageStatus(98).status, "critical");
  assert.equal(getStorageStatus(100).status, "critical");

  // null (quota unavailable)
  assert.equal(getStorageStatus(null).status, "normal");
});

test("getDatabaseUsage simulation: normal scenario (62%)", async () => {
  const result = await getDatabaseUsage({ scenario: "normal" });
  assert.equal(result.usagePercent, 62);
  assert.equal(result.status, "normal");
  assert.equal(result.limitKnown, true);
  assert.equal(result.usedFormatted, "310 MB");
  assert.equal(result.availableFormatted, "190 MB");
  assert.equal(result.limitFormatted, "500 MB");
  assert.equal(result.availableBytes, result.limitBytes! - result.usedBytes);
  assert.equal(result.isSimulated, true);
});

test("getDatabaseUsage simulation: getting-high scenario (76%)", async () => {
  const result = await getDatabaseUsage({ scenario: "getting-high" });
  assert.equal(result.usagePercent, 76);
  assert.equal(result.status, "getting-high");
  assert.equal(result.limitKnown, true);
  assert.match(result.statusMessage, /getting high/i);
});

test("getDatabaseUsage simulation: high scenario (89%)", async () => {
  const result = await getDatabaseUsage({ scenario: "high" });
  assert.equal(result.usagePercent, 89);
  assert.equal(result.status, "high");
  assert.equal(result.limitKnown, true);
  assert.match(result.statusMessage, /high storage/i);
});

test("getDatabaseUsage simulation: critical scenario (97%)", async () => {
  const result = await getDatabaseUsage({ scenario: "critical" });
  assert.equal(result.usagePercent, 97);
  assert.equal(result.status, "critical");
  assert.equal(result.limitKnown, true);
  assert.match(result.statusMessage, /critical/i);
});

test("getDatabaseUsage simulation: unavailable limit scenario", async () => {
  const result = await getDatabaseUsage({ scenario: "unavailable" });
  assert.equal(result.limitKnown, false);
  assert.equal(result.limitBytes, null);
  assert.equal(result.availableBytes, null);
  assert.equal(result.usagePercent, null);
  assert.equal(result.limitFormatted, null);
  assert.equal(result.availableFormatted, null);
  assert.ok(result.usedBytes > 0);
  assert.equal(result.status, "normal");
});

test("getDatabaseUsage response does not leak credentials or connection strings", async () => {
  const result = await getDatabaseUsage();
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("postgresql://"), false);
  assert.equal(serialized.includes("npg_"), false);
});

test("resolveStorageLimit handles 0.5GB and 500MB environment configurations", async () => {
  const { resolveStorageLimit } = await import("./system-health.ts");

  // Test NEON_STORAGE_LIMIT_GB=0.5
  process.env.NEON_STORAGE_LIMIT_GB = "0.5";
  const gbRes = await resolveStorageLimit();
  assert.equal(gbRes.limitBytes, 500 * 1024 * 1024);
  delete process.env.NEON_STORAGE_LIMIT_GB;

  // Test NEON_STORAGE_LIMIT_MB=500
  process.env.NEON_STORAGE_LIMIT_MB = "500";
  const mbRes = await resolveStorageLimit();
  assert.equal(mbRes.limitBytes, 500 * 1024 * 1024);
  delete process.env.NEON_STORAGE_LIMIT_MB;
});

