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
  email, amount, phone, reference, metadata = {}, subaccount,
}: {
  email: string; amount: number; phone: string; reference: string; metadata?: Record<string, any>; subaccount?: string;
}) {
  const formattedPhone = formatPhone(phone);
  const amountInCents = Math.round(amount * 100);
  try {
    const response = await api.post("/charge", {
      email, amount: amountInCents, currency: "KES", reference, metadata,
      mobile_money: { phone: formattedPhone, provider: "mpesa" },
      // Only ever set for orders made up entirely of one producer's beats
      // (see initialize/route.ts) — bearer:subaccount means they absorb
      // Paystack's processing fee themselves, same as any normal merchant,
      // since percentage_charge is 0 and they're getting the full amount.
      ...(subaccount ? { subaccount, bearer: "subaccount" } : {}),
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

// Card payments go through Paystack's own hosted checkout page — we send
// them there with `authorization_url` and never touch a card number
// ourselves. (Doing card entry on our own form would put us in PCI-DSS
// scope for no reason; Paystack's popup/redirect keeps that off us.)
export async function initializeCardPayment({
  email, amount, reference, metadata = {}, callbackUrl, subaccount,
}: {
  email: string; amount: number; reference: string; metadata?: Record<string, any>; callbackUrl: string; subaccount?: string;
}) {
  const amountInCents = Math.round(amount * 100);
  try {
    const response = await api.post("/transaction/initialize", {
      email, amount: amountInCents, currency: "KES", reference, metadata,
      callback_url: callbackUrl,
      channels: ["card"],
      ...(subaccount ? { subaccount, bearer: "subaccount" } : {}),
    });
    return {
      success: response.data.status,
      authorizationUrl: response.data.data.authorization_url as string,
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
