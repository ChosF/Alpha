# Alpha — design.md

Brand and interface guidance for **Alpha**, the student-run finance society at
Tec de Monterrey, Campus Ciudad de México. Written for three readers: designers
who make things by hand, engineers who implement in code, and AI tools asked to
produce on-brand output.

## Status of this document

| Area | Status | Source |
| --- | --- | --- |
| Logo lockup, wordmark typeface, mark artwork | **Locked** | measured from the brand cover file |
| Blue palette, Poppins as the main typeface | **Locked** | defined by the society; exact hex values still to be confirmed |
| Spacing, components, imagery, icons | **Proposed** | structural conventions of the bound Modernist system |

Everything under "Locked" is a record, not a suggestion — do not redraw it.
Everything under "Proposed" is a starting position; it can change, but change it
in this file first so code and design stay in step.

---

## 1. The brand

Alpha is open to the whole campus and led by students, mostly from LAF and
adjacent finance programs. Three pillars carry the work:

1. **Professional development** — workshops, certifications, financial
   modeling, Excel and Python.
2. **Industry connection** — company visits, talks, alumni, networking.
3. **Inclusive financial education and community** — plus the *Alphanálisis*
   podcast.

The society teaches technical finance to people who are not yet professionals.
So the visual system is precise and plain: rules, grids and flush-left labels,
no decoration standing in for rigor.

---

## 2. Logo

### Construction

The logo is one lockup: the letters **Alph** set in **Kollektif** followed by a
calligraphic **α** that completes the word. The α is fixed artwork, not a font
character — it is never typed and never substituted.

All measurements below are in **C**, the cap height of the wordmark. They are
taken from the master file and are exact.

| Dimension | Value |
| --- | --- |
| Wordmark advance width (`Alph`) | 2.89 C |
| α artwork width | 2.09 C |
| α artwork height | 1.44 C |
| α overlap with the final `h` | 0.33 C |
| α rise above the cap line | 0.17 C |
| α drop below the baseline | 0.27 C |
| Full lockup | 4.65 C × 1.45 C |

In em units of the wordmark (cap height = 0.709 em): the α is 1.48 em wide and
1.02 em tall, and the lockup is 3.30 em wide.

### Color variants

- **White on navy** — the primary form, as it appears in the master file.
- **Navy on ground** — for light surfaces.
- **Single-color only.** No gradient, no outline, no second color inside the
  lockup, no shadow.

Files in this project: `assets/alpha-mark-white.png`,
`assets/alpha-mark-navy.png`, `assets/alpha-mark-blue.png` (α artwork),
`assets/kollektif-subset.ttf` (wordmark glyphs, subset — reference only).

### Clear space and minimum size

- Clear space: **1 C** on all four sides. Nothing enters it, including rules.
- Minimum lockup width: **96 px** on screen, **25 mm** in print. Below that,
  use the α alone.

### The α alone

Permitted as an avatar, favicon, podcast tile or stamp, on a square navy or
ground field with the α at 60% of the field height, optically centered.

### Don't

- Don't retype the α from a Greek keyboard or a font.
- Don't set the wordmark in any face other than Kollektif.
- Don't change the overlap, tracking or vertical offsets.
- Don't stack, arch, outline, rotate or shadow the lockup.
- Don't place it on a busy photograph without a navy or ground plate.

---

## 3. Color

Navy on a cool light ground, with the brand blue as the single accent. Reference
the variables, not the hex values, in code.

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Ground | `--color-bg` | `#f2f4f7` | default page background |
| Surface | `--color-surface` | `#e6eaf0` | cards, table headers |
| Navy | `--color-text` | `#0d2140` | all body and display text; the dark logo field |
| Blue | `--color-accent` | `#1f5fd0` | primary action, small emphasis, poster statements |
| Divider | `--color-divider` | 40% navy | the 2 px rules |

> The blue family is fixed; these six values are placeholders in that family until
> the brandbook's exact hex codes are supplied. Swap them here and every surface
> that reads the tokens follows.

Ramps, cool grey and blue, step on one perceptual lightness scale:

```
neutral  100 #f7f8fa  200 #e9ebef  300 #d5d9e0  400 #b7bdc8  500 #979eab
         600 #79808e  700 #5c6371  800 #414754  900 #2a2f3a
blue     100 #eef4ff  200 #d8e6ff  300 #b6d0ff  400 #7fa9f5  500 #3b7ae4
         600 #1f5fd0  700 #16459c  800 #10306e  900 #0c2149
```

Steps 100–300 for tinted fills, hovers and soft borders; 500 as the base;
700–900 for text on tinted fills and pressed states. Prefer a ramp step over an
ad-hoc `color-mix()`.

**Contrast.** Blue 600 (`#1f5fd0`) on the ground clears 4.5:1 and is safe for
body copy; 500 and lighter are for large text, icons and chrome only. Use
`--color-accent-700` for small type on tinted fills.

Ratio to aim for on any layout: roughly 90% navy-on-ground, 10% blue. The one
place blue runs as a full field is a poster statement — a section divider or a
closing banner — where the type is display-sized and the color carries the page.

---

## 4. Typography

