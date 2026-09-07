import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  currentBeatId: string | null;
  currentBeatTitle: string;
  currentBeatCover: string;
  /** Second line in the player bar — the release a store track belongs to. */
  currentSubtitle: string;
  isPlaying: boolean;
  snippetUrl: string | null;

  /** 0–1. Persisted, so a listener who turned it down stays turned down. */
  volume: number;
  muted: boolean;

  play: (id: string, url: string, title: string, cover: string, subtitle?: string) => void;
  pause: () => void;
  resume: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

/**
 * ONE player for the whole site.
 *
 * Beats and store releases both go through here. They used to be separate:
 * the store page carried its own <audio> element, which meant a beat and a
 * record could play OVER EACH OTHER, and a store track died the moment you
 * navigated away. Everything routes through this store and the single <audio>
 * in components/audio-player/AudioPlayer.tsx now.
 */
export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentBeatId: null,
      currentBeatTitle: '',
      currentBeatCover: '',
      currentSubtitle: '',
      isPlaying: false,
      snippetUrl: null,
      volume: 1,
      muted: false,

      play: (id, url, title, cover, subtitle = '') =>
        set({
          currentBeatId: id,
          isPlaying: true,
          snippetUrl: url,
          currentBeatTitle: title,
          currentBeatCover: cover,
          currentSubtitle: subtitle,
        }),

      pause: () => set({ isPlaying: false }),

      resume: () => {
        if (get().snippetUrl) set({ isPlaying: true });
      },

      // Clamped, because a range input is not the only caller and an out-of-
      // range value makes HTMLMediaElement.volume throw.
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: v === 0 }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: 'jst-beat-player',
      // ONLY the volume settings survive a reload. Persisting the current
      // track would have the site start playing something on a fresh visit,
      // which browsers block anyway and nobody asked for.
      partialize: (s) => ({ volume: s.volume, muted: s.muted }),
    }
  )
);
