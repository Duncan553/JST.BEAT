#!/usr/bin/env bash
# JST.BEAT security patch — Tier 2
# Prerequisites (must be done FIRST, see chat):
#   1. Created your real producer account in Supabase Auth
#   2. Ran 01_lockdown.sql in the Supabase SQL editor
#   3. Ran fix.sh from the previous patch
#   4. Added SUPABASE_SERVICE_ROLE_KEY to your .env.local and Vercel env
#      (Supabase Dashboard -> Settings -> API -> service_role key.
#       This key bypasses ALL security rules — never expose it to the
#       browser, never prefix it with NEXT_PUBLIC_)
#
# Run from your repo root: bash fix2.sh
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -d "app/api/paystack" ]; then
  echo "Run this from the JST.BEAT repo root (where package.json lives)."
  exit 1
fi

echo "==> Backing up files to .security-backup-2/"
mkdir -p .security-backup-2
for f in app/api/paystack/initialize/route.ts app/api/paystack/verify/route.ts \
         app/api/paystack/webhook/route.ts app/cart/page.tsx stores/useBeatsStore.ts \
         "app/beats/[id]/page.tsx" types/beat.ts stores/useAuthStore.ts \
         app/login/page.tsx components/Header.tsx; do
  mkdir -p ".security-backup-2/$(dirname "$f")"
  cp "$f" ".security-backup-2/$f.bak"
done

echo "==> Adding lib/supabase-admin.ts (server-only, service role key)"
cat > lib/supabase-admin.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY CLIENT. Uses the service role key, which bypasses Row
// Level Security entirely. Only ever import this into files under
// app/api/** (route handlers). Never import it into a 'use client'
// component — that would ship the key to every visitor's browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[Supabase Admin] Missing env vars — server-only operations will fail');
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'http://localhost:54321',
  serviceRoleKey || 'fallback-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
);
EOF

echo "==> Patching app/api/paystack/initialize/route.ts (admin client for beats+orders)"
cat > app/api/paystack/initialize/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { initializePayment } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Maps the license the customer picked to the DB column that holds its price.
// We NEVER trust a price the browser sends us — we look it up ourselves.
const LICENSE_PRICE_COLUMN: Record<string, "price_mp3" | "price_wav" | "price_stems"> = {
  mp3: "price_mp3",
  wav: "price_wav",
  stems: "price_stems",
};

