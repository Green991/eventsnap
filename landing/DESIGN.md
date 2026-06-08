---
name: EventSnap Aura
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#4d4635'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#735c00'
  primary: '#735c00'
  on-primary: '#ffffff'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#e9c349'
  secondary: '#725b38'
  on-secondary: '#ffffff'
  secondary-container: '#fedeb2'
  on-secondary-container: '#78603e'
  tertiary: '#5e5e5c'
  on-tertiary: '#ffffff'
  tertiary-container: '#b4b3af'
  on-tertiary-container: '#454543'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#fedeb2'
  secondary-fixed-dim: '#e0c298'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#584323'
  tertiary-fixed: '#e4e2de'
  tertiary-fixed-dim: '#c8c6c3'
  on-tertiary-fixed: '#1b1c1a'
  on-tertiary-fixed-variant: '#474744'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style
The design system is anchored in **Minimalist Luxury**, specifically tailored for high-end life milestones like weddings, galas, and private celebrations. The aesthetic prioritizes the photography, treating the UI as a digital gallery frame that feels premium, emotional, and technologically seamless.

The visual narrative blends the editorial elegance of fashion magazines with the functional clarity of modern SaaS. It utilizes generous whitespace (macro-typography), a warm and inviting palette, and a "light-as-air" interaction model to evoke a sense of exclusivity and timelessness. The goal is to make every user feel like a VIP guest at a curated event.

## Colors
The palette is centered on warmth and refinement. 

- **Primary & Secondary**: Soft champagne and gold tones used sparingly for high-intent actions, active states, and celebratory accents. These should never overwhelm the content.
- **Neutrals**: Dark charcoal (#2C2C2C) provides high-contrast legibility for typography, while off-white and warm ivory create a layered, "paper-like" depth for backgrounds.
- **Usage**: Use `#FFFDF9` for primary surfaces (cards, modals) and `#FAFAFD` for the base background to create subtle tonal separation without the need for heavy borders.

## Typography
This design system employs a classic high-contrast pairing. 

- **Playfair Display**: Used for headlines and display text to inject personality and a "boutique" feel. It should be typeset with slightly tighter letter-spacing in larger sizes.
- **Inter**: Used for all functional text, body copy, and UI labels. Its neutral, systematic nature balances the expressive serif and ensures maximum readability on mobile devices.
- **Hierarchy**: Use uppercase labels with increased letter-spacing for category headers and small buttons to reinforce the editorial aesthetic.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain an editorial feel, transitioning to a fluid model for mobile. 

- **Macro-spacing**: Use large margins (64px+) on desktop to create a sense of "luxury through space." Content should never feel crowded.
- **Rhythm**: All spacing follows an 8px base unit. 
- **Grid**: A 12-column grid is used for desktop. For the photo gallery, a Masonry or justified grid is preferred over a strict square aspect ratio to preserve the artistic intent of the original photos.
- **Mobile**: Adjust margins to 20px and reduce vertical padding between sections to maintain momentum while scrolling.

## Elevation & Depth
Depth is achieved through **Tonal Layers** and **Ambient Shadows** rather than traditional borders.

- **Surface Strategy**: The base layer is `#FAFAFD`. Interactive cards and modals sit on `#FFFDF9`.
- **Shadows**: Use extremely soft, diffused shadows with a slight warm tint (e.g., `rgba(44, 44, 44, 0.04)`). The blur radius should be large (20px-40px) with minimal offset to simulate natural, overhead ambient light.
- **Glassmorphism**: Use for navigation bars and overlays. A light backdrop blur (12px) with a semi-transparent `#FFFDF9` (80% opacity) maintains the airy feel while providing necessary contrast over scrolling content.

## Shapes
The shape language is sophisticated and approachable. 

- **Corner Radius**: A standard `12px` (rounded-md) is used for buttons and small elements. Larger containers like image cards and modals use `16px` (rounded-lg).
- **Icons**: Use light-weight (2pt) stroke icons with slightly rounded caps to match the typography. Avoid filled or heavy-weight icon sets.
- **Imagery**: Photos should always feature the defined corner radius; sharp edges should be avoided to maintain the "soft" brand character.

## Components

### Buttons
- **Primary**: Champagne background (#D4AF37) with white text. High-radius (pill or 12px). On hover: scale 1.02 and a slight glow effect.
- **Secondary**: Outlined in Charcoal (#2C2C2C) with a 1px stroke. No background.
- **Ghost**: Text-only with uppercase `label-md` styling. Used for low-priority actions like "Cancel" or "Skip."

### Cards
- Surfaces are `#FFFDF9` with a subtle 1px stroke in `#EBEBEB` (or no stroke and soft shadows). 
- Inner padding should be generous (min 24px).

### Input Fields
- Underline style or very soft-tinted backgrounds. Avoid heavy boxes. 
- Focus state: The bottom border transitions to Champagne (#D4AF37) with a subtle fade.

### Lists & Navigation
- Horizontal spacing between nav items should be wide. 
- Active states are indicated by a small gold dot below the text or a change to the primary gold color.

### Interactive Transitions
- **Hover Scale**: Image cards should subtly scale up (1.03x) on hover to indicate interactivity.
- **Cross-fades**: All page transitions and modal appearances should use a 300ms ease-in-out soft fade.