#!/usr/bin/env bash
# JST.BEAT security patch
# Run from your repo root: bash fix.sh
# Fixes (Tier 1 — no Supabase config changes needed):
#   1. /api/paystack/initialize now recomputes price server-side from the DB
#      instead of trusting the client's `amount` field.
#   2. webhook + verify now reject/flag payments where Paystack's amount
#      doesn't match what the order was created for.
#   3. HMAC signature check is now constant-time.
#   4. contact form escapes name/message before building the HTML email.
#   5. cart's "I've Paid" button now actually calls /verify instead of
#      just setting local state to true.
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -d "app/api/paystack" ]; then
  echo "Run this from the JST.BEAT repo root (where package.json lives)."
  exit 1
fi

echo "==> Backing up files to .security-backup/"
mkdir -p .security-backup
cp app/api/paystack/initialize/route.ts .security-backup/initialize.route.ts.bak
cp app/api/paystack/verify/route.ts .security-backup/verify.route.ts.bak
cp app/api/paystack/webhook/route.ts .security-backup/webhook.route.ts.bak
cp lib/paystack.ts .security-backup/paystack.ts.bak
cp app/api/contact/route.ts .security-backup/contact.route.ts.bak
cp app/cart/page.tsx .security-backup/cart.page.tsx.bak

echo "==> Patching app/api/paystack/initialize/route.ts (server-side price calc)"
cat > app/api/paystack/initialize/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { initializePayment } from "@/lib/paystack";
import { supabase } from "@/lib/supabase";

// Maps the license the customer picked to the DB column that holds its price.
// We NEVER trust a price the browser sends us — we look it up ourselves.
const LICENSE_PRICE_COLUMN: Record<string, "price_mp3" | "price_wav" | "price_stems"> = {
  mp3: "price_mp3",
  wav: "price_wav",
  stems: "price_stems",
};

