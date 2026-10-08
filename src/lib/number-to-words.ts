/**
 * Converts numbers into Indian numbering system words (Lakhs, Crores, Thousands).
 * e.g. 120000 -> "One Lakh Twenty Thousand Rupees Only"
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertBelowThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

export function numberToIndianWords(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === "") return "";
  const num = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;
  if (isNaN(num) || num < 0) return "";
  if (num === 0) return "Zero Rupees Only";

  // Clean rounding to 2 decimal places with EPSILON to prevent IEEE 754 float drift
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  let integerPart = Math.floor(rounded);
  let decimalPart = Math.round((rounded - integerPart) * 100);

  if (decimalPart >= 100) {
    integerPart += 1;
    decimalPart = 0;
  }

  let n = integerPart;
  let words = "";

  // Crores (>= 1,00,00,000)
  const crores = Math.floor(n / 10000000);
  if (crores > 0) {
    words += convertBelowThousand(crores) + " Crore ";
    n %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  const lakhs = Math.floor(n / 100000);
  if (lakhs > 0) {
    words += convertBelowThousand(lakhs) + (lakhs > 1 ? " Lakhs " : " Lakh ");
    n %= 100000;
  }

  // Thousands (>= 1,000)
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    words += convertBelowThousand(thousands) + " Thousand ";
    n %= 1000;
  }

  // Hundreds & Remaining (< 1,000)
  if (n > 0) {
    words += convertBelowThousand(n) + " ";
  }

  words = words.trim();
  if (words.length > 0) {
    words += " Rupees";
  }

  if (decimalPart > 0) {
    words += " and " + convertBelowThousand(decimalPart) + " Paise";
  }

  return words + " Only";
}
