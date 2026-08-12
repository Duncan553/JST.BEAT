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
  price_wav: number;
  price_stems: number;
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
