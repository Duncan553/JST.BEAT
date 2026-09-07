import { NextResponse } from 'next/server';
import { isFlutterwaveConfigured } from '@/lib/flutterwave';

/**
 * Which currencies checkout can actually charge right now.
 *
 * The cart is a client component, so it cannot read FLUTTERWAVE_SECRET_KEY to
 * find out whether the dollar path is live. Without this it renders a "USD ·
 * card" button that always looks available, and the buyer only discovers it is
 * switched off AFTER choosing it, typing their email and pressing pay —
 * /api/paystack/initialize answers 503 at that point.
 *
 * Nothing secret is exposed: this is a yes/no about a payment option, the same
 * thing the buyer learns one click later anyway. The key itself never leaves
 * the server, and this endpoint is NOT the authority — initialize still
 * re-checks before charging, so a tampered client gains nothing.
 */
export const dynamic = 'force-dynamic'; // reads env at request time, never baked into a build

export async function GET() {
  return NextResponse.json({
    kes: true,                          // Paystack; the always-on path
    usd: isFlutterwaveConfigured(),     // Flutterwave; inert until the key is set
  });
}
