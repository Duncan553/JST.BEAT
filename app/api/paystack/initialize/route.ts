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

    // Check if supabase is working
    let dbStatus = "ok";
    try {
      await supabase.from("orders").insert({
        reference,
        email,
        phone,
        amount: amount * 100,
        status: "pending",
        items: items,
        created_at: new Date().toISOString(),
      });
    } catch (dbErr: any) {
      dbStatus = dbErr.message || "db error";
    }

    const result = await initializePayment({
      email,
      amount: Number(amount),
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
      debug: { dbStatus, envCheck: !!process.env.PAYSTACK_SECRET_KEY },
    });
  } catch (error: any) {
    console.error("[API] Initialize error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Payment initiation failed",
        debug: {
          errorName: error.name,
          errorCode: error.code,
          responseData: error.response?.data,
          envCheck: !!process.env.PAYSTACK_SECRET_KEY,
          supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        }
      },
      { status: 500 }
    );
  }
}
