import { NextRequest, NextResponse } from "next/server";
import { initializePayment } from "@/lib/paystack";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, amount, items } = await req.json();

    if (!email || !phone || !amount || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Email, phone, amount and items are required" },
        { status: 400 }
      );
    }

    if (amount < 10) {
      return NextResponse.json(
        { success: false, message: "Minimum amount is KSh 10" },
        { status: 400 }
      );
    }

    const reference = `JST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Store amount in kobo (cents)
    const amountInKobo = Math.round(Number(amount) * 100);

    await supabase.from("orders").insert({
      reference,
      email,
      phone,
      amount: amountInKobo,
      status: "pending",
      items: items,
      created_at: new Date().toISOString(),
    });

    const result = await initializePayment({
      email,
      amount: Number(amount), // lib/paystack.ts will multiply by 100
      phone,
      reference,
      metadata: {
        order_id: reference,
        customer_phone: phone,
        item_count: items.length,
        business_settlement: "0114256994",
      },
    });

    return NextResponse.json({
      success: true,
      message: result.message || "Check your phone for the M-Pesa prompt and enter your PIN.",
      reference: result.reference,
    });
  } catch (error: any) {
    console.error("[API] Initialize error:", error.message);
    return NextResponse.json(
      { success: false, message: error.message || "Payment initiation failed" },
      { status: 500 }
    );
  }
}
