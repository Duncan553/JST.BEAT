import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderConfirmation } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    // Legit checkout polls this every 5s for up to 2 minutes (~25 requests)
    // plus manual "check now" clicks — cap set well above that, low enough
    // to still blunt reference brute-forcing.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const limit = rateLimit(`verify:${ip}`, 60, 5 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 });
    }

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
        .select("amount, status, email, items")
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

      // Client polls this every few seconds while waiting on M-Pesa — only
      // send the confirmation email the first time this order flips to
      // paid, not on every subsequent poll (the webhook may also race to
      // this same transition; worst case is a rare duplicate email, never
      // zero emails).
      const alreadyPaid = order?.status === "paid";

      await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",
          paid_at: paystackData.paid_at || new Date().toISOString(),
          paystack_data: paystackData,
        })
        .eq("reference", reference);

      if (order && !alreadyPaid) {
        sendOrderConfirmation(order.email, reference, paystackData.amount / 100, order.items || []).catch((e) =>
          console.error("[Verify] Confirmation email failed:", e.message)
        );
      }
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
