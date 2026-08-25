import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderConfirmation } from "@/lib/email";

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
        .select("amount, status, email, items")
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

        // Fire-and-forget: order is already marked paid regardless of
        // whether the email succeeds — never let a flaky mail send turn
        // into a failed webhook response (Paystack would just retry it).
        sendOrderConfirmation(order.email, reference, data.amount / 100, order.items || []).catch((e) =>
          console.error("[Webhook] Confirmation email failed:", e.message)
        );
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
