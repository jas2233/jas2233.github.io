---
name: frontend-aesthetics
description: >
  Design constraints for building good-looking, modern-minimal (SaaS-style)
  front-end UI. Read this BEFORE writing any HTML/CSS/component markup, choosing
  colors, setting spacing, or laying out a page. Enforces a spacing scale, a
  restrained neutral+accent palette, a type hierarchy, and component rules so
  every UI reads as one consistent, elegant system. Framework-agnostic
  (CSS variables); works in plain HTML/CSS, React, Vue, or anything else.
---

# Frontend Aesthetics — Modern Minimal (SaaS)

You are building UI that should look like it came from a team with a real
designer: think Linear, Vercel, Stripe. The default failure mode of
AI-generated UI is "technically works but looks generic / cramped / garish."
This skill's job is to prevent that. **Follow these constraints on every UI you
produce. When in doubt, do less: more whitespace, fewer colors, fewer borders,
fewer font sizes.**

Ship `design-tokens.css` (bundled with this skill) into the project and build
against its variables. If you can't add the file, hardcode the same values.

---

## 0. The 8 rules that matter most

If you remember nothing else:

1. **Space everything on a 4px grid.** Only use gaps/padding/margins from the
   spacing scale (§2). Never `padding: 13px`.
2. **One accent color, used sparingly.** Everything else is neutral gray. Color
   draws the eye — spend it only on the primary action and key states.
3. **Max ~4 font sizes on a screen.** Establish hierarchy with size + weight +
   color, not with many sizes.
4. **Never pure black on pure white.** Text is a very dark gray on a near-white
   (or off-white) surface. Softer, more premium.
5. **Prefer whitespace over borders and dividers.** Group things by proximity;
   reach for a border only when spacing alone can't separate them.
6. **Consistent corner radius.** Pick one radius for the product and reuse it.
   Don't mix 4px cards with 16px buttons.
7. **Shadows are soft and layered, never harsh.** Small, low-opacity, slightly
   downward. A `2px 2px black` shadow reads as amateur.
8. **Everything interactive has hover, focus, active, and disabled states.** A
   button with no hover/focus is unfinished.

---

## 1. Color

### Palette structure
Three roles only:

- **Neutrals** — 90% of the UI. Backgrounds, text, borders, surfaces. A single
  gray ramp from near-white to near-black.
- **Accent (brand)** — 1 hue. Primary buttons, active nav, links, focus rings,
  selected states. Used *sparingly* — if half the screen is accent-colored, it
  stops meaning anything.
- **Semantic** — success / warning / danger / info. Only for status, never for
  decoration.

### Rules
- **No pure black (`#000`) or pure white (`#fff`) for large areas.** Use
  `--color-bg` (near-white, e.g. `#fafafa`/`#f8fafc`) and `--color-text` (very
  dark gray, e.g. `#0f172a`/`#18181b`). Pure white is fine for raised cards
  sitting on the off-white background — that contrast is what gives depth.
- **Text color = hierarchy.** Primary text darkest, secondary text a mid gray,
  disabled/placeholder lighter still. Don't shrink font size to de-emphasize —
  lower the contrast instead.
- **Borders are barely-there.** A light gray (`--color-border`), ~1px. If a
  border is clearly visible as a line, it's probably too dark.
- **Keep saturation restrained** for the modern-minimal look. Muted, slightly
  desaturated accents read as premium; neon saturation reads as cheap. The
  exception is the one moment you *want* to pop (a single CTA).
- **Check contrast.** Body text must hit WCAG AA (≥4.5:1) against its
  background. Large text and UI components ≥3:1. Never rely on color alone to
  convey meaning — pair it with an icon or label.

### Dark mode (if needed)
Don't just invert. Dark backgrounds are a dark gray (`#0a0a0a`–`#18181b`), not
`#000`. Reduce accent saturation/brightness slightly on dark. Elevate surfaces
by making them *lighter* than the background (light source from above), and
lean on surface color over shadows for depth.

---

## 2. Spacing (the 4px grid)

All spacing is a multiple of 4px. This single rule fixes most "AI-generated
cramped/random" layouts.

```
4  8  12  16  24  32  48  64  96
xs sm md  lg  xl  2xl 3xl 4xl 5xl
```

- **Related things sit close, unrelated things sit far apart.** Label-to-input:
  4–8px. Between form fields: 16–24px. Between page sections: 48–96px.
- **Be generous.** The most common AI mistake is too little whitespace. When
  something feels off, adding space fixes it more often than not.
- **Consistent rhythm.** If cards have 24px padding, all cards have 24px
  padding. Don't eyeball each one.
- **Constrain line length.** Body text max ~65–75 characters per line
  (`max-width: ~65ch`). Full-width paragraphs are hard to read.
- **Give content room to breathe against edges.** Page gutters ≥16px on mobile,
  ≥24–48px on desktop.

---

## 3. Typography

- **One or two typefaces, max.** A clean sans-serif for UI is the safe default
  (system stack, or Inter / Geist / similar). If you add a second face, it's for
  display headings only, and it must clearly contrast the body.
- **Type scale — pick ~5 steps and stop:**

  ```
  Display  32–48px   weight 600–700   tight line-height (1.1–1.2)
  H1       24–30px   weight 600
  H2       20px      weight 600
  Body     16px      weight 400       line-height 1.5–1.6
  Small    14px      weight 400       secondary/meta
  Caption  12px      weight 500       labels, uppercase tags
  ```

