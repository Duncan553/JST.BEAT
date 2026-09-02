export interface Beat {
  id: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  cover_art: string;
  snippet_url: string;
  full_url?: string;
  stems_url?: string; // ZIP file with individual tracks — optional!
  price_mp3: number; // legacy, ignored
  // KES snapshots written at upload time. Kept so older read paths work, but
  // they are NOT the price — they go stale the moment the shilling moves.
  price_wav: number;
  price_stems: number;
  // The actual price. KES is derived from these at render and at checkout.
  price_usd_wav: number;
  price_usd_stems: number;
  producer: 'jst.dan' | 'tisco prodz';
  tags: string[];
  created_at?: string;
}

export interface CartItem {
  beat: Beat;
  license: 'wav' | 'stems';
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  beat_id: string;
  license: string;
  amount: number;
  mpesa_receipt: string | null;
  status: 'pending' | 'paid' | 'failed';
  created_at: string;
}
