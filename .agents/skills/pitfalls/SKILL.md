---
name: pitfalls
description: Known repo-specific gotchas and regressions to avoid. Use before changing Tailwind v4/shadcn foundations, Next font setup, project conventions, lint config, or other setup-level behavior.
---

# Pitfalls

Use this skill before setup-level changes and when something appears configured correctly but is not taking effect.

## Tailwind v4 + shadcn + `next/font` font tokens

When using `next/font` with shadcn/ui and Tailwind v4, verify the font tokens in `src/styles/globals.css` are not self-referential.

Incorrect:

```css
@theme inline {
  --font-sans: var(--font-sans);
  --font-heading: var(--font-sans);
}
```

This can prevent Tailwind utilities such as `font-sans` and shadcn typography tokens from resolving to the Next font variable.

Correct:

```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-heading: var(--font-geist-sans);
}
```

Also apply the font utility at the app shell boundary so the intended family is explicit:

```tsx
<body className="min-h-screen font-sans antialiased">
```

For a different `next/font` variable, replace `--font-geist-sans` with that font's `variable` value from `src/app/layout.tsx`.
