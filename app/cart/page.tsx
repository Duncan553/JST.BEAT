'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import Link from 'next/link';
import { useUsdToKes } from '@/hooks/useUsdToKes';
import { formatUsd, formatKes } from '@/lib/currency';
import { EmptyState } from '@/components/EmptyState';

// Checkout always shows KSh, regardless of the browse-page currency toggle —
// that's the one currency that's ever actually charged (M-Pesa and card
// both settle in KES), so showing a USD estimate here would be misleading.

// useSearchParams() (used below to catch the ?reference= Paystack sends
// back after a card payment) requires a Suspense boundary in the App
// Router, or `next build` fails.
export default function CartPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto p-6 text-stone-500">Loading...</div>}>
      <CartPageInner />
    </Suspense>
  );
}

function CartPageInner() {
  const { items, removeItem, clearCart } = useCartStore();

  // Beats are priced in USD; the KSh figure is derived from the same cached
  // rate /api/paystack/initialize charges with. Store releases are KES-native
  // (no priceUsd) and pass through untouched.
  const { kes } = useUsdToKes();
  const lineKes = (item: { price: number; priceUsd?: number }) =>
    item.priceUsd ? kes(item.priceUsd) ?? item.price : item.price;
  const totalKes = items.reduce((sum, i) => sum + lineKes(i), 0);
  const totalUsdBeats = items.reduce((sum, i) => sum + (i.priceUsd || 0), 0);
  // A store release is KES-native (no priceUsd). The initialize route already
  // refuses USD for these; knowing it here just moves the message earlier.
  // A release is stored with priceUsd undefined (see useCartStore.addItem) —
  // that absence IS the marker. `kind` lives on i.beat, not on the item, so
  // checking i.kind here would always be undefined and silently pass.
  const hasRelease = items.some((i) => i.priceUsd == null);
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'mpesa' | 'card'>('mpesa');
  // KES -> Paystack (M-Pesa or card). USD -> Flutterwave.
  const [currency, setCurrency] = useState<'KES' | 'USD'>('KES');
  // null = still asking. Until the answer lands the dollar button stays
  // disabled, because offering an option that might not work is worse than
  // showing it a moment late.
  const [usdLive, setUsdLive] = useState<boolean | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [stkSent, setStkSent] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [reference, setReference] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloads, setDownloads] = useState<Array<{ beat_id: string; title: string; url: string; license: string }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ask the server whether dollars can actually be charged. See
  // app/api/payments/methods/route.ts for why the client cannot know this.
  useEffect(() => {
    let alive = true;
    fetch('/api/payments/methods')
      .then((r) => r.json())
      .then((d) => { if (alive) setUsdLive(Boolean(d?.usd)); })
      // A failed probe must not silently offer a dead path.
      .catch(() => { if (alive) setUsdLive(false); });
    return () => { alive = false; };
  }, []);

  const validatePhone = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };

  const handlePay = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Enter a valid email address. Paystack requires it for receipts.');
      return;
    }
    if (currency === 'KES' && method === 'mpesa' && !validatePhone(phone)) {
      setMessage('Enter a valid M-Pesa phone number (e.g. 0712345678).');
      return;
    }
    if (items.length === 0) {
      setMessage('Your cart is empty.');
      return;
    }

    setPaying(true);
    setMessage('');

    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          method,
          currency,
          items: items.map(i => ({
            title: i.beat.title,
            beat_id: i.beat.id,
            license: i.license,
            price: i.price,
            // Tells the server which table to price this from. Beats and
            // store releases share one cart but not one catalogue.
            kind: (i.beat as any).kind === 'release' ? 'release' : 'beat',
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed.');

      if (data.method === 'card' || data.currency === 'USD') {
        // Full redirect to Paystack's hosted card page — cart is in
        // localStorage so it survives the trip. They land back on /cart
        // with ?reference=... which the mount effect above picks up.
        window.location.assign(data.authorizationUrl);
        return;
      }

      setStkSent(true);
      setReference(data.reference);
      setMessage(data.message || 'M-Pesa prompt sent! Enter your PIN on your phone.');
      pollVerification(data.reference);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  const pollVerification = async (ref: string) => {
    let attempts = 0;
    const maxAttempts = 24;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/paystack/verify?reference=${ref}`);
        const data = await res.json();

        if (data.status === 'success') {
          clearInterval(interval);
          setPaid(true);
          setMessage(`Payment successful! KSh ${data.amount} received.`);
          loadDownloads(ref);
          return;
        }

        if (['failed', 'abandoned'].includes(data.status)) {
          clearInterval(interval);
          setMessage('Payment failed or was cancelled.');
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setMessage('Payment verification timed out. Check your M-Pesa messages.');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000);
  };

  const verifyReference = async (ref: string) => {
    setChecking(true);
    try {
      const res = await fetch(`/api/paystack/verify?reference=${ref}`);
      const data = await res.json();

      if (data.status === 'success') {
        setPaid(true);
        setMessage(`Payment successful! KSh ${data.amount} received.`);
        loadDownloads(ref);
      } else if (['failed', 'abandoned'].includes(data.status)) {
        setMessage('Payment failed or was cancelled.');
      } else if (data.status === 'flagged') {
        setMessage('Payment amount could not be verified. Contact support with your reference.');
      } else {
        setMessage('Still waiting for confirmation. Try again in a few seconds.');
      }
    } catch (err) {
      setMessage('Could not check payment status. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const checkNow = () => reference && verifyReference(reference);

  const loadDownloads = async (ref: string) => {
    try {
      const res = await fetch(`/api/orders/download?reference=${ref}`);
      const data = await res.json();
      if (data.success) {
        setDownloads(data.downloads || []);
      }
    } catch (err) {
      console.error('Download load error:', err);
    }
  };

  useEffect(() => {
    // Card payments redirect off-site to Paystack and back — Paystack sends
    // the shopper back here with ?reference=... (or ?trxref=...), so pick
    // it up and verify automatically instead of leaving them stuck.
    const returned = searchParams.get('reference') || searchParams.get('trxref');
    if (returned) {
      setReference(returned);
      setMethod('card');
      setStkSent(true);
      setMessage('Confirming your payment...');
      verifyReference(returned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Licence is part of the identity now — a cart can hold the WAV and the
  // Stems of the same beat, and Remove must only drop the one you clicked.
  const handleRemove = (beatId: string, license: 'wav' | 'stems', title: string) => {
    if (window.confirm(`Remove "${title}" (${license.toUpperCase()}) from your cart?`)) {
      removeItem(beatId, license);
    }
  };

  const handleClearCart = () => {
    if (confirmClear) {
      clearCart();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4 text-orange-100">Your Cart</h1>
        <p className="text-stone-500">Loading...</p>
      </div>
    );
  }

  if (items.length === 0 && !paid) {
    return (
      <div className="max-w-2xl mx-auto p-6 min-h-[60vh] flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-4 text-orange-100">Your Cart</h1>
        <EmptyState
          title="Your cart is empty"
          body="Pick a WAV or the full stems from either catalogue and it'll show up here."
          action={{ label: 'Browse the beats', href: '/beats' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-48 md:pb-32">
      <h1 className="text-2xl font-bold mb-1 text-orange-100">Checkout</h1>
      <p className="text-sm text-stone-500 mb-6">{items.length} beat{items.length !== 1 ? 's' : ''} in your order</p>

      {!paid && (
        <div className="border border-stone-800 rounded-2xl bg-stone-900/40 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-stone-800 bg-stone-900/60">
            <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wide">Order Summary</h2>
          </div>
          <div className="divide-y divide-stone-800">
            {items.map((item) => (
              <div key={`${item.beat.id}-${item.license}`} className="flex items-center gap-3 p-4">
                <div
                  className="w-12 h-12 rounded-lg bg-stone-800 bg-cover bg-center shrink-0 border border-stone-700"
                  style={item.beat.cover_art ? { backgroundImage: `url(${item.beat.cover_art})` } : undefined}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-orange-100 truncate text-sm" title={item.beat.title}>{item.beat.title}</h3>
                  <p className="text-xs text-stone-500">{item.license.toUpperCase()} Lease</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-right">
                    {/* A beat shows its dollar price with the shilling it
                        converts to; a release only ever has shillings. */}
                    <span className="block font-bold text-orange-100 tabular-nums text-sm">
                      {item.priceUsd ? formatUsd(item.priceUsd) : formatKes(item.price)}
                    </span>
                    {item.priceUsd && (
                      <span className="block text-[11px] text-stone-500 tabular-nums">≈ {formatKes(lineKes(item))}</span>
                    )}
                  </span>
                  <button onClick={() => handleRemove(item.beat.id, item.license, item.beat.title)} className="text-red-400 text-xs hover:underline focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-5 py-4 bg-stone-900/60 border-t border-stone-800">
            <span className="text-base font-bold text-orange-100">Total</span>
            <span className="text-right">
              {/* Whichever currency will actually be CHARGED is the big number.
                  Showing a big KSh total to someone whose card is about to be
                  billed in dollars reads as a bait-and-switch, even though both
                  figures are correct — the buyer cannot tell which one leaves
                  their account. */}
              {currency === 'USD' ? (
                <>
                  <span className="block text-lg font-bold text-orange-100 tabular-nums">{formatUsd(totalUsdBeats)}</span>
                  <span className="block text-[11px] text-stone-500 tabular-nums">about {formatKes(totalKes)}</span>
                </>
              ) : (
                <>
                  <span className="block text-lg font-bold text-orange-100 tabular-nums">{formatKes(totalKes)}</span>
                  {totalUsdBeats > 0 && (
                    <span className="block text-[11px] text-stone-500 tabular-nums">{formatUsd(totalUsdBeats)} in beats</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {!paid ? (
        <div className="space-y-4">
          {!stkSent ? (
            <>
              {/* Currency. Beats carry a dollar price; the shilling figure is
                  worked out server-side, so both buttons charge the same beat. */}
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Pay in</p>
              <div className="flex gap-2 mb-4">
                {(['KES', 'USD'] as const).map((c) => {
                  // Two separate reasons the dollar option can be unusable, and
                  // the buyer deserves to know WHICH before typing anything:
                  // the provider is not switched on, or their cart holds a
                  // store release (KES-native, no dollar price). The server
                  // rejects both anyway — this just stops the wasted trip.
                  const blocked =
                    c === 'USD'
                      ? usdLive === false
                        ? 'Dollar payments aren\u2019t switched on yet \u2014 pay in KSh below.'
                        : hasRelease
                          ? 'Your cart has a store release, which is sold in KSh only.'
                          : usdLive === null
                            ? 'Checking\u2026'
                            : null
                      : null;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={Boolean(blocked)}
                      title={blocked || undefined}
                      onClick={() => { setCurrency(c); if (c === 'USD') setMethod('card'); setMessage(''); }}
                      className={`flex-1 py-3 rounded-lg border font-bold text-sm transition ${
                        blocked
                          ? 'border-stone-800 text-stone-600 cursor-not-allowed'
                          : currency === c
                            ? 'bg-orange-950/40 border-orange-500 text-orange-300'
                            : 'border-stone-700 text-stone-400 hover:border-orange-500/50'
                      }`}
                    >
                      {c === 'KES' ? 'KSh \u00b7 M-Pesa or card' : 'USD \u00b7 card'}
                    </button>
                  );
                })}
              </div>
              {/* The reason, in full, under the buttons — a title tooltip is
                  invisible on a phone, which is most of this audience. */}
              {usdLive === false && (
                <p className="text-xs text-stone-500 mb-3">
                  Dollar card payments aren&apos;t switched on yet. Everything is payable
                  in shillings below, at the live exchange rate.
                </p>
              )}
              {usdLive && hasRelease && (
                <p className="text-xs text-stone-500 mb-3">
                  Store releases are sold in shillings only, so this cart checks out in
                  KSh. Remove the release to pay for beats in dollars.
                </p>
              )}

              {/* Payment method */}
              {currency === 'KES' && (
              <>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Payment method</p>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMethod('mpesa')}
                  className={`flex-1 py-3 rounded-lg border font-bold text-sm transition flex items-center justify-center gap-2 ${
                    method === 'mpesa' ? 'bg-green-950/40 border-green-500 text-green-300' : 'border-stone-700 text-stone-400 hover:border-green-500/50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${method === 'mpesa' ? 'bg-green-600 text-white' : 'bg-stone-700 text-stone-300'}`}>M</span>
                  M-Pesa
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className={`flex-1 py-3 rounded-lg border font-bold text-sm transition flex items-center justify-center gap-2 ${
                    method === 'card' ? 'bg-green-950/40 border-green-500 text-green-300' : 'border-stone-700 text-stone-400 hover:border-green-500/50'
                  }`}
                >
                  <span aria-hidden="true">💳</span>
                  Card
                </button>
              </div>
              </>
              )}

              {currency === 'USD' ? (
                // An international buyer has never heard of Flutterwave. Being
                // redirected to an unrecognised brand at the moment of paying is
                // a trust cliff — the buyer cannot verify who is taking the
                // money, so they abandon. One sentence saying what it IS costs
                // nothing and removes the whole question.
                <div className="p-4 bg-orange-950/20 border border-orange-900/30 rounded-xl mb-4">
                  <h3 className="font-bold text-orange-400 mb-1">
                    Card payment in US dollars &mdash; {formatUsd(totalUsdBeats)}
                  </h3>
                  <ul className="text-sm text-orange-300/80 space-y-1.5 mt-2">
                    <li>
                      Pressing pay opens <strong>Flutterwave</strong>, a licensed African payment
                      processor. It handles the card details; JST.BEAT never sees your card number.
                    </li>
                    <li>Visa, Mastercard and American Express are accepted.</li>
                    <li>
                      Your card is charged <strong>{formatUsd(totalUsdBeats)}</strong> — the shilling
                      figure is shown for reference only, and is not what leaves your account.
                    </li>
                    <li>You come straight back here, and the download unlocks as soon as it clears.</li>
                  </ul>
                </div>
              ) : method === 'mpesa' ? (
                <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-xl mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-lg">M</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-400">M-Pesa Payment</h3>
                      <p className="text-xs text-green-500/70">Secure payment via Paystack</p>
                    </div>
                  </div>
                  <p className="text-sm text-green-300/80">
                    You will receive an STK push on your phone. Enter your M-Pesa PIN to complete.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-xl mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-lg">💳</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-400">Card Payment</h3>
                      <p className="text-xs text-green-500/70">Secure payment via Paystack</p>
                    </div>
                  </div>
                  <p className="text-sm text-green-300/80">
                    You&apos;ll be taken to Paystack&apos;s secure page to enter your card details — we never see your card number.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="paystack-email" className="block text-sm font-medium mb-1 text-stone-400">
                  Email <span className="text-green-500">*</span>
                  <span className="text-stone-600 text-xs ml-1">
                    (required by {currency === 'USD' ? 'Flutterwave' : 'Paystack'} for receipts)
                  </span>
                </label>
                <input
                  id="paystack-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full border border-stone-700 bg-stone-900 rounded-lg px-3 py-2 text-orange-50 placeholder-stone-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-colors"
                />
              </div>

              {currency === 'KES' && method === 'mpesa' && (
                <div>
                  <label htmlFor="paystack-phone" className="block text-sm font-medium mb-1 text-stone-400">
                    M-Pesa Phone Number <span className="text-green-500">*</span>
                  </label>
                  <input
                    id="paystack-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712345678"
                    className="w-full border border-stone-700 bg-stone-900 rounded-lg px-3 py-2 text-orange-50 placeholder-stone-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-colors"
                  />
                  <p className="text-xs text-stone-600 mt-1">The number that will receive the M-Pesa STK push</p>
                </div>
              )}

              {message && <p className="text-red-400 text-sm" role="alert">{message}</p>}

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-500 disabled:bg-stone-700 transition focus-visible:ring-2 focus-visible:ring-green-500 outline-none touch-manipulation flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="font-bold">{currency === 'KES' && method === 'mpesa' ? 'M' : '💳'}</span>
                    {currency === 'USD'
                      ? `Pay ${formatUsd(totalUsdBeats)} via card`
                      : `Pay ${formatKes(totalKes)} via ${method === 'mpesa' ? 'M-Pesa' : 'Card'}`}
                  </>
                )}
              </button>

              {/* Trust bar — recognizable processor name matters more here
                  than anywhere else on the site: this is the moment someone
                  decides whether to actually type their PIN/card number. */}
              <div className="flex items-center justify-center gap-2 text-xs text-stone-500 pt-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Payments secured &amp; processed by {currency === 'USD' ? 'Flutterwave' : 'Paystack'}
              </div>

              <button
                onClick={handleClearCart}
                className="w-full border border-stone-700 py-2 rounded-lg hover:bg-stone-900 transition text-stone-400 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
              >
                {confirmClear ? 'Click again to confirm clear cart' : 'Clear Cart'}
              </button>
              {confirmClear && (
                <p className="text-stone-500 text-sm text-center">
                  This will remove all items. <button onClick={() => setConfirmClear(false)} className="underline hover:text-stone-300 focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none">Cancel</button>
                </p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-950/30 border border-green-900/30 text-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="font-medium">{method === 'card' ? 'Payment submitted!' : 'M-Pesa prompt sent!'}</p>
                </div>
                <p className="text-sm text-green-300/70">{message}</p>
                <p className="text-xs text-green-400/50 mt-2">Ref: {reference}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={checkNow} 
                  disabled={checking}
                  className="flex-1 bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-60 transition focus-visible:ring-2 focus-visible:ring-green-500 outline-none touch-manipulation"
                >
                  {checking ? 'Checking...' : "I've Paid — Check Status"}
                </button>
                <button 
                  onClick={() => { setStkSent(false); setMessage(''); }} 
                  className="flex-1 border border-stone-700 py-2 rounded-lg hover:bg-stone-900 transition text-stone-400 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-950/30 border border-green-900/30 text-green-300 rounded-lg">
            <p className="font-bold mb-1">Payment successful!</p>
            <p className="text-sm">Your beats are ready for download.</p>
          </div>
          
          {downloads.length > 0 ? (
            downloads.map((dl) => (
              <a 
                key={`${dl.beat_id}-${dl.license}`} 
                href={dl.url} 
                download 
                className="block w-full text-center bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
              >
                Download {dl.title} ({dl.license.toUpperCase()})
              </a>
            ))
          ) : (
            <p className="text-stone-500 text-center">Preparing your downloads...</p>
          )}
          
          <button 
            onClick={() => { clearCart(); setPaid(false); setStkSent(false); setReference(''); setMessage(''); setDownloads([]); }} 
            className="w-full border border-stone-700 py-2 rounded-lg hover:bg-stone-900 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
          >
            Buy More Beats
          </button>
        </div>
      )}
    </div>
  );
}
