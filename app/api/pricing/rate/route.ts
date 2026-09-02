import { NextResponse } from 'next/server';
import { getUsdToKes } from '@/lib/pricing';

// The beats catalogue is fetched client-side, so the browser needs the same
// rate the server uses — otherwise the KES price on a beat card wouldn't
// match the one charged at checkout.
//
// The rate is not a secret; it's a published exchange rate. What stays
// server-side is the AUTHORITY: /api/paystack/initialize recomputes every
// price from the database and this same cached rate, so a tampered client
// changes nothing about what actually gets charged.
export const revalidate = 3600;

export async function GET() {
  const { rate, source, fetchedAt } = await getUsdToKes();
  return NextResponse.json({
    usdToKes: rate,
    source,      // 'live' or 'fallback' — useful when a price looks wrong
    fetchedAt,
  });
}
