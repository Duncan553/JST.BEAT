import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Beat } from '@/types/beat';

interface CartItem {
  beat: Beat;
  license: 'mp3' | 'wav' | 'stems';
  price: number;
}

interface CartState {
  items: CartItem[];
  addItem: (beat: Beat, license: 'mp3' | 'wav' | 'stems') => void;
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

        const newItem: CartItem = {
          beat,
          license,
          price: beat.price_wav,
        };

        set({ items: [...items, newItem] });
        console.log('Added to cart:', beat.title, 'KSh', beat.price_wav);
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
