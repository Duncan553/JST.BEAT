import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Beat } from '@/types/beat';

interface CartItem {
  beat: Beat;
  license: 'wav' | 'stems';
  price: number;
}

interface CartState {
  items: CartItem[];
  addItem: (beat: Beat, license: 'wav' | 'stems') => void;
  removeItem: (beatId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  isInCart: (beatId: string) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (beat, license) => {
        const { items } = get();
        const exists = items.find((i) => i.beat.id === beat.id);
        if (exists) {
          console.log('Beat already in cart:', beat.title);
          return;
        }

        // Stems is only valid if the producer set a stems price AND uploaded a stems ZIP
        if (license === 'stems' && (!beat.price_stems || beat.price_stems <= 0 || !beat.stems_url)) {
          console.log('Stems not available for this beat:', beat.title);
          return;
        }

        // WAV is always available and is the default
        const price = license === 'stems' ? beat.price_stems : beat.price_wav;

        const newItem: CartItem = {
          beat,
          license,
          price,
        };

        set({ items: [...items, newItem] });
        console.log('Added to cart:', beat.title, license.toUpperCase(), 'KSh', price);
      },

      removeItem: (beatId) => {
        const { items } = get();
        set({
          items: items.filter((i) => i.beat.id !== beatId),
        });
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price, 0);
      },

      isInCart: (beatId) => {
        return get().items.some((i) => i.beat.id === beatId);
      },
    }),
    {
      name: 'jst-beat-cart',
    }
  )
);
