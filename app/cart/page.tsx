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

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePay = async () => {
    if (!phone || phone.length < 10) {
      setMessage('Enter a valid M-Pesa phone number');
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
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      setStkSent(true);
      setMessage(data.message);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  if (!mounted) return <div className="max-w-2xl mx-auto p-6"><h1 className="text-2xl font-bold mb-4 text-orange-100">Your Cart</h1><p className="text-stone-500">Loading...</p></div>;
  if (items.length === 0) return <div className="max-w-2xl mx-auto p-6"><h1 className="text-2xl font-bold mb-4 text-orange-100">Your Cart</h1><p className="text-stone-500">Your cart is empty.</p><Link href="/" className="text-orange-500 hover:text-orange-400 mt-4 inline-block">Browse beats</Link></div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-orange-100">Your Cart</h1>
      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <div key={item.beat.id} className="flex justify-between items-center border border-stone-800 rounded-xl p-4 bg-stone-900/40">
            <div>
              <h3 className="font-bold text-orange-50">{item.beat.title}</h3>
              <p className="text-sm text-stone-500">WAV Lease</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold text-orange-100">KSh {item.price}</span>
              <button onClick={() => removeItem(item.beat.id)} className="text-red-400 text-sm hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center border-t border-stone-800 pt-4 mb-6">
        <span className="text-lg font-bold text-orange-100">Total</span>
        <span className="text-lg font-bold text-orange-100">KSh {getTotal()}</span>
      </div>

      {!paid ? (
        <div className="space-y-4">
          {!stkSent ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-stone-400">M-Pesa Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="254712345678" className="w-full border border-stone-700 bg-stone-900 rounded-lg px-3 py-2 text-orange-50 placeholder-stone-600" />
              </div>
              {message && <p className="text-red-400 text-sm">{message}</p>}
              <button onClick={handlePay} disabled={paying} className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-500 disabled:bg-stone-700 transition">
                {paying ? 'Processing...' : `Pay KSh ${getTotal()} via M-Pesa`}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-orange-950/30 border border-orange-900/30 text-orange-200 rounded-lg">
                {message} After paying, click below.
              </div>
              <button onClick={() => setPaid(true)} className="w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 transition">
                I've Paid — Unlock Download
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-green-950/30 border border-green-900/30 text-green-300 rounded-lg">Payment confirmed! Download your beat.</div>
          {items.map((item) => (
            <a key={item.beat.id} href={item.beat.full_url} download className="block w-full text-center bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-500 transition">
              Download {item.beat.title} (WAV)
            </a>
          ))}
          <button onClick={clearCart} className="w-full border border-stone-700 py-2 rounded-lg hover:bg-stone-900 transition">Clear Cart</button>
        </div>
      )}
    </div>
  );
}
