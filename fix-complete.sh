#!/usr/bin/env bash
# JST.BEAT — Complete Security Fix
# Run from repo root: bash fix-complete.sh
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -d "app/api/paystack" ]; then
  echo "Run this from the JST.BEAT repo root."
  exit 1
fi

echo "==> Installing dependency: jose"
npm install jose

echo "==> Backing up files"
mkdir -p .security-backup-complete
for f in \
  lib/supabase.ts lib/paystack.ts next.config.ts \
  stores/useAuthStore.ts stores/useBeatsStore.ts \
  app/login/page.tsx app/dashboard/page.tsx app/cart/page.tsx \
  "app/beats/[id]/page.tsx" app/contact/page.tsx \
  components/Header.tsx hooks/useAuth.ts \
  app/api/contact/route.ts \
  app/api/paystack/initialize/route.ts \
  app/api/paystack/verify/route.ts \
  app/api/paystack/webhook/route.ts \
  components/upload/UploadForm.tsx; do
  mkdir -p ".security-backup-complete/$(dirname "$f")"
  cp "$f" ".security-backup-complete/$f.bak" 2>/dev/null || true
done

echo "==> Creating lib/supabase-admin.ts"
cat > lib/supabase-admin.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
EOF

echo "==> Creating lib/rate-limit.ts"
cat > lib/rate-limit.ts << 'EOF'
const store = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { success: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = store.get(key);
  if (!record || now > record.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true };
  }
  if (record.count >= max) {
    return { success: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { success: true };
}
EOF

echo "==> Patching lib/supabase.ts"
cat > lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
EOF

echo "==> Patching lib/paystack.ts"
cat > lib/paystack.ts << 'EOF'
import axios from "axios";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE = "https://api.paystack.co";

const api = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    "Content-Type": "application/json",
  },
});

export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+254")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("254")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  return `+254${cleaned}`;
}

export async function initializePayment({
  email, amount, phone, reference, metadata = {},
}: {
  email: string; amount: number; phone: string; reference: string; metadata?: Record<string, any>;
}) {
  const formattedPhone = formatPhone(phone);
  const amountInCents = Math.round(amount * 100);
  try {
    const response = await api.post("/charge", {
      email, amount: amountInCents, currency: "KES", reference, metadata,
      mobile_money: { phone: formattedPhone, provider: "mpesa" },
    });
    return {
      success: response.data.status,
      message: response.data.message,
      data: response.data.data,
      reference,
    };
  } catch (error: any) {
    const paystackError = error.response?.data;
    throw new Error(paystackError?.message || "Payment initiation failed");
  }
}

export async function verifyTransaction(reference: string) {
  try {
    const response = await api.get(`/transaction/verify/${reference}`);
    return { success: response.data.status, data: response.data.data };
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Failed to verify transaction");
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET).update(body, "utf8").digest("hex");
  const hashBuf = Buffer.from(hash, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}
EOF

echo "==> Patching next.config.ts"
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.paystack.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
EOF

echo "==> Patching stores/useAuthStore.ts"
cat > stores/useAuthStore.ts << 'EOF'
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: any;
  isLoading: boolean;
  isLoggedIn: boolean;
  initAuth: () => void;
  loginWithPassword: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,

  initAuth: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, isLoggedIn: !!data.session, isLoading: false });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, isLoggedIn: !!session, isLoading: false });
    });
  },

  loginWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { success: false, message: error?.message || 'Login failed' };
    }
    set({ user: data.session.user, isLoggedIn: true, isLoading: false });
    return { success: true };
  },

  logout: () => {
    supabase.auth.signOut();
    set({ user: null, isLoggedIn: false, isLoading: false });
  },
}));
EOF

echo "==> Patching app/login/page.tsx"
cat > app/login/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { loginWithPassword } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await loginWithPassword(email.trim(), password);
    setSubmitting(false);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.message || 'Wrong email or password.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border border-stone-800 rounded-2xl bg-stone-900/30">
      <h1 className="text-2xl font-bold mb-6" style={{ textWrap: 'balance' }}>Producer Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="producer-email" className="block text-sm font-medium mb-1">Email</label>
          <input id="producer-email" type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            className="w-full border border-stone-700 bg-black rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
            placeholder="you@email.com" required />
        </div>
        <div>
          <label htmlFor="producer-password" className="block text-sm font-medium mb-1">Password</label>
          <input id="producer-password" type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
            className="w-full border border-stone-700 bg-black rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
            placeholder="Enter your password" required
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'login-error' : undefined} />
        </div>
        {error && <p id="login-error" className="text-red-400 text-sm" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation">
          {submitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
EOF

echo "==> Patching components/Header.tsx"
python3 - << 'PYEOF'
path = "components/Header.tsx"
with open(path) as f:
    content = f.read()
old = '''  const { isLoggedIn, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const count = items.length;

  useEffect(() => {
    setMounted(true);
  }, []);'''
new = '''  const { isLoggedIn, logout, initAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const count = items.length;

  useEffect(() => {
    setMounted(true);
    initAuth();
  }, [initAuth]);'''
if old not in content:
    raise SystemExit("Header.tsx mount block not found — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("components/Header.tsx patched")
PYEOF

echo "==> Patching hooks/useAuth.ts"
cat > hooks/useAuth.ts << 'EOF'
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

export function useAuth() {
  const { user, isLoading, isLoggedIn, initAuth } = useAuthStore();
  useEffect(() => { initAuth(); }, [initAuth]);
  return { user, isLoading, isLoggedIn };
}
EOF

echo "==> Patching stores/useBeatsStore.ts"
python3 - << 'PYEOF'
path = "stores/useBeatsStore.ts"
with open(path) as f:
    content = f.read()
old = "from('beats')\n        .select('*')"
new = "from('beats_public')\n        .select('*')"
if old not in content:
    raise SystemExit("useBeatsStore query block not found — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("stores/useBeatsStore.ts patched")
PYEOF

echo "==> Patching types/beat.ts"
python3 - << 'PYEOF'
path = "types/beat.ts"
with open(path) as f:
    content = f.read()
old = "  full_url: string;"
new = "  full_url?: string;"
if old not in content:
    raise SystemExit("types/beat.ts full_url field not found — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("types/beat.ts patched")
PYEOF

echo "==> Patching app/beats/[id]/page.tsx"
python3 - << 'PYEOF'
path = "app/beats/[id]/page.tsx"
with open(path) as f:
    content = f.read()
old = "from('beats')\n      .select('*')"
new = "from('beats_public')\n      .select('*')"
if old not in content:
    raise SystemExit("beat detail page query block not found — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("app/beats/[id]/page.tsx patched")
PYEOF