export async function POST(req: NextRequest) {
  try {
    // NOTE: intentionally NOT destructuring `amount` from the body anymore.
    // The old code charged whatever number the client sent, which meant
    // anyone could edit the request in devtools and pay KSh 10 for
    // anything. We recompute the real total from the beats table below.
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

    const { data: beats, error: beatsError } = await supabase
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

    await supabase.from("orders").insert({
      reference,
      email,
      phone,
      amount: Math.round(amount * 100), // stored in kobo/cents, same as before
      status: "pending",
      items: verifiedItems,
      created_at: new Date().toISOString(),
    });

    const result = await initializePayment({
      email,
      amount, // server-computed, not client-supplied
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

echo "==> Patching lib/paystack.ts (constant-time signature compare)"
python3 - << 'PYEOF'
import re
path = "lib/paystack.ts"
with open(path) as f:
    content = f.read()

old = '''export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body, "utf8")
    .digest("hex");
  return hash === signature;
}'''

new = '''export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body, "utf8")
    .digest("hex");

  // Constant-time comparison. A plain `===` leaks timing info that in
  // theory lets an attacker guess the signature byte-by-byte.
  const hashBuf = Buffer.from(hash, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}'''

if old not in content:
    raise SystemExit("verifyWebhookSignature block not found as expected — aborting so we don't corrupt the file.")

content = content.replace(old, new)
with open(path, "w") as f:
    f.write(content)
print("lib/paystack.ts patched")
PYEOF

echo "==> Patching app/api/paystack/webhook/route.ts (amount cross-check)"
cat > app/api/paystack/webhook/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { supabase } from "@/lib/supabase";

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

      const { data: order } = await supabase
        .from("orders")
        .select("amount, status")
        .eq("reference", reference)
        .single();

      if (!order) {
        // Paystack knows about a charge we have no record of creating.
        console.error(`[Webhook] No matching order for reference ${reference}`);
      } else if (order.status === "paid") {
        // Webhooks can fire more than once for the same event — don't reprocess.
        console.log(`[Webhook] Order ${reference} already marked paid, skipping`);
      } else if (data.amount !== order.amount) {
        // Paystack says a different amount was charged than what we asked for
        // when we created the order. Do NOT mark it paid — flag it instead
        // so a human checks it rather than silently releasing the download.
        console.error(
          `[Webhook] Amount mismatch for ${reference}: paystack=${data.amount} order=${order.amount}`
        );
        await supabase
          .from("orders")
          .update({ status: "flagged", paystack_data: data })
          .eq("reference", reference);
      } else {
        console.log(`[Webhook] Payment success: ${reference}, KSh ${data.amount / 100}`);
        await supabase
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
      await supabase
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

echo "==> Patching app/api/paystack/verify/route.ts (amount cross-check)"
cat > app/api/paystack/verify/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { supabase } from "@/lib/supabase";

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
      const { data: order } = await supabase
        .from("orders")
        .select("amount, status")
        .eq("reference", reference)
        .single();

      if (order && order.status !== "paid" && paystackData.amount !== order.amount) {
        // Same defense as the webhook: only trust "paid" if the amount
        // Paystack actually processed matches what we charged for.
        console.error(
          `[API] Verify amount mismatch for ${reference}: paystack=${paystackData.amount} order=${order.amount}`
        );
        await supabase
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

      await supabase
        .from("orders")
        .update({
          status: "paid",
          paid_at: paystackData.paid_at || new Date().toISOString(),
          paystack_data: paystackData,
        })
        .eq("reference", reference);
    } else if (["failed", "abandoned"].includes(paystackData?.status)) {
      await supabase
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

echo "==> Patching app/api/contact/route.ts (escape HTML, validate email)"
cat > app/api/contact/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Prevents someone from injecting HTML/links into the email you receive
// by typing markup into the name/message fields.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 }
      );
    }

    if (String(name).length > 200 || String(message).length > 5000) {
      return NextResponse.json(
        { error: 'Name or message is too long.' },
        { status: 400 }
      );
    }

    const safeName = escapeHtml(String(name));
    const safeMessage = escapeHtml(String(message));

    // Create Gmail transporter using App Password
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,      // dwachira2002@gmail.com
        pass: process.env.EMAIL_PASS,      // Gmail App Password (NOT your login password)
      },
    });

    await transporter.sendMail({
      from: `"JST.BEAT Contact" <${process.env.EMAIL_USER}>`,
      to: 'dwachira2002@gmail.com',
      replyTo: email,
      subject: `New Beat Inquiry from ${safeName}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#ea580c;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;">${safeMessage}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'Email sent!' });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email. Please try again or use WhatsApp.' },
      { status: 500 }
    );
  }
}
EOF

echo "==> Patching app/cart/page.tsx ('I've Paid' button now actually checks)"
python3 - << 'PYEOF'
path = "app/cart/page.tsx"
with open(path) as f:
    content = f.read()

old_button = '''                <button 
                  onClick={() => setPaid(true)} 
                  className="flex-1 bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 transition focus-visible:ring-2 focus-visible:ring-green-500 outline-none touch-manipulation"
                >
                  I've Paid — Check Status
                </button>'''

new_button = '''                <button 
                  onClick={checkNow} 
                  disabled={checking}
                  className="flex-1 bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-60 transition focus-visible:ring-2 focus-visible:ring-green-500 outline-none touch-manipulation"
                >
                  {checking ? 'Checking...' : "I've Paid — Check Status"}
                </button>'''

if old_button not in content:
    raise SystemExit("cart page button block not found as expected — aborting so we don't corrupt the file.")

content = content.replace(old_button, new_button)

old_state = "  const [reference, setReference] = useState('');"
new_state = "  const [reference, setReference] = useState('');\n  const [checking, setChecking] = useState(false);"
if old_state not in content:
    raise SystemExit("cart page state block not found as expected — aborting.")
content = content.replace(old_state, new_state, 1)

old_poll_fn_marker = "  const handleRemove = (beatId: string, title: string) => {"
check_now_fn = '''  // This used to just do setPaid(true) with no server check at all —
  // meaning clicking the button was the entire "payment verification".
  // Now it actually asks the server (which asks Paystack) before
  // unlocking downloads.
  const checkNow = async () => {
    if (!reference) return;
    setChecking(true);
    setMessage('Checking payment status...');
    try {
      const res = await fetch(`/api/paystack/verify?reference=${reference}`);
      const data = await res.json();

      if (data.status === 'success') {
        setPaid(true);
        setMessage(`Payment successful! KSh ${data.amount} received.`);
      } else if (['failed', 'abandoned'].includes(data.status)) {
        setMessage('Payment failed or was cancelled.');
      } else if (data.status === 'flagged') {
        setMessage('Payment amount could not be verified. Contact support with your reference.');
      } else {
        setMessage('Still waiting for M-Pesa confirmation. Try again in a few seconds.');
      }
    } catch (err) {
      setMessage('Could not check payment status. Try again.');
    } finally {
      setChecking(false);
    }
  };

'''
if old_poll_fn_marker not in content:
    raise SystemExit("cart page handleRemove marker not found — aborting.")
content = content.replace(old_poll_fn_marker, check_now_fn + old_poll_fn_marker, 1)

with open(path, "w") as f:
    f.write(content)
print("app/cart/page.tsx patched")
PYEOF

echo ""
echo "==> Done. Backups are in .security-backup/ if anything looks off."
echo "==> Now run: npm run build   (or npx tsc --noEmit) to confirm it compiles."
echo ""
echo "Still open (need Supabase dashboard changes, not just code — see chat):"
echo "  - full_url is public to anyone who never paid"
echo "  - producer login has no real server-side identity check"
echo "  - beats table writes rely entirely on your RLS policy config"
