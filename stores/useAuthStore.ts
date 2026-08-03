import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: any;
  isLoading: boolean;
  isLoggedIn: boolean;
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  login: (password: string) => boolean;
  logout: () => void;
}

const PRODUCER_PASSWORD = 'jstbeat2026';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isLoggedIn: false,
      setUser: (user) => set({ user, isLoading: false, isLoggedIn: !!user }),
      setLoading: (loading) => set({ isLoading: loading }),
      login: (password) => {
        if (password === PRODUCER_PASSWORD) {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null, isLoading: false, isLoggedIn: false }),
    }),
    { name: 'jst-beat-auth' }
  )
);