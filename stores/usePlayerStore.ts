import { create } from 'zustand';

interface PlayerState {
  currentBeatId: string | null;
  currentBeatTitle: string;
  currentBeatCover: string;
  isPlaying: boolean;
  snippetUrl: string | null;
  play: (id: string, url: string, title: string, cover: string) => void;
  pause: () => void;
  resume: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentBeatId: null,
  currentBeatTitle: '',
  currentBeatCover: '',
  isPlaying: false,
  snippetUrl: null,
  play: (id, url, title, cover) => set({ 
    currentBeatId: id, 
    isPlaying: true, 
    snippetUrl: url, 
    currentBeatTitle: title, 
    currentBeatCover: cover 
  }),
  pause: () => set({ isPlaying: false }),
  resume: () => {
    if (get().snippetUrl) {
      set({ isPlaying: true });
    }
  },
}));
