import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Beat } from '@/types/beat';

interface CartItem {
  beat: Beat;
  license: 'wav' | 'stems';
  // KES. For a store release this IS the price (releases are KES-only). For a
  // beat it's the stale snapshot from upload day — a fallback for display if
  // the live rate can't be fetched, never the authority.
  price: number;
  // USD, beats only. This is the real price; the KES shown in the cart is
  // derived from it with the same rate checkout charges at. Undefined on
  // store releases, which are sold in KES to local buyers.
  priceUsd?: number;
}

interface CartState {
  items: CartItem[];
  addItem: (beat: Beat, license: 'wav' | 'stems') => void;
  removeItem: (beatId: string, license?: 'wav' | 'stems') => void;
  clearCart: () => void;
  getTotal: () => number;
  getTotalUsd: () => number;
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

        // Store releases come through this same shape (see ReleasePlayer) but
        // are priced in KES and carry no USD columns — so only beats get a
        // priceUsd, and only beats get converted at render time.
        const isRelease = (beat as any).kind === 'release';
        const priceUsd = isRelease
          ? undefined
          : Number(license === 'stems' ? beat.price_usd_stems : beat.price_usd_wav) || undefined;

        const newItem: CartItem = { beat, license, price, priceUsd };

        set({ items: [...items, newItem] });
        console.log('Added to cart:', beat.title, license.toUpperCase(), priceUsd ? `$${priceUsd}` : `KSh ${price}`);
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

      // Legacy KES total — snapshots only. The cart page computes the real
      // KES total from priceUsd and the live rate, so this stays for anything
      // that still wants a rough figure without the rate in hand.
      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price, 0);
      },

      /** Dollar total of the beats in the cart. Releases contribute nothing. */
      getTotalUsd: () => {
        return get().items.reduce((sum, item) => sum + (item.priceUsd || 0), 0);
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
      // v2 added priceUsd. A cart persisted before that holds only stale KES
      // snapshots, and there's no way to recover the USD price from them —
      // drop it rather than quietly charging an old number.
      version: 2,
      migrate: () => ({ items: [] }) as any,
    }
  )
);
