---
name: design
description: JST.BEAT's visual system — type pairing, the layered dark palette, spacing rhythm, and how each kind of surface (hero, card, list row, form, empty state) is meant to be styled. Load before changing any styling, adding a page, or touching colour, font, or spacing.
---

# Visual system for JST.BEAT

A dark site goes dull for four specific reasons. Every rule below is aimed at
one of them.

1. **One flat black.** No surface layering, so nothing reads as near or far.
2. **One font doing every job.** Headlines and UI in the same face at the same
   optical weight — nothing has a voice.
3. **Grey text on grey.** Body copy at 45% contrast reads as "disabled".
4. **No texture.** A perfectly clean dark background looks like an unstyled div.

## Type

**Two faces, two jobs. Never one.**

| Role | Face | Use |
|---|---|---|
| Display | **Bricolage Grotesque** (variable, 600–800) | h1, h2, the logo, prices, big numbers, section titles |
| Text / UI | **Inter** | body copy, labels, buttons, form fields, nav, everything else |

Bricolage has real character — ink traps, tight apertures, an optical-size axis
— so headlines carry attitude that Inter never will. Inter stays for UI because
it is unbeatable at small sizes, which is exactly where character hurts.

**Tracking:** display gets `-0.03em` at large sizes (big type looks loose at
default tracking); UI text stays at 0. Never letter-space lowercase body text.

**Scale** — fluid, so it works from a 360px phone to a desktop without
breakpoints:

```css
--text-hero: clamp(2.75rem, 8vw, 5.5rem);   /* the one h1 per page */
--text-h1:   clamp(2rem, 5vw, 3.25rem);
--text-h2:   clamp(1.5rem, 3vw, 2rem);
--text-h3:   1.25rem;
--text-body: 1.0625rem;   /* 17px — 16px is the floor, not the target */
--text-sm:   0.875rem;
--text-xs:   0.75rem;     /* labels only, never a sentence */
```

**Measure:** body text is capped at `62ch`. A line longer than that loses the
reader on the return sweep.

**Line height:** 1.6 for body, 1.05–1.15 for display. Tight display line height
is most of what makes a headline look designed.

## Colour

The page is **not `#000`**. Pure black plus grey text is the flattest possible
combination — a warm near-black gives the orange somewhere to sit.

```css
--surface-0: #0a0908;   /* page */
--surface-1: #121110;   /* cards, header */
--surface-2: #1a1817;   /* raised: hover, active row, drawer */
--line:      #2a2725;   /* borders — never pure white at low alpha */

--text-1: #f5f3f1;      /* headings, primary */
--text-2: #b8b0ab;      /* body — NOT stone-500 */
--text-3: #857d78;      /* meta, captions, timestamps */

--accent:      #ea580c; /* orange-600, the brand */
--accent-hot:  #fb923c; /* orange-400 — accent TEXT on dark, for contrast */
--accent-soft: rgb(234 88 12 / 0.12);  /* tints, selected rows */
```

**Contrast rule:** orange-600 on near-black fails for text. Use `--accent-hot`
for coloured text and keep `--accent` for fills where white sits on top.

**Ratio:** roughly 90% neutral surfaces, 10% accent. Orange is for the one
thing you want tapped on a screen — a second orange button halves the value of
the first.

## Depth and texture

- **Grain.** A 3% SVG noise overlay across the page, `pointer-events: none`.
  This one trick does more to kill flatness than any gradient.
- **Glow.** One soft radial accent wash behind the hero only. Not per section —
  a page with four glows looks like a template.
- **Elevation** is surface colour + border, not big shadows. Shadow on dark
  backgrounds mostly reads as blur; a lighter surface reads as closer.

## How each part is handled

| Part | Rules |
|---|---|
| **Hero** | One `--text-hero` headline, one sentence of `--text-body` at 62ch, exactly one primary button + one ghost. Radial glow behind. Nothing else. |
| **Section head** | `--text-h2` display + a `--text-3` count or one-line explainer under it. Always says what the section is, never just a noun. |
| **Card** | `--surface-1`, 1px `--line`, `rounded-2xl`, hover to `--surface-2` + `motion-lift`. Cover art always square, `object-cover`, never distorted. |
| **List row / chip** | Compact, `--surface-1`, full-radius for chips. Meta line in `--text-3`, price in display face — the price is the thing people scan for. |
| **Price** | Display face, tabular numerals. USD is the price; the KSh equivalent goes below in `--text-3` at `--text-xs`. |
| **Button** | Primary: solid `--accent`, white text, `rounded-full`, `--dur-1` transition, `motion-press`. Ghost: `--line` border, `--text-1`, transparent. One primary per screen. |
| **Form field** | `--surface-0` inside a `--surface-1` card, 1px `--line`, focus ring in `--accent` at 2px. Label above in `--text-sm`, never a placeholder as the label. |
| **Empty state** | Never a bare sentence. A line saying what goes here + the action that fills it. This is where a site feels most unfinished. |
| **Loading** | Skeletons shaped like the real content, `--surface-1`, gently pulsing. Never a centred spinner on a full page. |

## Spacing

An 8px base. Section padding is `py-16` on mobile, `py-24` desktop — dull sites
are usually *cramped*, not empty. Related items sit 8–12px apart; unrelated
groups 32px+. Proximity does more for hierarchy than any border.

## Related

Motion rules live in `.claude/skills/motion/SKILL.md`. Styling and motion are
one system — a beautiful surface that jerks into view is still cheap.
