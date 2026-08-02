import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isLoggedIn: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const PRODUCER_PASSWORD = 'jstbeat2026'; // Change this to your own password

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      login: (password) => {
        if (password === PRODUCER_PASSWORD) {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isLoggedIn: false }),
    }),
    { name: 'jst-beat-auth' }
  )
);
