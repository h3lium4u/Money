/**
 * Converts numbers into Indian numbering system words (Lakhs, Crores, Thousands).
 * e.g. 120000 -> "One Lakh Twenty Thousand Rupees Only"
 * e.g. 10500 -> integerToIndianWords -> "Ten Thousand Five Hundred"
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

function convertIntegerToWords(n: number): string {
  if (n === 0) return "Zero";
  let words = "";

  // Crores (>= 1,00,00,000)
  const crores = Math.floor(n / 10000000);
  if (crores > 0) {
    words += convertIntegerToWords(crores) + (crores > 1 ? " Crores " : " Crore ");
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

  // Remaining (< 1,000)
  if (n > 0) {
    words += convertBelowThousand(n) + " ";
  }

  return words.trim();
}

/**
 * Returns clean words for the integer part of an amount before the decimal point,
 * using the Indian numbering system (e.g. 10500 -> "Ten Thousand Five Hundred").
 */
export function integerToIndianWords(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === "") return "";
  const num = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : Number(amount);
  if (isNaN(num)) return "";
  const absVal = Math.abs(num);
  // Integer part before decimal cleanly rounded to eliminate IEEE-754 drift
  const clean = Math.round((absVal + Number.EPSILON) * 100) / 100;
  const intPart = Math.floor(clean);
  if (intPart === 0) return "Zero";

  const words = convertIntegerToWords(intPart);
  return num < 0 ? `Minus ${words}` : words;
}

/**
 * Cleanly format an INR amount into Indian numbering representation.
 * - Eliminates IEEE-754 floating-point drift (e.g. .5800000002 -> .58)
 * - Avoids trailing .000 or unnecessary decimals on round integers
 * - Formats decimal paise up to 2 decimal places if present
 */
export function formatINR(val?: number | string | null): string {
  if (val === null || val === undefined || val === "") return "₹ 0";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (isNaN(num)) return `₹ ${val}`;
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  const clean = Math.round((absVal + Number.EPSILON) * 100) / 100;
  const hasDecimals = clean % 1 !== 0;
  const formatted = clean.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? "-" : ""}₹ ${formatted}`;
}

/**
 * Cleanly format an AED amount into standard representation.
 * - Eliminates IEEE-754 drift
 * - Avoids trailing .000 on round integers
 */
export function formatAED(val?: number | string | null): string {
  if (val === null || val === undefined || val === "") return "0 AED";
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : Number(val);
  if (isNaN(num)) return `${val} AED`;
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  const clean = Math.round((absVal + Number.EPSILON) * 100) / 100;
  const hasDecimals = clean % 1 !== 0;
  const formatted = clean.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? "-" : ""}${formatted} AED`;
}

/**
 * Cleanly format rate numbers without unnecessary trailing zeroes or NaN
 */
export function formatRate(val?: any): string {
  if (val === null || val === undefined || val === "") return "-";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
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
