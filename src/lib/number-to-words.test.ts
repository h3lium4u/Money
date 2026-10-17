import test from "node:test";
import assert from "node:assert/strict";
import {
  numberToIndianWords,
  integerToIndianWords,
  formatINR,
  formatAED,
  formatRate,
} from "./number-to-words.ts";

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

test("integerToIndianWords extracts integer amount in Indian words", () => {
  // User's exact prompt example: "like ten thousand five hunder....."
  assert.equal(integerToIndianWords(10500), "Ten Thousand Five Hundred");
  assert.equal(integerToIndianWords("10500"), "Ten Thousand Five Hundred");
  assert.equal(integerToIndianWords("10,500.50"), "Ten Thousand Five Hundred");

  // MK total from user screenshot: 1,03,31,365.5800000002
  assert.equal(
    integerToIndianWords(10331365.5800000002),
    "One Crore Three Lakhs Thirty One Thousand Three Hundred Sixty Five"
  );

  // SALA total from user screenshot: 55,33,167.6099999985
  assert.equal(
    integerToIndianWords(5533167.6099999985),
    "Fifty Five Lakhs Thirty Three Thousand One Hundred Sixty Seven"
  );

  // Customer order: 25,64,466.8099999996
  assert.equal(
    integerToIndianWords(2564466.8099999996),
    "Twenty Five Lakhs Sixty Four Thousand Four Hundred Sixty Six"
  );

  // Full pool: 27,81,62,847
  assert.equal(
    integerToIndianWords(278162847),
    "Twenty Seven Crores Eighty One Lakhs Sixty Two Thousand Eight Hundred Forty Seven"
  );

  // Zero and edge cases
  assert.equal(integerToIndianWords(0), "Zero");
  assert.equal(integerToIndianWords(""), "");
  assert.equal(integerToIndianWords(null), "");
  assert.equal(integerToIndianWords(undefined), "");
});

test("formatINR eliminates IEEE-754 drift and extra zeroes after decimal", () => {
  // Eliminates IEEE-754 drift from screenshot: .5800000002 -> .58
  assert.equal(formatINR(10331365.5800000002), "₹ 1,03,31,365.58");
  assert.equal(formatINR(5533167.6099999985), "₹ 55,33,167.61");
  assert.equal(formatINR(2564466.8099999996), "₹ 25,64,466.81");

  // Round integers have NO extra zeroes (.00 or .000)
  assert.equal(formatINR(100000), "₹ 1,00,000");
  assert.equal(formatINR(10500), "₹ 10,500");
  assert.equal(formatINR(278162847), "₹ 27,81,62,847");
  assert.equal(formatINR(0), "₹ 0");

  // Handles strings and negative values
  assert.equal(formatINR("12345.50"), "₹ 12,345.50");
  assert.equal(formatINR(-500), "-₹ 500");
});

test("formatAED eliminates IEEE-754 drift and extra zeroes after decimal", () => {
  assert.equal(formatAED(100000), "100,000 AED");
  assert.equal(formatAED(1234.56), "1,234.56 AED");
  assert.equal(formatAED(0), "0 AED");
});

test("formatRate formats cleanly", () => {
  assert.equal(formatRate(22.5), "22.5");
  assert.equal(formatRate(44.600), "44.6");
  assert.equal(formatRate(null), "-");
});
