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
