import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password, not the login password
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // auto-set by Vercel
  return 'http://localhost:3000';
}

interface OrderItem {
  title: string;
  license: string;
  price: number;
}

/**
 * Sent once, right when an order first flips to "paid" — the safety net
 * for a buyer who closes the tab, loses signal, or just doesn't download
 * right away. Deliberately doesn't embed a signed file link (those expire
 * in 5 minutes) — it links back to the cart page with the order reference,
 * which regenerates fresh signed URLs on every visit, forever.
 */
export async function sendOrderConfirmation(to: string, reference: string, amount: number, items: OrderItem[]) {
  const link = `${siteUrl()}/cart?reference=${encodeURIComponent(reference)}`;

  const itemRows = items
    .map((i) => `<li>${escapeHtml(i.title)} — ${escapeHtml(i.license.toUpperCase())} (KSh ${i.price})</li>`)
    .join('');

  await transporter.sendMail({
    from: `"JST.BEAT" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your JST.BEAT order is confirmed',
    text: `Payment received — KSh ${amount} (ref ${reference}).\n\nDownload your beats here: ${link}\n\nThis link works any time, no expiry.`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#ea580c;">Payment confirmed</h2>
        <p>Thanks for your order — KSh ${amount} received.</p>
        <ul>${itemRows}</ul>
        <p>
          <a href="${link}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">
            Download your beats
          </a>
        </p>
        <p style="color:#666;font-size:13px;">This link works any time — bookmark it if you're not downloading right now. Order reference: ${escapeHtml(reference)}</p>
      </div>
    `,
  });
}
