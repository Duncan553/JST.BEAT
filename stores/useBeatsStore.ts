import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';

interface BeatsStore {
  beats: Beat[];
  loading: boolean;
  error: string;
  fetched: boolean;
  fetchBeats: () => Promise<void>;
  updateBeat: (id: string, updates: Partial<Beat>) => void;
  removeBeat: (id: string) => void;
  addBeat: (beat: Beat) => void;
}

export const useBeatsStore = create<BeatsStore>((set, get) => ({
  beats: [],
  loading: false,
  error: '',
  fetched: false,

  fetchBeats: async () => {
    // Don't re-fetch if already loaded (prevents flicker on nav)
    if (get().fetched && get().beats.length > 0) return;
    
    set({ loading: true, error: '' });
    try {
      // We query the real 'beats' table but explicitly DO NOT select full_url
      // so the public never sees the download link. Security!
      const { data, error } = await supabase
        .from('beats')
        .select('id, title, bpm, key, genre, cover_art, snippet_url, price_mp3, price_wav, price_stems, tags, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ beats: data || [], loading: false, fetched: true });
    } catch (err: any) {
      set({ error: 'Failed to load beats. Check your connection and try again.', loading: false });
      console.error('Fetch error:', err);
    }
  },

  updateBeat: (id, updates) => {
    set((state) => ({
      beats: state.beats.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  },

  removeBeat: (id) => {
    set((state) => ({
      beats: state.beats.filter((b) => b.id !== id),
    }));
  },

  addBeat: (beat) => {
    set((state) => ({
      beats: [beat, ...state.beats],
    }));
  },
}));
