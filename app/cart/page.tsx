'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/stores/useCartStore';
import Link from 'next/link';

export default function CartPage() {
  const { items, removeItem, clearCart, getTotal } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [stkSent, setStkSent] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validatePhone = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };

  const handlePay = async () => {
    if (!validatePhone(phone)) {
      setMessage('Enter a valid M-Pesa phone number (e.g., 254712345678 or 0712345678).');
      return;
    }
    setPaying(true);
    setMessage('');

    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: getTotal() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed. Please check your details and try again.');

      setStkSent(true);
      setMessage(data.message || 'Payment request sent to your phone. Check your M-Pesa messages.');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

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

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 min-h-[60vh] flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-4 text-orange-100">Your Cart</h1>
        <div className="text-center py-12 border border-stone-800 rounded-xl bg-stone-900/30">
          <p className="text-stone-500 text-lg mb-2">Your cart is empty.</p>
          <p className="text-stone-600 text-sm mb-4">Find some beats and add them here.</p>
          <Link 
            href="/" 
            className="inline-block px-6 py-2 bg-orange-600 text-white rounded-full font-bold hover:bg-orange-500 transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
          >
            Browse beats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <h1 className="text-2xl font-bold mb-6 text-orange-100">Your Cart</h1>
      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <div 
            key={item.beat.id} 
            className="flex justify-between items-center border border-stone-800 rounded-xl p-4 bg-stone-900/40 gap-4"
          >
            <div className="min-w-0">
              <h3 className="font-bold text-orange-500 truncate" title={item.beat.title}>{item.beat.title}</h3>
              <p className="text-sm text-stone-500">WAV Lease</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-bold text-orange-100 tabular-nums">KSh {item.price}</span>
              <button
                onClick={() => handleRemove(item.beat.id, item.beat.title)}
                className="text-red-400 text-sm hover:underline focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center border-t border-stone-800 pt-4 mb-6">
        <span className="text-lg font-bold text-orange-100">Total</span>
        <span className="text-lg font-bold text-orange-100 tabular-nums">KSh {getTotal()}</span>
      </div>

      {!paid ? (
        <div className="space-y-4">
          {!stkSent ? (
            <>
              <div>
                <label htmlFor="mpesa-phone" className="block text-sm font-medium mb-1 text-stone-400">
                  M-Pesa Phone Number
                </label>
                <input
                  id="mpesa-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="2547xxxxxxxx or 07xxxxxxxx"
                  className="w-full border border-stone-700 bg-stone-900 rounded-lg px-3 py-2 text-orange-50 placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  aria-describedby={message ? 'payment-error' : undefined}
                />
              </div>
              {message && (
                <p id="payment-error" className="text-red-400 text-sm" role="alert">
                  {message}
                </p>
              )}
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-500 disabled:bg-stone-700 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
              >
                {paying ? 'Processing...' : `Pay KSh ${getTotal()} via M-Pesa`}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-orange-950/30 border border-orange-900/30 text-orange-200 rounded-lg">
                {message} After paying, click below.
              </div>
              <button
                onClick={() => setPaid(true)}
                className="w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 transition focus-visible:ring-2 focus-visible:ring-green-500 outline-none touch-manipulation"
              >
                I've Paid — Unlock Download
              </button>
            </div>
          )}

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
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-green-950/30 border border-green-900/30 text-green-300 rounded-lg">
            Payment confirmed! Download your beats below.
          </div>
          {items.map((item) => (
            <a
              key={item.beat.id}
              href={item.beat.full_url}
              download
              className="block w-full text-center bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
            >
              Download {item.beat.title} (WAV)
            </a>
          ))}
          <button
            onClick={clearCart}
            className="w-full border border-stone-700 py-2 rounded-lg hover:bg-stone-900 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
          >
            Clear Cart
          </button>
        </div>
      )}
    </div>
  );
}