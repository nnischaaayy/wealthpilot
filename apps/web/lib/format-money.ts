const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  let formatter = formatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency });
    formatterCache.set(currency, formatter);
  }
  return formatter;
}

/** amountMinor is an integer in minor units (cents/paise). */
export function formatMoney(amountMinor: number, currency: string): string {
  return getFormatter(currency).format(amountMinor / 100);
}
