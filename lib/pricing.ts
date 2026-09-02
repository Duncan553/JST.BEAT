/**
 * BEATS PRICING — one price, held in USD, charged in either currency.
 *
 *   price_usd_wav / price_usd_stems  are the SOURCE OF TRUTH on `beats`.
 *   KES is never stored. It is derived here, so the two can never drift.
 *
 *   pay in USD -> Flutterwave charges the dollar figure, no conversion
 *   pay in KES -> Paystack charges the converted figure, KES only
 *
 * The STORE is deliberately NOT part of this: releases stay priced in KES
 * because they're sold to local buyers over M-Pesa.
 */

// Fallback when the rate API can't be reached. Checkout must never fail
// because a currency service is down — it just uses this instead.
const FALLBACK_USD_TO_KES = Number(process.env.USD_TO_KES_FALLBACK) || 130;

/**
 * The published mid-market rate is NOT what a bank actually settles at, so
 * every KES sale converted at mid-market quietly loses a slice. This margin
 * covers that spread. 1.03 = 3% above mid-market.
 */
const FX_MARGIN = Number(process.env.USD_TO_KES_MARGIN) || 1.03;

/** How long a fetched rate is reused. A day is plenty for KES. */
const RATE_TTL_MS = 24 * 60 * 60 * 1000;

const RATE_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

type CachedRate = { rate: number; fetchedAt: number; source: 'live' | 'fallback' };

// Module-level cache. Every request in this server process shares it, which
// is the point: the price rendered on the page and the price charged at
// checkout must come from the SAME rate, or the STK push shows a different
// number than the page did.
let cache: CachedRate | null = null;

export async function getUsdToKes(): Promise<CachedRate> {
  if (cache && Date.now() - cache.fetchedAt < RATE_TTL_MS) return cache;

  try {
    const res = await fetch(RATE_ENDPOINT, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const live = Number(data?.rates?.KES);

    // Sanity-check the number before trusting money to it. A malformed or
    // wildly wrong response should fall back, not reprice the catalogue.
    if (Number.isFinite(live) && live > 50 && live < 500) {
      cache = { rate: live * FX_MARGIN, fetchedAt: Date.now(), source: 'live' };
      return cache;
    }
    console.error('[pricing] Rate out of sane range, using fallback:', live);
  } catch (err: any) {
    console.error('[pricing] Rate fetch failed, using fallback:', err.message);
  }

  cache = { rate: FALLBACK_USD_TO_KES * FX_MARGIN, fetchedAt: Date.now(), source: 'fallback' };
  return cache;
}

/**
 * Converts a USD price to the KES figure a customer is actually charged.
 *
 * Rounds UP to the nearest 50 — $20 x 133 = 2,660 becomes 2,700. Two reasons:
 * a price like "KSh 2,659.60" looks broken, and rounding DOWN would lose
 * money on every single sale.
 */
export function usdToKes(usd: number, rate: number): number {
  const raw = usd * rate;
  return Math.ceil(raw / 50) * 50;
}

/** Both currencies for one USD price, ready to render. */
export async function priceBoth(usd: number): Promise<{ usd: number; kes: number; rate: number }> {
  const { rate } = await getUsdToKes();
  return { usd: Number(usd), kes: usdToKes(Number(usd), rate), rate };
}
