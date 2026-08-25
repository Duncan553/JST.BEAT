import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploader } from '@/lib/auth-server';

// How much each producer has earned from paid orders — used to pay tisco
// prodz manually until (if ever) real Paystack subaccount splitting is
// wired up. Either authorized uploader can see both totals; they're
// splitting the same catalog and need to agree on payouts anyway.
export async function GET(req: NextRequest) {
  const uploader = await requireUploader(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('items')
    .eq('status', 'paid');

  if (error) {
    console.error('[Earnings] Query failed:', error.message);
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 });
  }

  // Old orders (placed before the producer column existed) won't have
  // `producer` on their line items — backfill those from the beats table
  // instead of just dropping them from the totals.
  const totals: Record<string, number> = { 'jst.dan': 0, 'tisco prodz': 0, unknown: 0 };
  const unresolvedBeatIds = new Set<string>();

  for (const order of orders || []) {
    for (const item of (order.items as any[]) || []) {
      if (!item.producer) unresolvedBeatIds.add(item.beat_id);
    }
  }

  let beatProducerById = new Map<string, string>();
  if (unresolvedBeatIds.size > 0) {
    const { data: beats } = await supabaseAdmin
      .from('beats')
      .select('id, producer')
      .in('id', [...unresolvedBeatIds]);
    beatProducerById = new Map((beats || []).map((b) => [b.id, b.producer]));
  }

  for (const order of orders || []) {
    for (const item of (order.items as any[]) || []) {
      const producer = item.producer || beatProducerById.get(item.beat_id) || 'unknown';
      totals[producer] = (totals[producer] || 0) + Number(item.price || 0);
    }
  }

  return NextResponse.json({ success: true, totals });
}