- **Line-height inverse to size.** Headings tight (1.1–1.3); body loose
  (1.5–1.6) for readability.
- **Weight + color, not size, for most emphasis.** Bold or darker beats bumping
  to the next size.
- **Limit weights** to ~2–3 (e.g. 400 / 500 / 600). Avoid ultra-thin (100–200)
  at body sizes — it fails on many screens.
- **Set `letter-spacing` slightly tighter on large headings** (-0.01 to
  -0.02em); leave body at normal. Uppercase labels get *wider* tracking
  (+0.03–0.05em).
- **Don't justify text** (ragged right reads cleaner on the web). Don't center
  long paragraphs — center only short headings/captions.

---

## 4. Shape, elevation, borders

- **One corner radius, reused.** Common modern default: 8px for cards/inputs/
  buttons, with a smaller 4–6px for tiny elements and a larger 12–16px for big
  surfaces/modals. Pick a system and stick to it. Fully-round (`9999px`) only
  for pills/avatars/toggles.
- **Shadows: soft, low-opacity, layered.** Use an elevation scale, not one-off
  shadows:

  ```
  sm:  0 1px 2px rgba(0,0,0,.05)
  md:  0 4px 8px rgba(0,0,0,.06), 0 2px 4px rgba(0,0,0,.04)
  lg:  0 12px 24px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.04)
  ```

  Higher elevation = more blur + more spread, never darker/harsher. Shadow
  offset is mostly downward (light from above).
- **Border OR shadow, rarely both** to separate a surface. A card is either a
  subtle border on flat bg, or a soft shadow on flat bg — combining both usually
  looks heavy.
- **Icons: one library, one stroke width, consistent size.** (e.g. Lucide,
  24px, 1.5–2px stroke.) Don't mix filled and outline icon sets.

---

## 5. Components

General rule: every interactive element defines **default / hover / focus /
active / disabled**. Missing states are the clearest tell of unfinished UI.

**Buttons**
- Hierarchy: *primary* (filled accent — one per view/section, the main action),
  *secondary* (subtle bg or outline), *ghost/tertiary* (text only). Don't make
  three primary buttons compete.
- Comfortable hit area: ≥40px tall (≥44px for touch), horizontal padding
  16–24px.
- Hover: subtle bg/brightness shift. Active: slightly pressed (darker/scale
  0.98). Focus: visible ring (`--color-ring`), never remove outlines without
  replacing them. Disabled: reduced opacity + `cursor: not-allowed`, no hover.
- Transition `~150ms ease` on color/bg/transform. Snappy, not laggy.

**Inputs / forms**
- Label above the field (not just placeholder — placeholders disappear).
- Clear focus state (accent border or ring). Error state = danger border + a
  message + (ideally) an icon.
- Consistent height with buttons on the same row. Adequate internal padding
  (~10–12px vertical).
- Group related fields; separate groups with §2 spacing.

**Cards / surfaces**
- Consistent internal padding (16–24px). Consistent radius + one elevation
  level. Don't stack many nested shadows.
- Let content breathe; don't cram to the edges.

**Tables / data**
- Right-align numbers, left-align text. Generous row height (≥40px). Zebra or
  hover-row highlight, not both plus heavy gridlines. Mute the header row (bg
  tint or just bolder/smaller-caps labels).

**Navigation**
- Clear active state (accent text/indicator). Enough spacing between items.
  Don't rely on color alone for "active" — add weight or an underline/indicator.

**Empty / loading / error states — always design these.**
- Empty: short explainer + a primary action, not a blank void.
- Loading: skeletons over spinners for content areas.
- Error: plain-language message + a way to recover.

**Motion**
- Subtle and fast: 150–250ms, ease-out for enter, ease-in for exit. Animate
  `transform`/`opacity` (cheap), not layout. Respect
  `prefers-reduced-motion: reduce` — drop or shorten animations.

---

## 6. Layout

- **Grid-based, aligned.** Elements share edges and a baseline. Misalignment is
  the fastest way to look sloppy — line things up.
- **Establish clear hierarchy.** One focal point per view. Size, contrast, and
  space guide the eye; everything shouldn't shout equally.
- **Responsive by default.** Design mobile-first; ensure it holds at common
  breakpoints (≈640 / 768 / 1024 / 1280). No fixed pixel widths that break
  small screens. Test that nothing overflows horizontally.
- **Max content width** on large screens (~1100–1280px centered) so lines and
  layouts don't sprawl.
- **Consistent alignment** of a repeated element (all card titles align, all
  form labels align).

---

## 7. Self-check before calling it done

Run through this list on the rendered result (screenshot it if you have a
browser tool — seeing it beats imagining it):

- [ ] Every spacing value is on the 4px scale?
- [ ] ≤1 accent color, used only for emphasis/primary actions?
- [ ] ≤~4 font sizes visible; hierarchy clear?
- [ ] No pure black text on pure white bg?
- [ ] Consistent corner radius throughout?
- [ ] Shadows soft and consistent (elevation scale, not one-offs)?
- [ ] Every button/input has hover + focus + disabled states?
- [ ] Body text hits AA contrast; line length ≤~75 chars?
- [ ] Things aligned to a grid; nothing visually cramped?
- [ ] Empty/loading/error states handled?
- [ ] Works at mobile width without overflow?

If any box is unchecked, fix it before shipping.