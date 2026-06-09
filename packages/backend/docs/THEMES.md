# Theme System Documentation

This document describes the dual-theme system used in the BeautifyPRO frontend. The system separates **color themes** from **structural themes**, allowing for maximum flexibility.

## Configuration

Themes are configured via environment variables in `.env` or `.env.dev`:

```bash
# Color theme: beauty, ocean, forest, midnight, dark, brownie
NEXT_PUBLIC_THEME=beauty

# Structure/Layout theme: classic, modern, minimal, bold, elegant
NEXT_PUBLIC_THEME_STRUCTURE=classic
```

---

## Color Themes

Color themes control the visual palette of the site - primary colors, backgrounds, accents, and brand colors.

### BeautifyPRO (Default)

> *Elegant rose gold and cream - luxury salon aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#B8860B` | `#D4A84B` | Buttons, links, accents |
| Gold | `#C9A86C` | `#C9A86C` | Brand accent, gradients |
| Rose | `#D4A5A5` | `#D4A5A5` | Secondary accent |
| Cream | `#FAF9F7` | - | Light backgrounds |
| Charcoal | `#1C1917` | `#1C1917` | Dark backgrounds, text |
| Background | `#FDFCFB` | `#171412` | Page background |

```
Light Mode Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │  Gold   │  Rose   │  Cream  │Charcoal │
│ #B8860B │ #C9A86C │ #D4A5A5 │ #FAF9F7 │ #1C1917 │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Ocean

> *Fresh blue and teal - modern spa aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#2563EB` | `#3B82F6` | Buttons, links, accents |
| Gold (Blue) | `#3B82F6` | `#3B82F6` | Brand accent |
| Rose (Teal) | `#14B8A6` | `#14B8A6` | Secondary accent |
| Background | `#F8FAFC` | `#0F172A` | Page background |

```
Light Mode Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │  Blue   │  Teal   │  White  │  Navy   │
│ #2563EB │ #3B82F6 │ #14B8A6 │ #F8FAFC │ #0F172A │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Forest

> *Natural green and earth tones - organic spa aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#15803D` | `#22C55E` | Buttons, links, accents |
| Gold (Green) | `#22C55E` | `#22C55E` | Brand accent |
| Rose (Sage) | `#A3A380` | `#A3A380` | Secondary accent |
| Background | `#FAFDF7` | `#14211A` | Page background |

```
Light Mode Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │  Green  │  Sage   │  Cream  │  Forest │
│ #15803D │ #22C55E │ #A3A380 │ #FAFDF7 │ #14211A │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Midnight

> *Elegant purple and violet - sophisticated luxury aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#7C3AED` | `#A78BFA` | Buttons, links, accents |
| Gold (Purple) | `#8B5CF6` | `#8B5CF6` | Brand accent |
| Rose (Violet) | `#C084FC` | `#C084FC` | Secondary accent |
| Background | `#FAF5FF` | `#13111C` | Page background |

```
Light Mode Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │ Purple  │ Violet  │ Lavender│  Deep   │
│ #7C3AED │ #8B5CF6 │ #C084FC │ #FAF5FF │ #13111C │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Dark

> *Sleek dark mode - modern minimal aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#60A5FA` | `#93C5FD` | Buttons, links, accents |
| Gold (Blue) | `#60A5FA` | `#60A5FA` | Brand accent |
| Rose (Purple) | `#A78BFA` | `#A78BFA` | Secondary accent |
| Background | `#18181B` | `#09090B` | Page background |

*Note: Dark theme uses dark colors in both light and dark mode for consistent appearance.*

```
Always Dark Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │  Blue   │ Purple  │  Gray   │  Black  │
│ #60A5FA │ #60A5FA │ #A78BFA │ #27272A │ #09090B │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Brownie

> *Warm chocolate and caramel - cozy inviting aesthetic*
| Color | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Primary | `#92400E` | `#D97706` | Buttons, links, accents |
| Gold (Caramel) | `#D97706` | `#F59E0B` | Brand accent |
| Rose (Chocolate) | `#78350F` | `#92400E` | Secondary accent |
| Background | `#FFFBF5` | `#1C1410` | Page background |

