import { NextRequest, NextResponse } from 'next/server';

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function getPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

export async function POST(req: NextRequest) {
  try {
    const { phone, amount } = await req.json();
    if (!phone || !amount) {
      return NextResponse.json({ error: 'Phone and amount required' }, { status: 400 });
    }

    let formatted = phone.toString().replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
    if (!formatted.startsWith('254')) {
      return NextResponse.json({ error: 'Use format 2547...' }, { status: 400 });
    }

    const shortcode = '174379';
    const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const timestamp = getTimestamp();
    const password = getPassword(shortcode, passkey, timestamp);

    const key = process.env.MPESA_CONSUMER_KEY!;
    const secret = process.env.MPESA_CONSUMER_SECRET!;
    
    if (!key || key === 'q' || !secret) {
      return NextResponse.json({ error: 'Missing Daraja credentials. Check .env.local' }, { status: 500 });
    }

    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    // Get token
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.json({ error: 'Auth failed: ' + JSON.stringify(tokenData) }, { status: 500 });
    }

    // STK Push
    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: formatted,
      PartyB: shortcode,
      PhoneNumber: formatted,
      CallBackURL: 'https://httpbin.org/post',
      AccountReference: 'JSTBEAT',
      TransactionDesc: 'Beat purchase',
    };

    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const stkData = await stkRes.json();
    console.log('STK Response:', JSON.stringify(stkData));

    if (stkData.ResponseCode !== '0') {
      return NextResponse.json({ error: stkData.ResponseDescription || 'STK Push failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'STK Push sent. Check your phone.',
      checkoutRequestId: stkData.CheckoutRequestID,
    });

  } catch (err: any) {
    console.error('M-Pesa error:', err);
    return NextResponse.json({ error: err.message || 'Payment failed' }, { status: 500 });
  }
}
