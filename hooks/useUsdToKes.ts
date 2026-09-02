'use client';

import { useEffect, useState } from 'react';
import { usdToKes } from '@/lib/currency';

// Beats are priced in USD — that is what the producer sets and what the DB
// stores. KES is DERIVED, never stored, so the two can't drift apart.
//
// This pulls the same cached rate the server charges with (/api/pricing/rate,
// which reads lib/pricing.ts) so the KSh on a beat card is the KSh the M-Pesa
// prompt asks for. Before this hook existed the storefront rendered
// `price_wav` — a KES snapshot frozen on the day the beat was uploaded, which
// quietly disagreed with checkout as soon as the shilling moved.

let cached: number | null = null;          // shared across components
let inflight: Promise<number | null> | null = null;

async function fetchRate(): Promise<number | null> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch('/api/pricing/rate')
      .then((r) => r.json())
      .then((d) => {
        cached = Number(d.usdToKes) || null;
        return cached;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useUsdToKes() {
  const [rate, setRate] = useState<number | null>(cached);

  useEffect(() => {
    if (rate) return;
    let alive = true;
    fetchRate().then((r) => { if (alive) setRate(r); });
    return () => { alive = false; };
  }, [rate]);

  return {
    rate,
    /** KES for a USD price, or null until the rate lands — render USD alone
     *  rather than flashing a number that might be wrong. */
    kes: (usd: number): number | null => (rate ? usdToKes(usd, rate) : null),
  };
}
