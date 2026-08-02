import { create } from 'zustand';

interface PlayerState {
  currentBeatId: string | null;
  isPlaying: boolean;
  snippetUrl: string | null;
  play: (id: string, url: string) => void;
  pause: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentBeatId: null,
  isPlaying: false,
  snippetUrl: null,
  play: (id, url) => set({ currentBeatId: id, isPlaying: true, snippetUrl: url }),
  pause: () => set({ isPlaying: false }),
}));
