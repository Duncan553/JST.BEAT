'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the producer password.');
      return;
    }
    const success = login(password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Wrong password. If you are the producer, check your credentials and try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border border-stone-800 rounded-2xl bg-stone-900/30">
      <h1 
        className="text-2xl font-bold mb-6"
        style={{ textWrap: 'balance' }}
      >
        Producer Login
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="producer-password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="producer-password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
            className="w-full border border-stone-700 bg-black rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
            placeholder="Enter producer password"
            required
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>
        {error && (
          <p id="login-error" className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
        >
          Login
        </button>
      </form>
    </div>
  );
}