// Upload-time only: producer types a price in whichever currency they think
// in, we normalize to KES before it ever hits the server — the DB and every
// Paystack charge only ever deal in KES, so there's exactly one source of
// truth and no risk of currency mismatches at checkout. Fixed rate (not
// fetched live) to keep this dependency-free; bump NEXT_PUBLIC_USD_TO_KES
// when it drifts.
const USD_TO_KES = Number(process.env.NEXT_PUBLIC_USD_TO_KES) || 130;

export type Currency = 'KES' | 'USD';

export function toKes(amount: number, currency: Currency): number {
  return currency === 'USD' ? Math.round(amount * USD_TO_KES) : Math.round(amount);
}
