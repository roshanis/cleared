# Design

## System
Cleared uses a restrained product interface built with Next.js, React, Tailwind tokens, Geist for UI text, Geist Mono for IDs/data, and Source Serif 4 only where submitted document text should read like a document.

The default register is product. The public landing page may use stronger brand pacing, but it should still show the actual product and avoid category-generic SaaS decoration.

## Color
- Canvas: warm near-white paper for the app background.
- Surface: white content areas for tables, forms, and document panes.
- Rail/well: a second neutral layer for headers, toolbars, inactive tabs, and grouped controls.
- Ink: near-black text.
- Muted text: accessible gray-green for secondary labels and timestamps.
- Accent: deep teal for primary actions, active navigation, selected state, and focused controls.
- Semantic colors: pass green, warning amber, fail red, always paired with text labels or icons.

Accent color is functional, not decorative. Inactive UI should stay neutral.

## Typography
- Product UI uses Geist with a tight, fixed scale.
- Document bodies, quotes, and submitted content use Source Serif 4.
- IDs, criteria, and version numbers use Geist Mono.
- Headings use sentence case and tight hierarchy. Body prose should stay within readable line lengths.

## Layout
- App shell uses a sticky top navigation and a max-width work area.
- Tables are preferred for queues, histories, and records.
- Cards are reserved for bounded tools, repeated items, empty states, and panels that need a frame.
- Avoid nested cards and repeated identical card grids when a ruled list, table, or panel group communicates the structure better.
- Responsive behavior is structural: tables scroll when needed, columns collapse intentionally, and text must not overflow controls.

## Components
- Buttons share one shape, focus treatment, and loading/disabled behavior.
- Form controls share one border, background, focus ring, and error vocabulary.
- Status badges pair color with explicit text.
- Document highlights use soft semantic backgrounds plus an underline; document ink remains readable.
- Empty states teach the next action.
- Loading states describe progress and elapsed time instead of showing a blank spinner.

## Motion
Use 150-250ms transitions for state feedback only. Respect `prefers-reduced-motion`. Avoid decorative page choreography, image hover transforms, and motion that delays task work.

## Quality Checks
- No page-level horizontal overflow at desktop or narrow mobile widths.
- Text contrast meets WCAG AA.
- Focus states are visible.
- Product pages use consistent spacing, tokens, and component vocabulary.
- Public landing page includes real product imagery and clear product description.
