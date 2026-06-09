# Fix: Theme radio button selection visual state

## Problems
1. **Inner check dot never shows**: \peer-checked:opacity-100\ on the nested <div> doesn't apply because \peer\ only targets direct siblings; the inner dot is 2 levels deep
2. **onclick JS references non-existent \#themeRadios\**: \document.querySelectorAll('#themeRadios label input')\ -> element not found, JS silently fails
3. **Border overlaps check circle**: Card \order\ + \order-2\ on check circle creates visual clutter, especially when unchecked

## Changes

### 1. Add custom CSS rules (dashboard.html <style> block)
Add before \</style>\:
- \.theme-radio-input:checked + .theme-radio-card { border-color: #d4af37; background-color: rgba(212,175,55,0.05); }\
- \.theme-radio-input:checked + .theme-radio-card .theme-radio-check { border-color: #735c00; background-color: #d4af37; }\
- \.theme-radio-input:checked + .theme-radio-card .theme-radio-dot { opacity: 1; }\

### 2. Fix the HTML structure for both theme labels
Replace Tailwind \peer\ approach with explicit classes:
- <input> -> add \	heme-radio-input\, remove \peer\ and \sr-only\ (use hidden input instead)
- Card <div> -> add \	heme-radio-card\, remove \peer-checked:*\ variants
- Check outer circle -> add \	heme-radio-check\, remove \peer-checked:*\ variants
- Inner dot -> add \	heme-radio-dot\, remove \peer-checked:*\ variants

### 3. Fix the onclick JavaScript
Replace \document.querySelectorAll('#themeRadios label input')\ with \document.querySelectorAll('input[name=\"theme\"]')\

## Files to modify
- dashboard.html - CSS rules + 2 theme label blocks

## Verification
1. Clicking a theme card shows gold check circle with white inner dot
2. Previously selected theme loses its check state
3. Border styling is clean - no overlap
4. Works on mobile (single column) and desktop (side by side)
