import test from "node:test";
import assert from "node:assert/strict";
import { numberToIndianWords } from "./number-to-words.ts";

test("numberToIndianWords converts Indian remittance amounts correctly", () => {
  // User's specific example: 120000
  assert.equal(numberToIndianWords(120000), "One Lakh Twenty Thousand Rupees Only");
  assert.equal(numberToIndianWords("120000"), "One Lakh Twenty Thousand Rupees Only");

  // Other common remittance denominations
  assert.equal(numberToIndianWords(500000), "Five Lakhs Rupees Only");
  assert.equal(numberToIndianWords(1000000), "Ten Lakhs Rupees Only");
  assert.equal(numberToIndianWords(2000000), "Twenty Lakhs Rupees Only");
  assert.equal(numberToIndianWords(10000000), "One Crore Rupees Only");
  assert.equal(numberToIndianWords(1500), "One Thousand Five Hundred Rupees Only");
  assert.equal(numberToIndianWords(0), "Zero Rupees Only");
  assert.equal(numberToIndianWords(""), "");
  assert.equal(numberToIndianWords(null), "");
});
