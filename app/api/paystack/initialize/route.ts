import { NextRequest, NextResponse } from "next/server";
import { initializePayment, initializeCardPayment } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getUsdToKes, usdToKes } from "@/lib/pricing";
import { isFlutterwaveConfigured, initializeUsdPayment, subaccountFor } from "@/lib/flutterwave";

// Maps the license the customer picked to the DB column that holds its price.
// We NEVER trust a price the browser sends us — we look it up ourselves.
const LICENSE_PRICE_COLUMN: Record<string, "price_mp3" | "price_wav" | "price_stems"> = {
  mp3: "price_mp3",
  wav: "price_wav",
  stems: "price_stems",
};

// Beats are priced in USD now; KES is derived. These are the USD columns.
const LICENSE_USD_COLUMN: Record<string, "price_usd_wav" | "price_usd_stems"> = {
  wav: "price_usd_wav",
  stems: "price_usd_stems",
};

export async function POST(req: NextRequest) {
  try {
    // General abuse/cost control, per caller.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const ipLimit = rateLimit(`initialize:${ip}`, 10, 10 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json({ success: false, message: "Too many requests, try again shortly" }, { status: 429 });
    }

    // Intentionally NOT reading `amount` from the body — see LICENSE_PRICE_COLUMN
    // below. The client can't be trusted to say what it should pay.
    const { email, phone, items, method, currency } = await req.json();
    const payMethod: "mpesa" | "card" = method === "card" ? "card" : "mpesa";
    // USD goes to Flutterwave, KES to Paystack. Nothing else is accepted, so
    // a junk value falls back to shillings rather than guessing.
    const payCurrency: "KES" | "USD" = currency === "USD" ? "USD" : "KES";

    if (payCurrency === "USD" && !isFlutterwaveConfigured()) {
      return NextResponse.json(
        { success: false, message: "Dollar payments aren't switched on yet. Pay in KSh with M-Pesa or card." },
        { status: 503 }
      );
    }

    if (!email || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Email and items are required" },
        { status: 400 }
      );
    }
    // Phone is only needed for the M-Pesa STK push — card goes through
    // Paystack's own hosted page, which collects what it needs itself.
    if (payMethod === "mpesa" && !phone) {
      return NextResponse.json(
        { success: false, message: "Phone is required for M-Pesa" },
        { status: 400 }
      );
    }

    // This is the one that actually matters: without it, someone could
    // spam a stranger's phone with M-Pesa STK prompts regardless of how
    // many IPs they attack from — the phone number itself is the target.
    if (payMethod === "mpesa") {
      const phoneLimit = rateLimit(`initialize-phone:${phone}`, 5, 30 * 60 * 1000);
      if (!phoneLimit.success) {
        return NextResponse.json(
          { success: false, message: "Too many payment attempts for this number, try again later" },
          { status: 429 }
        );
      }
    }

    // Store releases sit in a different table from beats and are sold whole,
    // so they're priced separately. `kind` comes from the cart line.
    const releaseIds = [...new Set(items.filter((i: any) => i?.kind === 'release').map((i: any) => i?.beat_id).filter(Boolean))];
    const beatIds = [...new Set(items.filter((i: any) => i?.kind !== 'release').map((i: any) => i?.beat_id).filter(Boolean))];
    if (beatIds.length === 0 && releaseIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid cart items" },
        { status: 400 }
      );
    }

    // Uses the admin client: after the RLS lockdown, anon can no longer
    // read full_url/prices off the raw `beats` table directly — only this
    // server route (with the service role key) can.
    let { data: beats, error: beatsError } = beatIds.length
      ? await supabaseAdmin
          .from("beats")
          .select("id, title, price_mp3, price_wav, price_stems, price_usd_wav, price_usd_stems, producer")
          .in("id", beatIds)
      : { data: [], error: null };

    // Runs until migrations/2026-08-25-add-producer.sql has been applied —
    // don't let checkout itself go down over a column that isn't there yet.
    if (beatsError?.code === "42703") {
      const fallback = await supabaseAdmin
        .from("beats")
        .select("id, title, price_mp3, price_wav, price_stems")
        .in("id", beatIds);
      beats = (fallback.data || []).map((b) => ({ ...b, producer: null })) as typeof beats;
      beatsError = fallback.error;
    }

    if (beatsError || !beats) {
      console.error("[API] Could not load beats for pricing:", beatsError?.message);
      return NextResponse.json(
        { success: false, message: "Could not verify cart against catalog" },
        { status: 500 }
      );
    }

    const beatsById = new Map(beats.map((b) => [b.id, b]));

    // Only published releases are purchasable — a draft must never be
    // sellable just because someone kept the id.
    const { data: releaseRows, error: releasesError } = releaseIds.length
      ? await supabaseAdmin
          .from("releases")
          .select("id, title, price, producer, published")
          .in("id", releaseIds)
          .eq("published", true)
      : { data: [], error: null };

    if (releasesError) {
      console.error("[API] Could not load releases for pricing:", releasesError.message);
      return NextResponse.json(
        { success: false, message: "Could not verify cart against catalog" },
        { status: 500 }
      );
    }
    const releasesById = new Map((releaseRows || []).map((r) => [r.id, r]));

    // ONE rate for this whole order: every line is converted with it, and it
    // gets stamped on the order row so a disputed charge can be reconstructed.
    const { rate: fxRate } = await getUsdToKes();

    let amount = 0;
    const verifiedItems: Array<{ title: string; beat_id: string; license: string; price: number; producer: string | null; kind?: string }> = [];

    for (const item of items) {
      // --- store release: one line, one price, whole record ---
      if (item?.kind === 'release') {
        // The store is KES-only by design (local buyers, M-Pesa). A release
        // has no dollar price, so a cart holding one can't be paid in USD.
        if (payCurrency === "USD") {
          return NextResponse.json(
            {
              success: false,
              message: "Store releases are sold in KSh only. Remove them to pay in dollars, or check out in KSh.",
            },
            { status: 400 }
          );
        }
        const release: any = releasesById.get(item?.beat_id);
        if (!release) {
          return NextResponse.json(
            { success: false, message: "One of the items in your cart is no longer on sale" },
            { status: 400 }
          );
        }
        const price = Number(release.price);
        if (!Number.isFinite(price) || price <= 0) {
          return NextResponse.json(
            { success: false, message: "One of the items in your cart has an invalid price" },
            { status: 400 }
          );
        }
        amount += price;
        verifiedItems.push({
          title: release.title,
          beat_id: release.id,
          license: 'release',
          price,
          producer: release.producer ?? null,
          kind: 'release',
        } as any);
        continue;
      }

      const beat = beatsById.get(item?.beat_id);
      const column = LICENSE_PRICE_COLUMN[item?.license];

      if (!beat || !column) {
        return NextResponse.json(
          { success: false, message: "One of the items in your cart no longer exists" },
          { status: 400 }
        );
      }

      // USD is the source of truth for beats. The KES figure is derived here
      // with the same rate the catalogue page rendered, so the number on the
      // page is the number in the STK push.
      const usdColumn = LICENSE_USD_COLUMN[item?.license];
      const priceUsd = usdColumn ? Number((beat as any)[usdColumn]) : NaN;

      // Fall back to the legacy KES column for any beat not yet re-priced.
      const legacyKes = Number((beat as any)[column]);
      const hasUsd = Number.isFinite(priceUsd) && priceUsd > 0;

      if (!hasUsd && (!Number.isFinite(legacyKes) || legacyKes <= 0)) {
        return NextResponse.json(
          { success: false, message: "One of the items in your cart has an invalid price" },
          { status: 400 }
        );
      }

      const lineUsd = hasUsd ? priceUsd : legacyKes / fxRate;
      const lineKes = hasUsd ? usdToKes(priceUsd, fxRate) : legacyKes;
      const price = payCurrency === "USD" ? lineUsd : lineKes;

      amount += price;
      verifiedItems.push({
        title: (beat as any).title,
        beat_id: (beat as any).id,
        license: item.license,
        price,
        producer: (beat as any).producer ?? null,
        price_usd: Number(lineUsd.toFixed(2)),
        price_kes: lineKes,
      } as any);
    }

    // Minimums differ by currency — $1 is a fine order, KSh 1 is not.
    const minimum = payCurrency === "USD" ? 1 : 10;
    if (amount < minimum) {
      return NextResponse.json(
        {
          success: false,
          message: payCurrency === "USD" ? "Minimum amount is $1" : "Minimum amount is KSh 10",
        },
        { status: 400 }
      );
    }

    // Only route automatically when EVERY item in the order is tisco
    // prodz's — a cart mixing both producers stays on manual tracking
    // (Earnings tab) rather than guessing a fractional split.
    const isTiscoOnly = verifiedItems.length > 0 && verifiedItems.every((i) => i.producer === "tisco prodz");
    const subaccount = isTiscoOnly ? process.env.TISCO_SUBACCOUNT_CODE : undefined;

    const reference = `JST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // The order row MUST exist before we charge anyone. /api/orders/download
    // looks the buyer up by reference, so an order that failed to insert means
    // a customer who pays and can never get their files.
    //
    // `phone` is NOT NULL on the table but is genuinely absent for card
    // payments (Paystack's hosted page collects what it needs), so it's
    // coerced to '' rather than left undefined — which used to make the
    // insert fail silently while the charge went ahead regardless.
    const { error: orderError } = await supabaseAdmin.from("orders").insert({
      reference,
      email,
      phone: phone || "",
      amount: Math.round(amount * 100),
      status: "pending",
      items: verifiedItems,
      // paystack_data doubles as the order's audit trail: which currency was
      // charged, through which processor, and at what rate. Without the rate
      // a disputed KES charge can't be reconstructed months later.
      paystack_data: {
        currency: payCurrency,
        processor: payCurrency === "USD" ? "flutterwave" : "paystack",
        fx_rate_used: payCurrency === "USD" ? null : fxRate,
      },
      created_at: new Date().toISOString(),
    });

    if (orderError) {
      console.error("[API] Order insert failed, refusing to charge:", orderError.message);
      return NextResponse.json(
        { success: false, message: "Could not start your order. Nothing has been charged — please try again." },
        { status: 500 }
      );
    }

    const metadata = {
      order_id: reference,
      customer_phone: phone || null,
      item_count: verifiedItems.length,
      business_settlement: process.env.SETTLEMENT_PHONE || null,
    };

    const origin = req.headers.get("origin") || new URL(req.url).origin;

    // ---- USD: Flutterwave. Paystack is never handed a dollar. ----
    if (payCurrency === "USD") {
      // Route each producer's share to their own subaccount when one exists.
      // Flutterwave settles these to BANK accounts, not M-Pesa — so until
      // both producers supply bank details these stay empty and payouts are
      // reconciled by hand from the Earnings tab.
      const byProducer = new Map<string, number>();
      for (const i of verifiedItems) {
        if (!i.producer) continue;
        byProducer.set(i.producer, (byProducer.get(i.producer) || 0) + i.price);
      }
      const subaccounts = [...byProducer.entries()]
        .map(([producer, share]) => {
          const id = subaccountFor(producer);
          return id
            ? { id, transaction_charge_type: "flat_subaccount" as const, transaction_charge: Number(share.toFixed(2)) }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const result = await initializeUsdPayment({
        email,
        amountUsd: Number(amount.toFixed(2)),
        reference,
        redirectUrl: `${origin}/cart`,
        metadata,
        subaccounts,
        customerPhone: phone || undefined,
      });

      return NextResponse.json({
        success: true,
        method: "card",
        currency: "USD",
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        amount,
      });
    }

    if (payMethod === "card") {
      const result = await initializeCardPayment({
        email,
        amount,
        reference,
        metadata,
        callbackUrl: `${origin}/cart`,
        subaccount,
      });

      return NextResponse.json({
        success: true,
        method: "card",
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        amount,
      });
    }

    const result = await initializePayment({ email, amount, phone, reference, metadata, subaccount });

    return NextResponse.json({
      success: true,
      method: "mpesa",
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