```
Light Mode Palette:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Primary │ Caramel │Chocolate│  Cream  │  Brown  │
│ #92400E │ #D97706 │ #78350F │ #FFFBF5 │ #1C1410 │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

## Structure Themes

Structure themes control the **layout, typography, spacing, and visual style** independent of colors. Each structure creates a dramatically different look and feel.

### Classic (Default)

> *Traditional elegant salon - warm, inviting, timeless*
| Property | Value |
|----------|-------|
| Hero | Centered |
| Header | Transparent with blur |
| Footer | Full (4 columns) |
| Cards | Elevated with shadows |
| Buttons | Rounded (pill) |
| Border Radius | Large (1rem) |
| Typography | Semi-bold, standard |

**Visual Characteristics:**
- Soft shadows and rounded corners
- Gradient backgrounds
- Glassmorphism effects
- Smooth hover animations
- Warm, welcoming feel

```
┌────────────────────────────────────────┐
│  ○ ○ ○   BeautifyPRO    [Nav] [Book]  │  <- Blurred header
├────────────────────────────────────────┤
│                                        │
│         Your Style. Your Statement.    │
│              [Book Now]                │
│                                        │
├────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐           │
│  │  Card    │  │  Card    │  <- Rounded, shadowed
│  │  ~~~~~~  │  │  ~~~~~~  │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘
```

---

### Modern

> *Clean lines, asymmetric, contemporary - Bauhaus-inspired*
| Property | Value |
|----------|-------|
| Hero | Split (image + text) |
| Header | Solid with border |
| Footer | Columns |
| Cards | Bordered (no shadow) |
| Buttons | Square (no radius) |
| Border Radius | None |
| Typography | Bold, uppercase labels |

**Visual Characteristics:**
- Sharp corners, no border radius
- Strong 2px borders
- Left-aligned content
- Underline animations
- Geometric grid layouts
- Uppercase labels with backgrounds

```
┌────────────────────────────────────────┐
│  BeautifyPRO   HOME  SERVICES  CONTACT │  <- Solid, bordered
├────────────────────────────────────────┤
│ ▌Your Style.                           │
│ ▌Your Statement.                       │  <- Left bar accent
│  [BOOK NOW]                            │
├────────────────────────────────────────┤
│  ┌──────────┬──────────┐               │
│  │  Card    │  Card    │  <- Sharp corners, borders
│  │  ~~~~~~  │  ~~~~~~  │
│  │▄▄▄▄▄▄▄▄▄▄│          │  <- Underline on hover
│  └──────────┴──────────┘               │
└────────────────────────────────────────┘
```

---

### Minimal

> *Ultra-clean, content-focused - Japanese zen aesthetic*
| Property | Value |
|----------|-------|
| Hero | Minimal |
| Header | Almost invisible |
| Footer | Minimal (single row) |
| Cards | Flat (no background) |
| Buttons | Square, thin borders |
| Border Radius | Tiny (0.125rem) |
| Typography | Light weight (200-300), wide spacing |

**Visual Characteristics:**
- Maximum whitespace
- Thin, light typography
- Grayscale images (color on hover)
- Underline dividers only
- No decorative backgrounds
- Narrow content width (800px)

```
┌────────────────────────────────────────┐
│  BeautifyPRO              nav   nav   │  <- Almost invisible
│                                        │
│                                        │
│          YOUR STYLE.                   │  <- Light, uppercase
│          YOUR STATEMENT.               │
│                                        │
│           [ BOOK NOW ]                 │  <- Thin border
│                                        │
├────────────────────────────────────────┤
│  Service Name                          │
│  Description here                      │
│  ─────────────────────────────────────│  <- Line divider only
│  Service Name                          │
│  Description here                      │
└────────────────────────────────────────┘
```

---

### Bold

> *Dramatic, immersive, high contrast - Magazine style*
| Property | Value |
|----------|-------|
| Hero | Fullscreen |
| Header | Thick, prominent |
| Footer | Centered, dark |
| Cards | Glass with heavy shadows |
| Buttons | Pill with drop shadows |
| Border Radius | Extra large (2rem) |
| Typography | Extra bold (800-900), huge sizes |

**Visual Characteristics:**
- Massive typography (up to 6rem)
- Heavy drop shadows
- 3D perspective transforms on cards
- Dark footer with white text
- Wide containers
- Dramatic hover animations

```
┌────────────────────────────────────────┐
│  BeautifyPRO    HOME  SERVICES  BOOK  │  <- Thick, bold
├────────────────────────────────────────┤
│                                        │
│                                        │
│     YOUR STYLE.                        │
│     YOUR                               │  <- MASSIVE text
│     STATEMENT.                         │
│                                        │
│         ((( BOOK NOW )))               │  <- Pill with glow
│                                        │
├────────────────────────────────────────┤
│  ╭────────────────╮  ╭────────────────╮│
│  │                │  │                ││  <- Rounded, 3D
│  │    Card        │  │    Card        ││
│  │    ~~~~~~~~    │  │    ~~~~~~~~    ││
│  ╰────────────────╯  ╰────────────────╯│
└────────────────────────────────────────┘
```

---

### Elegant

> *Sophisticated luxury, refined details - High-end boutique*
| Property | Value |
|----------|-------|
| Hero | Video background |
| Header | Transparent with fine border |
| Footer | Full with gold accents |
| Cards | Subtle shadow, gold top border |
| Buttons | Slightly rounded, letter-spacing animation |
| Border Radius | Small (0.5rem) |
| Typography | Serif (Georgia), italic headings |

**Visual Characteristics:**
- Serif fonts for headings
- Italic styling
- Gold gradient accents
- Decorative elements (✦)
- Refined hover effects
- Letter-spacing animations

```
┌────────────────────────────────────────┐
│  𝑆𝑐ℎ𝑛𝑖𝑡𝑡𝑤𝑒𝑟𝑘    Home  Services  Contact │  <- Serif, italic
├─────────────────────────────────────────┤  <- Gold line
│                                        │
│        ✦                               │
│                                        │
│     𝑌𝑜𝑢𝑟 𝑆𝑡𝑦𝑙𝑒.                        │  <- Serif, italic
│     𝑌𝑜𝑢𝑟 𝑆𝑡𝑎𝑡𝑒𝑚𝑒𝑛𝑡.                    │
│     ─────────                          │  <- Gold underline
│                                        │
│        [ B O O K  N O W ]              │  <- Letter spacing
│                                        │
├────────────────────────────────────────┤
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                       │  <- Gold top border
│  │  Card        │                      │
│  │  ~~~~~~~~    │                      │
│  └──────────────┘                      │
└────────────────────────────────────────┘
```

---

## Theme Combinations

You can mix any color theme with any structure theme:

| Combination | Best For |
|-------------|----------|
| `beauty` + `classic` | Traditional luxury salons |
| `beauty` + `elegant` | High-end boutiques |
| `ocean` + `modern` | Contemporary spas |
| `ocean` + `minimal` | Clean wellness centers |
| `forest` + `minimal` | Eco-friendly salons |
| `midnight` + `bold` | Trendy urban studios |
| `dark` + `modern` | Edgy barbershops |
| `brownie` + `classic` | Cozy neighborhood salons |

---

## Implementation Notes

### CSS Architecture

Theme structures are applied via CSS using data attributes on the `<body>` element:

```html
<body
  data-theme-structure="elegant"
  data-card-style="elevated"
  data-button-style="rounded"
  data-border-radius="md"
>
```

### React Context

Client components can access theme layout via the `useThemeLayout()` hook:

```tsx
import { useThemeLayout } from '@/contexts/theme-layout-context'

function MyComponent() {
  const { layout, themeName } = useThemeLayout()

  // Access specific properties
  const heroStyle = layout.hero      // 'centered' | 'split' | etc.
  const cardStyle = layout.cards     // 'elevated' | 'flat' | etc.
}
```

### Adding New Themes

1. **Color Theme**: Add to `apps/frontend-schnittwerk/src/config/themes.ts`
2. **Structure Theme**: Add to `structurePresets` in the same file
3. **CSS Overrides**: Add to `apps/frontend-schnittwerk/src/app/globals.css`

---

## Quick Reference

### Environment Variables

```bash
# Color Themes
NEXT_PUBLIC_THEME=beauty|ocean|forest|midnight|dark|brownie

# Structure Themes
NEXT_PUBLIC_THEME_STRUCTURE=classic|modern|minimal|bold|elegant
```

### Default Values

- Color Theme: `beauty`
- Structure Theme: `classic`