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
  if (cleaned.startsWith("0")) cleaned = `254${cleaned.slice(1)}`;
  return cleaned;
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
}

export async function verifyTransaction(reference: string) {
  const response = await api.get(`/transaction/verify/${reference}`);
  return {
    success: response.data.status,
    data: response.data.data,
  };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(body, "utf8")
    .digest("hex");
  return hash === signature;
}
