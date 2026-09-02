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
  removeItem: (beatId: string, license?: 'wav' | 'stems') => void;
  clearCart: () => void;
  getTotal: () => number;
  isInCart: (beatId: string, license?: 'wav' | 'stems') => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (beat, license) => {
        const { items } = get();
        // Match on beat AND license. Matching on the beat alone meant buying
        // the WAV made the Stems of that same beat unaddable — one beat could
        // only ever sell one licence.
        const exists = items.find((i) => i.beat.id === beat.id && i.license === license);
        if (exists) {
          console.log('Already in cart:', beat.title, license.toUpperCase());
          return;
        }

        // Stems availability is signaled by price_stems alone — the anon
        // beats list never receives stems_url (same reason it never gets
        // full_url: don't hand out storage paths for private buckets to
        // the public). Real authorization happens server-side in
        // /api/orders/download after payment, using the admin client.
        if (license === 'stems' && (!beat.price_stems || beat.price_stems <= 0)) {
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

      // A beat can now appear twice (WAV + Stems), so removal takes the
      // licence too. Omit it and every licence of that beat is dropped —
      // which is what the "Remove" button on a beat-level control wants.
      removeItem: (beatId, license) => {
        const { items } = get();
        set({
          items: items.filter((i) =>
            license ? !(i.beat.id === beatId && i.license === license) : i.beat.id !== beatId
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price, 0);
      },

      // With no licence: "is this beat in the cart at all?" (chip badges).
      // With one: "is this exact licence in the cart?" (the buy button).
      isInCart: (beatId, license) => {
        return get().items.some((i) =>
          i.beat.id === beatId && (license ? i.license === license : true)
        );
      },
    }),
    {
      name: 'jst-beat-cart',
    }
  )
);
