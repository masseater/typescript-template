---
version: alpha
name: Ink Paper
description: Warm paper surfaces, ink neutrals, one terracotta accent. Tokens mirror libs/ui/src/styles.css.
colors:
  primary: "#9a3412"
  primary-hover: "#7c2a0e"
  primary-foreground: "#fffdf8"
  secondary: "#d9d0c1"
  secondary-hover: "#c9bfad"
  secondary-foreground: "#1c1916"
  background: "#f6f1e8"
  foreground: "#1c1916"
  surface: "#fffdf8"
  surface-hover: "#f3eee4"
  muted: "#e6dfd2"
  muted-foreground: "#5e574e"
  accent: "#efe9de"
  accent-foreground: "#1c1916"
  border: "#b3a794"
  input: "#b3a794"
  ring: "#1c1916"
  destructive: "#931832"
  destructive-hover: "#761428"
  destructive-foreground: "#fffdf8"
  warning: "#e6b000"
  warning-hover: "#c89600"
  warning-foreground: "#1c1916"
  success: "#1c6b40"
  disabled-foreground: "#8d8376"
  ink: "#1c1916"
  paper: "#f6f1e8"
  chalk: "#fffdf8"
typography:
  display-page:
    fontFamily: Shippori Mincho
    fontSize: 2.5rem
    fontWeight: 500
    lineHeight: 1.25
  headline-section:
    fontFamily: Zen Kaku Gothic New
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.25
  headline-block:
    fontFamily: Zen Kaku Gothic New
    fontSize: 1rem
    fontWeight: 700
    lineHeight: 1.25
  body-lg:
    fontFamily: Zen Kaku Gothic New
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.45
  body-md:
    fontFamily: Zen Kaku Gothic New
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Zen Kaku Gothic New
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  label-sm:
    fontFamily: Zen Kaku Gothic New
    fontSize: 0.75rem
    fontWeight: 700
    lineHeight: 1.45
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  page-gutter: 16px
  page-max: 48rem
  wide-max: 64rem
  column-max: 28rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 8px
  button-danger:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  heading-page:
    typography: "{typography.display-page}"
    textColor: "{colors.foreground}"
  heading-section:
    typography: "{typography.headline-section}"
    textColor: "{colors.foreground}"
---

# Ink Paper

## Overview

Warm paper canvas, ink-dark neutrals, one terracotta accent for primary action. Calm product UI for member, admin, and ops surfaces — not a marketing landing kit and not a dense dashboard chrome language.

Source of visual truth is `@repo/ui` (`libs/ui/src/styles.css` and the parts under `libs/ui/src/shared/ui`). YAML tokens here must stay aligned with that stylesheet. Prefer existing parts (`Button`, `Heading`, `Card`, `Field`, `Page`, …) over hand-rolled color or type classes.

## Colors

Palette is warm limestone paper with ink text and a single terracotta for commitment.

- **Primary (#9a3412):** Terracotta for the one primary action per view. Maps to `--main` / `--primary`.
- **Background (#f6f1e8):** Paper wash for the page. Maps to `--grey-5` / `--background`.
- **Surface (#fffdf8):** Chalk cards and controls. Maps to `--white` / `--card`.
- **Foreground (#1c1916):** Ink for readable text and focus rings. Maps to `--grey-100`.
- **Border (#b3a794):** Soft clay edge. Maps to `--grey-20`.
- **Destructive / warning / success:** Semantic only — never as decoration or brand fill.

Dark scheme remaps surfaces through `prefers-color-scheme: dark` in the same stylesheet. Do not invent a second palette in app CSS.

## Typography

Two loaded faces only.

- **Display:** Shippori Mincho (`font-display`) for `Heading` size `page`.
- **Sans:** Zen Kaku Gothic New (`font-sans`) for body, UI chrome, and `Heading` sizes `section` / `block`.
- Do not fall back to Inter, Roboto, Arial, system-ui, or Hiragino as the intended face.
- Page titles use display; section and block titles stay sans and bold.

## Layout

Tailwind spacing scale stays default (`--spacing` is not overridden). Rhythm is 4px half-steps via utilities.

- Page content width: `max-w-page` (48rem). Wide: `max-w-wide` (64rem). Forms: `max-w-column` (28rem).
- Prefer one vertical column with `gap-*` over nested card grids.
- App screens: one job per section — one heading, one short supporting line, then the interaction.
- Cards are for interaction containers (settings rows, confirmations). Do not wrap every block in a card for decoration.

## Elevation & Depth

Depth is light and rare.

- `--layer-1` … `--layer-4` map to `shadow-sm` … `shadow-xl`.
- Default cards use `shadow-sm` and a border. Do not stack multi-layer glow or neon outlines.
- Hierarchy comes from paper vs chalk surfaces and type size, not from floating badges or stickers.

## Shapes

Architectural softness: `rounded-sm` 4px, `rounded-md` 8px (controls), `rounded-lg` 16px (cards). Avoid `rounded-full` pill clusters except where a part already requires it (e.g. avatars).

## Components

Build from `@repo/ui` parts. Behavior comes from Base UI; appearance from the copied part files.

- **Button:** `variant` `primary` | `secondary` | `danger`. One primary per view. Use `action` for click transitions; do not restyle with raw color utilities.
- **Heading:** `size` `page` | `section` | `block` only — do not invent parallel title classes.
- **Card / CardLink:** bordered chalk surface, `rounded-lg`, padding `p-6`. Use when the container itself is the interaction.
- **Field / FormColumn:** form density lives here; screens only compose layout gaps.
- **Focus:** `focus-indicator` / `focus-indicator-outer` utilities — keep ring on ink, not on primary fill.

Do not copy external UI kit demos as normative styling. Do not add app-local CSS variables that redefine `--primary`, `--background`, or fonts.

## Do's and Don'ts

- Do read this file before changing UI, then confirm tokens in `libs/ui/src/styles.css`.
- Do use semantic Tailwind tokens (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, …).
- Do keep primary terracotta on primary actions only.
- Don't introduce purple-on-white themes, glow stacks, or a second display font.
- Don't restyle `@repo/ui` parts with `bg-red-500`, arbitrary values, or unknown utility classes — shadcn lint forbids it.
- Don't put stats strips, promo chips, or floating labels on hero media when composing promotional surfaces.
- Don't document token values elsewhere; change the stylesheet (and keep this YAML in sync via the design-system test).
