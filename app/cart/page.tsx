'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import Link from 'next/link';

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
  const { items, removeItem, clearCart, getTotal } = useCartStore();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'mpesa' | 'card'>('mpesa');
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

  const validatePhone = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };

  const handlePay = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Enter a valid email address. Paystack requires it for receipts.');
      return;
    }
    if (method === 'mpesa' && !validatePhone(phone)) {
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
          items: items.map(i => ({
            title: i.beat.title,
            beat_id: i.beat.id,
            license: i.license,
            price: i.price,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed.');

      if (data.method === 'card') {
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

  const handleRemove = (beatId: string, title: string) => {
    if (window.confirm(`Remove "${title}" from your cart?`)) {
      removeItem(beatId);
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
        <div className="text-center py-12 border border-stone-800 rounded-xl bg-stone-900/30">
          <p className="text-stone-500 text-lg mb-2">Your cart is empty.</p>
          <p className="text-stone-600 text-sm mb-4">Find some beats and add them here.</p>
          <Link href="/" className="inline-block px-6 py-2 bg-orange-600 text-white rounded-full font-bold hover:bg-orange-500 transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation">
            Browse beats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <h1 className="text-2xl font-bold mb-1 text-orange-100">Checkout</h1>
      <p className="text-sm text-stone-500 mb-6">{items.length} beat{items.length !== 1 ? 's' : ''} in your order</p>

      {!paid && (
        <div className="border border-stone-800 rounded-2xl bg-stone-900/40 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-stone-800 bg-stone-900/60">
            <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wide">Order Summary</h2>
          </div>
          <div className="divide-y divide-stone-800">
            {items.map((item) => (
              <div key={item.beat.id} className="flex items-center gap-3 p-4">
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
                  <span className="font-bold text-orange-100 tabular-nums text-sm">KSh {item.price}</span>
                  <button onClick={() => handleRemove(item.beat.id, item.beat.title)} className="text-red-400 text-xs hover:underline focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-5 py-4 bg-stone-900/60 border-t border-stone-800">
            <span className="text-base font-bold text-orange-100">Total</span>
            <span className="text-lg font-bold text-orange-100 tabular-nums">KSh {getTotal()}</span>
          </div>
        </div>
      )}

      {!paid ? (
        <div className="space-y-4">
          {!stkSent ? (
            <>
              {/* Payment method */}
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

              {method === 'mpesa' ? (
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
                  <span className="text-stone-600 text-xs ml-1">(required by Paystack for receipts)</span>
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

              {method === 'mpesa' && (
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
                    <span className="font-bold">{method === 'mpesa' ? 'M' : '💳'}</span>
                    Pay KSh {getTotal()} via {method === 'mpesa' ? 'M-Pesa' : 'Card'}
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
                Payments secured &amp; processed by Paystack
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