| Role | Face | Weight | Notes |
| --- | --- | --- | --- |
| Logo | Kollektif | Bold | logo lockup only, never for copy |
| Display / headings | **Poppins** | 700 | `--font-heading` |
| Body / UI | **Poppins** | 400, 500 | `--font-body` |

Poppins is the main typeface for everything except the logo. Load weights
300–700 only; no 800/900, no italics.

Scale: 42 / 32 / 25 / 20 / 16 / 13 px for h1–h6, body at 15 px / 1.6. Headings
run at 1.12 line height and −0.015em tracking (Poppins is wide — don't track it
tighter than that). h6 is the eyebrow: uppercase, 0.08em tracking.

Rules: everything flush left, never centered — including labels inside buttons.
No italics. Numbers in tables and financial figures use tabular figures
(`font-variant-numeric: tabular-nums`). Minimum body size 15 px on screen,
12 pt in print; slide text never below 24 px.

Spanish and English both appear in Alpha's material. Keep the two in the same
type treatment; don't italicize one against the other.

---

## 5. Spacing and layout

Scale, in px: **4, 8, 12, 16, 24, 32** (`--space-1…8`). Compose larger gaps as
multiples of 8 — no arbitrary values.

- **Radius is 0 everywhere.** `--radius-md` is `0px` on purpose.
- **Rules do the organizing.** 2 px `--color-divider` between major sections
  (`.hr`); no hairlines, and don't replace a rule with whitespace.
- **Modular grid.** Equal-width cells, visible structure, strong horizontal and
  vertical rhythm. Let the grid show.
- Lay sibling groups out with flex or grid plus `gap` — never margins between
  inline elements.
- Elevation: `--shadow-sm / md / lg` only.

---

## 6. Components

Use the bound stylesheet's classes; don't build parallel ones.

| Need | Class |
| --- | --- |
| Actions | `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-icon` / `.btn-block` |
| Labels | `.tag` + `.tag-accent` / `.tag-neutral` / `.tag-outline` |
| Forms | `.field` + `label`, `.input`, `.radio` + `.dot`, `.seg` + `.seg-opt` |
| Content cards | `.card` + `.card-kicker` / `.card-title` / `.card-body` / `.card-meta` |
| Header | `.nav` + `.nav-brand` |
| Data | `.table` |
| Modal | `.dialog-backdrop` + `.dialog` |
| Rule | `.hr` |

States are already in the stylesheet: hover and pressed come from the accent
ramp, keyboard focus is `outline: 2px solid var(--color-accent)` with 2 px
offset, `::selection` is an accent tint, disabled drops to 45% opacity. Don't
restyle them per page, and never ship a default blue focus ring.

---

## 7. Imagery

Photography is documentary: workshops, trading-floor visits, panels, podcast
recordings, people at screens. Real events with real members — no stock desks
or skyline stock finance imagery.

- Every content photograph goes through the `.grayscale` wrapper. Pure black
  and white, no tint, no duotone — the blue never colorizes an image.
- Full-bleed or flush to a grid cell edge; no rounded corners, no drop shadows
  on images.
- Captions sit below the image, flush left, at h6 treatment.
- The only color over a photograph is the blue, and only as type or a rule.

Charts and financial graphics follow the same logic: navy lines on the ground,
one blue series, no gradient fills, no 3D, no chart junk. Label series
directly rather than with a legend where it fits.

---

## 8. Iconography

**Lucide** (lucide.dev), throughout. 1.5–2 px stroke, no fill, navy by default
and blue only when the icon carries the action. Size on the spacing scale:
16, 20 or 24 px, optically aligned to the cap height of adjacent text. Never
mix in another icon family and never use emoji.

---

## 9. Implementing this in code

```html
<link rel="stylesheet" href="_ds/modernist-d00b141a-47a0-4ce6-860c-3873c48a6b18/styles.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap">
```

The stylesheet carries the structural tokens; override the color and font tokens
with Alpha's own:

```css
:root {
  --color-bg:      #f2f4f7;
  --color-surface: #e6eaf0;
  --color-text:    #0d2140;
  --color-accent:  #1f5fd0;
  --font-heading:  "Poppins", system-ui, sans-serif;
  --font-body:     "Poppins", system-ui, sans-serif;
}
```

Then take every color, font, space, radius and shadow from the variables. A
value that isn't in the tokens is a decision this document hasn't made yet —
add it here before shipping it.

Checklist before anything goes out:

- [ ] Logo used as artwork, at correct proportions, with 1 C clear space
- [ ] Poppins everywhere except the logo
- [ ] Zero rounded corners
- [ ] Everything flush left
- [ ] Blue on the primary action and little else
- [ ] Photographs grayscale
- [ ] 2 px rules between sections
- [ ] Focus rings themed, not browser default

---

## 10. Still open

The file this was built from contained only the cover slide, so the following
are not yet documented from source:

1. **Master logo files** — a vector α (SVG/AI) and the licensed Kollektif
   files. The α here was extracted from a raster in the cover file at 360 × 248;
   it is fine for reference, not for print.
2. **The exact blue and navy hex codes** from the brandbook. The family is
   settled; the six values in section 3 are placeholders inside it.
3. **Voice and tone**, naming (`Alphanálisis` and other sub-brands), and
   bilingual copy conventions.
4. **Templates** — slide deck, podcast cover, Instagram post, member
   certificate — the formats Alpha actually publishes in.
