// The ONE rounding rule for turning a USD price into the KES a buyer is
// charged. It lives here, with no server-only imports, so the browser and the
// API routes can share it — if the page rounded differently from checkout, the
// STK push would ask for a different number than the card said.
//
// Rounds UP to the nearest 50: $20 x 133 = 2,660 becomes 2,700. A price like
// "KSh 2,659.60" looks broken, and rounding DOWN loses money on every sale.
export function usdToKes(usd: number, rate: number): number {
  const raw = Number(usd) * Number(rate);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.ceil(raw / 50) * 50;
}

/** "KSh 2,700" — thousands separators, no stray decimals. */
export function formatKes(kes: number): string {
  return `KSh ${Math.round(kes).toLocaleString('en-KE')}`;
}

/** "$20" for whole dollars, "$19.50" when there are cents. */
export function formatUsd(usd: number): string {
  const n = Number(usd);
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}
