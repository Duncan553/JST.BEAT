---
name: motion
description: JST.BEAT's motion system — the durations, easings, and rules that make the site feel alive without feeling slow. Load before adding or changing any animation, transition, hover state, page entrance, or loading state in this repo.
---

# Motion for JST.BEAT

The site is a record store. It should feel like flipping through crates — quick,
physical, responsive — not like a corporate site fading paragraphs in as you
scroll. Two failure modes to avoid, and they are opposites:

- **Slop:** everything animates, nothing means anything, elements slide in from
  random directions. Motion becomes noise.
- **Slow:** the animation is tasteful but 600ms long, so every interaction has a
  wait built into it. The site feels heavy on a mid-range Android over 4G.

The whole system below exists to avoid both.

## The numbers

Durations are short. Anything longer than ~300ms in a UI reads as lag.

| What | Duration | Token |
|---|---|---|
| Hover, focus, colour change, press | 120ms | `--dur-1` |
| Small element in/out (chip, badge, tooltip) | 180ms | `--dur-2` |
| Drawer, sheet, modal, overlay | 260ms | `--dur-3` |
| Full-screen or large-travel transition | 320ms | `--dur-4` |

Nothing in this repo should exceed `--dur-4`. If something needs longer, the
distance is too big — move it less instead.

**Exits are faster than entrances** — roughly two-thirds. Waiting for something
to leave is pure dead time; nobody ever wished a menu took longer to close.

## The curves

| Situation | Easing | Token | Why |
|---|---|---|---|
| Something appearing | `cubic-bezier(0.16, 1, 0.3, 1)` | `--ease-out` | Fast start, soft settle. Feels like it was already on its way. |
| Something leaving | `cubic-bezier(0.4, 0, 1, 1)` | `--ease-in` | Accelerates away; no lingering. |
| Something moving between two on-screen points | `cubic-bezier(0.65, 0, 0.35, 1)` | `--ease-move` | Symmetric — it starts and ends at rest. |
| Press / tactile feedback | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `--ease-pop` | Slight overshoot. Use SPARINGLY — one or two places on the whole site. |

Never `linear` for anything a person looks at. Linear is for spinners and vinyl
rotation only, where the motion is mechanical by nature.

## The two properties

**Animate `transform` and `opacity`. Nothing else.**

These are the only properties the browser can hand to the compositor. Animating
`width`, `height`, `top`, `left`, `margin`, or `padding` forces layout on every
frame — on a phone that is exactly where the jank comes from. A 16.7ms frame
budget disappears fast when the whole page reflows 60 times a second.

- Growing a bar? `transform: scaleX()`, not `width`.
- Sliding a drawer? `transform: translateX()`, not `right`.
- Revealing a panel? `opacity` + `translateY`, not `height`.

`filter` and `box-shadow` are paint-only — acceptable in small doses on small
elements, never on a full-width surface.

## Distance

Entrances travel **8–24px**. That's it. A long slide reads as slow even at the
same duration, because the eye tracks the distance, not the milliseconds. Big
travel is for a drawer that genuinely comes from off-screen.

## Stagger

Lists (beat chips, store releases, blog cards) stagger by **40ms per item, capped
at ~8 items / 320ms total**. Past that the last row is visibly waiting on the
first, which is the definition of slow. Everything after the cap appears with
the eighth item.

## Rules that keep it honest

1. **Motion must mean something.** It shows where a thing came from, that a tap
   registered, or that new content arrived. Decoration for its own sake is slop.
2. **Never animate on every scroll.** Reveal-on-scroll fires ONCE per element
   (`IntersectionObserver`, then unobserve). Re-animating on scroll-back is the
   single most common "AI website" tell.
3. **Never block input.** A user can tap a link mid-animation and it must work.
4. **Never animate the thing they're reading.** Text that fades in while being
   read is hostile. Animate containers, not paragraphs.
5. **Respect `prefers-reduced-motion`.** Already enforced globally in
   `app/globals.css` — transitions collapse to 0.01ms. Don't defeat it with
   inline JS animations.
6. **Loading is not motion.** A skeleton that pulses is fine; a spinner that
   bounces is noise.

## What's already built

`app/globals.css` carries the tokens (`--dur-*`, `--ease-*`) and these utilities:

- `.motion-rise` — the standard entrance: 12px up + fade, `--dur-2`, `--ease-out`
- `.motion-stagger` on a parent — applies the 40ms cascade to its children
- `.motion-press` — scales to 0.97 on `:active` for tactile feedback
- `.motion-lift` — 2px rise + shadow on hover, pointer devices only

Reach for these before writing a new keyframe. A new animation should need a
reason that none of the four cover.