export async function POST(req: NextRequest) {
  try {
    // Intentionally NOT reading `amount` from the body — see LICENSE_PRICE_COLUMN
    // below. The client can't be trusted to say what it should pay.
    const { email, phone, items } = await req.json();

    if (!email || !phone || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Email, phone and items are required" },
        { status: 400 }
      );
    }

    const beatIds = [...new Set(items.map((i: any) => i?.beat_id).filter(Boolean))];
    if (beatIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid cart items" },
        { status: 400 }
      );
    }

    // Uses the admin client: after the RLS lockdown, anon can no longer
    // read full_url/prices off the raw `beats` table directly — only this
    // server route (with the service role key) can.
    const { data: beats, error: beatsError } = await supabaseAdmin
      .from("beats")
      .select("id, title, price_mp3, price_wav, price_stems")
      .in("id", beatIds);

    if (beatsError || !beats) {
      console.error("[API] Could not load beats for pricing:", beatsError?.message);
      return NextResponse.json(
        { success: false, message: "Could not verify cart against catalog" },
        { status: 500 }
      );
    }

    const beatsById = new Map(beats.map((b) => [b.id, b]));

    let amount = 0;
    const verifiedItems: Array<{ title: string; beat_id: string; license: string; price: number }> = [];

    for (const item of items) {
      const beat = beatsById.get(item?.beat_id);
      const column = LICENSE_PRICE_COLUMN[item?.license];

      if (!beat || !column) {
        return NextResponse.json(
          { success: false, message: "One of the items in your cart no longer exists" },
          { status: 400 }
        );
      }

      const price = Number((beat as any)[column]);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { success: false, message: "One of the items in your cart has an invalid price" },
          { status: 400 }
        );
      }

      amount += price;
      verifiedItems.push({
        title: (beat as any).title,
        beat_id: (beat as any).id,
        license: item.license,
        price,
      });
    }

    if (amount < 10) {
      return NextResponse.json(
        { success: false, message: "Minimum amount is KSh 10" },
        { status: 400 }
      );
    }

    const reference = `JST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await supabaseAdmin.from("orders").insert({
      reference,
      email,
      phone,
      amount: Math.round(amount * 100),
      status: "pending",
      items: verifiedItems,
      created_at: new Date().toISOString(),
    });

    const result = await initializePayment({
      email,
      amount,
      phone,
      reference,
      metadata: {
        order_id: reference,
        customer_phone: phone,
        item_count: verifiedItems.length,
        business_settlement: "0114256994",
      },
    });

    return NextResponse.json({
      success: true,
      message: result.message || "Check your phone for the M-Pesa prompt and enter your PIN.",
      reference: result.reference,
      amount,
    });
  } catch (error: any) {
    console.error("[API] Initialize error:", error.message);
    return NextResponse.json(
      { success: false, message: error.message || "Payment initiation failed" },
      { status: 500 }
    );
  }
}
EOF

echo "==> Patching app/api/paystack/verify/route.ts (admin client)"
cat > app/api/paystack/verify/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { success: false, message: "Reference is required" },
        { status: 400 }
      );
    }

    const result = await verifyTransaction(reference);
    const paystackData = result.data;

    if (paystackData?.status === "success") {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("amount, status")
        .eq("reference", reference)
        .single();

      if (order && order.status !== "paid" && paystackData.amount !== order.amount) {
        console.error(
          `[API] Verify amount mismatch for ${reference}: paystack=${paystackData.amount} order=${order.amount}`
        );
        await supabaseAdmin
          .from("orders")
          .update({ status: "flagged", paystack_data: paystackData })
          .eq("reference", reference);

        return NextResponse.json({
          success: true,
          status: "flagged",
          amount: paystackData.amount / 100,
          paidAt: paystackData.paid_at,
        });
      }

      await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",
          paid_at: paystackData.paid_at || new Date().toISOString(),
          paystack_data: paystackData,
        })
        .eq("reference", reference);
    } else if (["failed", "abandoned"].includes(paystackData?.status)) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: paystackData.status,
          paystack_data: paystackData,
        })
        .eq("reference", reference);
    }

    return NextResponse.json({
      success: true,
      status: paystackData?.status,
      amount: paystackData?.amount ? paystackData.amount / 100 : 0,
      paidAt: paystackData?.paid_at,
      data: paystackData,
    });
  } catch (error: any) {
    console.error("[API] Verify error:", error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
EOF

echo "==> Patching app/api/paystack/webhook/route.ts (admin client)"
cat > app/api/paystack/webhook/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text();

    if (!signature) {
      return NextResponse.json(
        { success: false, message: "Missing signature" },
        { status: 401 }
      );
    }

    if (!verifyWebhookSignature(body, signature)) {
      console.error("[Webhook] Invalid signature");
      return NextResponse.json(
        { success: false, message: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    console.log("[Webhook] Event:", event.event);

    if (event.event === "charge.success") {
      const data = event.data;
      const reference = data.reference;

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("amount, status")
        .eq("reference", reference)
        .single();

      if (!order) {
        console.error(`[Webhook] No matching order for reference ${reference}`);
      } else if (order.status === "paid") {
        console.log(`[Webhook] Order ${reference} already marked paid, skipping`);
      } else if (data.amount !== order.amount) {
        console.error(
          `[Webhook] Amount mismatch for ${reference}: paystack=${data.amount} order=${order.amount}`
        );
        await supabaseAdmin
          .from("orders")
          .update({ status: "flagged", paystack_data: data })
          .eq("reference", reference);
      } else {
        console.log(`[Webhook] Payment success: ${reference}, KSh ${data.amount / 100}`);
        await supabaseAdmin
          .from("orders")
          .update({
            status: "paid",
            paid_at: data.paid_at || new Date().toISOString(),
            paystack_data: data,
          })
          .eq("reference", reference);
      }
    }

    if (event.event === "charge.failed") {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "failed",
          paystack_data: event.data,
        })
        .eq("reference", event.data.reference);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Webhook] Error:", error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
EOF

echo "==> Adding app/api/orders/download/route.ts (signed download URLs, only for paid orders)"
mkdir -p app/api/orders/download
cat > app/api/orders/download/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Turns a stored full_url (from when the bucket was public) into the
// storage object path we need for createSignedUrl. Mirrors the same
// split logic already used in the dashboard's delete handler.
function extractStoragePath(publicUrl: string): string | null {
  const parts = publicUrl.split("/beats/");
  if (!parts[1]) return null;
  return `beats/${parts[1]}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { success: false, message: "Reference is required" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("status, items")
      .eq("reference", reference)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    // This is the actual paywall now. Nothing downloads without this check.
    if (order.status !== "paid") {
      return NextResponse.json(
        { success: false, message: "Order is not paid yet" },
        { status: 403 }
      );
    }

    const items = (order.items as any[]) || [];
    const beatIds = [...new Set(items.map((i) => i.beat_id).filter(Boolean))];

    const { data: beats, error: beatsError } = await supabaseAdmin
      .from("beats")
      .select("id, title, full_url")
      .in("id", beatIds);

    if (beatsError || !beats) {
      return NextResponse.json(
        { success: false, message: "Could not load files" },
        { status: 500 }
      );
    }

    const beatsById = new Map(beats.map((b) => [b.id, b]));
    const downloads: Array<{ beat_id: string; title: string; url: string }> = [];

    for (const item of items) {
      const beat = beatsById.get(item.beat_id);
      if (!beat?.full_url) continue;

      const path = extractStoragePath(beat.full_url);
      if (!path) continue;

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("beats")
        .createSignedUrl(path, 300); // 5-minute link, regenerated each visit

      if (signError || !signed) {
        console.error(`[Download] Could not sign URL for ${path}:`, signError?.message);
        continue;
      }

      downloads.push({ beat_id: beat.id, title: beat.title, url: signed.signedUrl });
    }

    return NextResponse.json({ success: true, downloads });
  } catch (error: any) {
    console.error("[API] Download error:", error.message);
    return NextResponse.json(
      { success: false, message: "Failed to prepare downloads" },
      { status: 500 }
    );
  }
}
EOF

