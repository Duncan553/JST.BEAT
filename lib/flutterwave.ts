/**
 * FLUTTERWAVE — the USD path for beats.
 *
 * Paystack handles KES and only KES (see lib/paystack.ts, where the currency
 * is hardcoded). Flutterwave handles USD and only USD. Neither ever touches
 * the other's currency, which is what keeps the two from ever disagreeing
 * about what a customer owes.
 *
 * SET UP LATER: this module is complete but inert until the env vars below
 * exist. `isFlutterwaveConfigured()` is what the checkout route asks before
 * offering the dollar option, so a missing key shows the customer a clean
 * "card payments unavailable" instead of a crash.
 *
 *   FLUTTERWAVE_SECRET_KEY   — from the Flutterwave dashboard
 *   FLUTTERWAVE_PUBLIC_KEY
 *   JSTDAN_FLW_SUBACCOUNT    — optional, per-producer payout routing
 *   TISCO_FLW_SUBACCOUNT
 *
 * Note on subaccounts: Flutterwave collection subaccounts settle to BANK
 * accounts, not M-Pesa wallets — unlike Paystack. So USD sales can't auto-
 * split to an M-Pesa line the way KES sales do. Until both producers supply
 * bank details, leave the subaccount vars unset and settle up manually from
 * the Earnings tab.
 */

const FLW_BASE = 'https://api.flutterwave.com/v3';

export function isFlutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

function secret(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error('Flutterwave is not configured yet');
  return key;
}

/** Maps a producer to their subaccount, if one has been set up. */
export function subaccountFor(producer: string | null): string | undefined {
  if (producer === 'jst.dan') return process.env.JSTDAN_FLW_SUBACCOUNT || undefined;
  if (producer === 'tisco prodz') return process.env.TISCO_FLW_SUBACCOUNT || undefined;
  return undefined;
}

export type FlwSubaccountSplit = {
  id: string;
  /**
   * An EXACT amount for this subaccount, not a ratio. transaction_split_ratio
   * only expresses coarse proportions (2:3:5), which can't represent a real
   * cart — $20 of one producer's work plus $15 of another's is 57/43.
   */
  transaction_charge_type: 'flat_subaccount';
  transaction_charge: number;
};

/**
 * Starts a USD payment and returns Flutterwave's hosted checkout URL.
 * We never see or handle card details — same posture as the Paystack card path.
 */
export async function initializeUsdPayment({
  email,
  amountUsd,
  reference,
  redirectUrl,
  metadata = {},
  subaccounts = [],
  customerName,
  customerPhone,
}: {
  email: string;
  amountUsd: number;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, any>;
  subaccounts?: FlwSubaccountSplit[];
  customerName?: string;
  customerPhone?: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount: amountUsd,
      currency: 'USD', // never anything else from this module
      redirect_url: redirectUrl,
      customer: {
        email,
        ...(customerName ? { name: customerName } : {}),
        ...(customerPhone ? { phonenumber: customerPhone } : {}),
      },
      customizations: {
        title: process.env.NEXT_PUBLIC_BUSINESS_NAME || 'JST.BEAT',
        description: 'Beat licence',
      },
      meta: metadata,
      ...(subaccounts.length ? { subaccounts } : {}),
    }),
  });

  const data = await res.json();
  if (data?.status !== 'success' || !data?.data?.link) {
    throw new Error(data?.message || 'Could not start the dollar payment');
  }
  return { authorizationUrl: data.data.link, reference };
}

/**
 * Confirms a transaction with Flutterwave directly. Never trust the browser's
 * redirect — the same rule as the Paystack verify path.
 *
 * Returns the amount and currency Flutterwave actually settled so the caller
 * can check them against the order before releasing any files.
 */
export async function verifyUsdPayment(reference: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  amount: number | null;
  currency: string | null;
  raw: any;
}> {
  const res = await fetch(
    `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret()}` } }
  );
  const data = await res.json();

  const tx = data?.data;
  if (data?.status !== 'success' || !tx) {
    return { status: 'pending', amount: null, currency: null, raw: data };
  }

  const flwStatus = String(tx.status || '').toLowerCase();
  const status = flwStatus === 'successful' ? 'success' : flwStatus === 'failed' ? 'failed' : 'pending';

  return {
    status,
    amount: Number(tx.amount_settled ?? tx.amount) || null,
    currency: tx.currency || null,
    raw: tx,
  };
}
