// Format base-currency amounts without converting decimal strings to binary floats.
export function baseMoney(value: unknown, currency: string, precision?: unknown, unpriced = false) {
  const amount = String(value ?? "");
  if (!/^-?\d+(\.\d+)?$/.test(amount)) return unpriced ? "Unpriced" : "Not recorded";
  if (unpriced && /^-?0+(\.0+)?$/.test(amount)) return "Unpriced";
  const [whole, fraction = ""] = amount.split(".");
  const places = precision === 0 || precision === 2 || precision === 3 ? precision : fraction.length;
  // Don't silently round a stored amount with more significant decimals.
  const decimals = fraction.replace(/0+$/, "").padEnd(places, "0");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${decimals ? "." + decimals : ""} ${currency}`.trim();
}