echo "==> Patching types/beat.ts (full_url no longer public)"
python3 - << 'PYEOF'
path = "types/beat.ts"
with open(path) as f:
    content = f.read()
old = "  full_url: string;"
new = "  full_url?: string; // absent from public queries (beats_public view) — only present for the producer's own dashboard queries against `beats`"
if old not in content:
    raise SystemExit("full_url field not found as expected — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("types/beat.ts patched")
PYEOF

echo "==> Patching stores/useBeatsStore.ts (query beats_public, not beats)"
python3 - << 'PYEOF'
path = "stores/useBeatsStore.ts"
with open(path) as f:
    content = f.read()
old = '''      const { data, error } = await supabase
        .from('beats')
        .select('*')
        .order('created_at', { ascending: false });'''
new = '''      // Public listing goes through the beats_public view, which
      // deliberately excludes full_url. The producer dashboard's own
      // insert/update/delete calls still hit the real `beats` table.
      const { data, error } = await supabase
        .from('beats_public')
        .select('*')
        .order('created_at', { ascending: false });'''
if old not in content:
    raise SystemExit("useBeatsStore query block not found as expected — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("stores/useBeatsStore.ts patched")
PYEOF

echo "==> Patching app/beats/[id]/page.tsx (query beats_public, not beats)"
python3 - << 'PYEOF'
path = "app/beats/[id]/page.tsx"
with open(path) as f:
    content = f.read()
old = '''    const result = await supabase
      .from('beats')
      .select('*')
      .eq('id', id)
      .single();'''
new = '''    const result = await supabase
      .from('beats_public')
      .select('*')
      .eq('id', id)
      .single();'''
if old not in content:
    raise SystemExit("beat detail page query block not found as expected — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("app/beats/[id]/page.tsx patched")
PYEOF

echo "==> Patching app/cart/page.tsx (real signed download URLs after payment)"
python3 - << 'PYEOF'
path = "app/cart/page.tsx"
with open(path) as f:
    content = f.read()

old_state = "  const [checking, setChecking] = useState(false);"
new_state = (
    "  const [checking, setChecking] = useState(false);\n"
    "  const [downloads, setDownloads] = useState<Array<{ beat_id: string; title: string; url: string }>>([]);\n"
    "  const [downloadsLoading, setDownloadsLoading] = useState(false);"
)
if old_state not in content:
    raise SystemExit("cart page checking-state marker not found — aborting.")
content = content.replace(old_state, new_state, 1)

old_fn_marker = "  const checkNow = async () => {"
fetch_downloads_fn = '''  // Called once an order is confirmed paid. Asks the server for
  // short-lived signed URLs instead of relying on a full_url that used
  // to be public and baked into the cart before any payment happened.
  const fetchDownloads = async (ref: string) => {
    setDownloadsLoading(true);
    try {
      const res = await fetch(`/api/orders/download?reference=${ref}`);
      const data = await res.json();
      if (data.success) setDownloads(data.downloads || []);
    } catch (err) {
      console.error('Download fetch error:', err);
    } finally {
      setDownloadsLoading(false);
    }
  };

'''
if old_fn_marker not in content:
    raise SystemExit("cart page checkNow marker not found — aborting.")
content = content.replace(old_fn_marker, fetch_downloads_fn + old_fn_marker, 1)

old_check_success = '''      if (data.status === 'success') {
        setPaid(true);
        setMessage(`Payment successful! KSh ${data.amount} received.`);
      } else if (['failed', 'abandoned'].includes(data.status)) {'''
new_check_success = '''      if (data.status === 'success') {
        setPaid(true);
        setMessage(`Payment successful! KSh ${data.amount} received.`);
        fetchDownloads(reference);
      } else if (['failed', 'abandoned'].includes(data.status)) {'''
if old_check_success not in content:
    raise SystemExit("cart page checkNow success branch not found — aborting.")
content = content.replace(old_check_success, new_check_success, 1)

old_poll_success = '''        if (data.status === 'success') {
          clearInterval(interval);
          setPaid(true);
          setMessage(`Payment successful! KSh ${data.amount} received.`);
          return;
        }'''
new_poll_success = '''        if (data.status === 'success') {
          clearInterval(interval);
          setPaid(true);
          setMessage(`Payment successful! KSh ${data.amount} received.`);
          fetchDownloads(ref);
          return;
        }'''
if old_poll_success not in content:
    raise SystemExit("cart page pollVerification success branch not found — aborting.")
content = content.replace(old_poll_success, new_poll_success, 1)

old_downloads_render = '''          {items.map((item) => (
            <a 
              key={item.beat.id} 
              href={item.beat.full_url} 
              download 
              className="block w-full text-center bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
            >
              Download {item.beat.title} ({item.license.toUpperCase()})
            </a>
          ))}'''
new_downloads_render = '''          {downloadsLoading && (
            <p className="text-stone-500 text-sm text-center">Preparing your downloads...</p>
          )}
          {!downloadsLoading && downloads.length === 0 && (
            <p className="text-red-400 text-sm text-center">
              Could not load your downloads. Contact support with reference {reference}.
            </p>
          )}
          {downloads.map((d) => (
            <a 
              key={d.beat_id} 
              href={d.url} 
              download 
              className="block w-full text-center bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
            >
              Download {d.title}
            </a>
          ))}'''
if old_downloads_render not in content:
    raise SystemExit("cart page downloads render block not found — aborting.")
content = content.replace(old_downloads_render, new_downloads_render, 1)

with open(path, "w") as f:
    f.write(content)
print("app/cart/page.tsx patched")
PYEOF

echo "==> Patching stores/useAuthStore.ts (real Supabase Auth, no hardcoded password)"
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

// No more hardcoded password. Identity now comes from a real Supabase
// Auth session — the server enforces who's allowed to write to `beats`
// via RLS (see 01_lockdown.sql), this store just reflects that session.
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

echo "==> Patching app/login/page.tsx (email + password, real auth)"
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
      <h1
        className="text-2xl font-bold mb-6"
        style={{ textWrap: 'balance' }}
      >
        Producer Login
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="producer-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="producer-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            className="w-full border border-stone-700 bg-black rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
            placeholder="you@email.com"
            required
          />
        </div>
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
            placeholder="Enter your password"
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
          disabled={submitting}
          className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
        >
          {submitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
EOF

echo "==> Patching components/Header.tsx (init real auth session on load)"
python3 - << 'PYEOF'
path = "components/Header.tsx"
with open(path) as f:
    content = f.read()

old = '''  const { items } = useCartStore();
  const { isLoggedIn, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const count = items.length;

  useEffect(() => {
    setMounted(true);
  }, []);'''
new = '''  const { items } = useCartStore();
  const { isLoggedIn, logout, initAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const count = items.length;

  useEffect(() => {
    setMounted(true);
    // Reconciles isLoggedIn with the real Supabase Auth session on load.
    // Also what quietly logs out anyone with a stale pre-migration
    // "logged in" flag sitting in localStorage from the old fake login.
    initAuth();
  }, [initAuth]);'''
if old not in content:
    raise SystemExit("Header.tsx mount block not found as expected — aborting.")
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("components/Header.tsx patched")
PYEOF

echo "==> Patching hooks/useAuth.ts (unused elsewhere, but kept in sync so it still compiles)"
cat > hooks/useAuth.ts << 'EOF'
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

// Not currently imported anywhere (Header.tsx calls initAuth() directly
// on mount instead) — kept as a hook wrapper in case a page wants a
// component-local subscription instead of relying on Header having
// already run initAuth().
export function useAuth() {
  const { user, isLoading, isLoggedIn, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return { user, isLoading, isLoggedIn };
}
EOF

echo ""
echo "==> Code patch done. Backups in .security-backup-2/"
echo "==> Next: add SUPABASE_SERVICE_ROLE_KEY to your env, then:"
echo "       npx tsc --noEmit    # confirm it compiles"
echo "       npm run build"
echo ""
echo "Reminder — this only works end-to-end once you've run 01_lockdown.sql"
echo "and created your producer account in Supabase Auth (Step 0 in chat)."
