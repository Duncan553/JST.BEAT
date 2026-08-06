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

/**
 * Format Kenyan phone for Paystack M-Pesa
 * Paystack REQUIRES: +254XXXXXXXXX (with + sign)
 */
export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  
  // Strip any existing prefix
  if (cleaned.startsWith("+254")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("254")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  
  // Return with +254 prefix (required by Paystack)
  return `+254${cleaned}`;
}

export async function initializePayment({
  email,
  amount,
  phone,
  reference,
  metadata = {},
}: {
  email: string;
  amount: number;
  phone: string;
  reference: string;
  metadata?: Record<string, any>;
}) {
  const formattedPhone = formatPhone(phone);
  const amountInCents = Math.round(amount * 100);

  console.log("[Paystack] Initiating:", {
    email,
    amount: amountInCents,
    currency: "KES",
    phone: formattedPhone,
    reference,
  });

  try {
    const response = await api.post("/charge", {
      email,
      amount: amountInCents,
      currency: "KES",
      reference,
      metadata,
      mobile_money: {
        phone: formattedPhone,
        provider: "mpesa",
      },
    });

    return {
      success: response.data.status,
      message: response.data.message,
      data: response.data.data,
      reference,
    };
  } catch (error: any) {
    const paystackError = error.response?.data;
    console.error("[Paystack] Full API Error:", JSON.stringify(paystackError, null, 2));
    throw new Error(paystackError?.message || error.message || "Payment initiation failed");
  }
}

export async function verifyTransaction(reference: string) {
  try {
    const response = await api.get(`/transaction/verify/${reference}`);
    return {
      success: response.data.status,
      data: response.data.data,
    };
  } catch (error: any) {
    console.error("[Paystack] Verify error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to verify transaction");
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body, "utf8")
    .digest("hex");
  return hash === signature;
}
