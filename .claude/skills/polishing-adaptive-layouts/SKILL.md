---
name: polishing-adaptive-layouts
description: Use when a screen of Arenile mobile looks wrong, cramped or inconsistent between iPhone and iPad (portrait, landscape, Split View), when building or changing a tablet master/detail screen, the navigation pane, lists with search and filters, empty states, or when asked to fix margins, borders, spacing or alignment.
---

# Polishing adaptive layouts (Arenile mobile)

## Overview

Phone and tablet must feel like one product: same patterns, same order, same spacing, at every
width the app really runs at. **A defect fixed on one screen is a defect to look for on every
screen** — fix the shared primitive, never one screen's copy.

Rules that still apply: ADR 0004 and `.claude/rules/frontend.md` (Reusables + theme tokens only, no
`style`, 44 pt targets, i18n), AGENTS.md. Read `reference.md` (this folder) for the layout map,
the defect catalogue and the device check before changing code.

## The widths that matter

| Window                  | pt               | Layout                                 |
| ----------------------- | ---------------- | -------------------------------------- |
| iPhone                  | 390 × 844        | phone stack, portrait only (ADR 0016)  |
| iPad 11" portrait       | 834 × 1194       | tablet; nav pane must be the icon rail |
| iPad 11" landscape      | 1194 × 834       | tablet; nav pane may be expanded       |
| iPad 13" portrait       | 1032 × 1376      | tablet                                 |
| Split View / Slide Over | < 600 short side | phone layout (`useDeviceLayout`)       |

Tailwind traps: `sm:` is 640 (every iPad: Reusables `sm:h-9` drops inputs/buttons under 44 pt),
`xl:` is 1280 (never reached by an 11" iPad). Never size a pane with breakpoints; use the shared
layout constants.

## Patterns (the target, every screen)

Pane widths and thresholds live in one module, `src/components/layout/panes.ts` (create it if
missing): `NAV_RAIL` 64, `NAV_PANE` 288, `LIST_PANE` 320, `MIN_DETAIL` 360,
`MIN_CONTENT_BESIDE_NAV` 600, plus `useContentWidth()` (window minus the panes beside the
content). Every width rule (`sheetBesideMap` of the day map included) reads them, never 288 or a
breakpoint.

1. **Navigation (tablet):** a ≡ button as `headerLeft` of every screen opened from the pane (a
   screen pushed from another one keeps the back button instead; label
   `nav.toggleMenu`) toggles the pane; state kept in the tablet layout, not per screen. Collapsed =
   icon rail of `NAV_RAIL` (icons only, `accessibilityLabel` per item, active state kept, connection
   status as its icon). Expanded: beside the content when the content keeps
   ≥ `MIN_CONTENT_BESIDE_NAV`, otherwise an overlay drawer from the left with a scrim, closed by a
   tap outside, by choosing an item or by the Android back button; while open it is modal for
   screen readers (`accessibilityViewIsModal` on iOS, the rail and the content column hidden with
   `importantForAccessibility="no-hide-descendants"`). Default: expanded only when it fits beside
   the content. Everything in the rail fits 48 pt: no text, counts as a badge on the icon
   (`ConnectionIndicator variant="rail"`).
2. **Master/detail:** one shared component (`src/components/layout/master-detail.tsx`; extract it
   if missing) owns list width, one divider and the detail region. Detail placeholder
   ("Seleziona…") only when the list has items; with an empty list the empty state alone fills the
   screen. When the detail would be under `MIN_DETAIL`, the screen behaves as on phones (push the
   `[id]` route). Resizing keeps the selection and route params: the index pushes `[id]` when the
   split stops fitting; `[id]` renders `ToSplit` (`router.dismissTo`, never `<Redirect>`, which
   would stack a second list) when it fits again.
3. **List header, fixed order:** search field (shared `SearchField`, icon inside the field) →
   filter chips (`ChipRow bleed`: scroll edge to edge, first chip on the 16 pt gutter; without
   `bleed` elsewhere, e.g. inside a padded card) → result count → divider.
   Same gutter (`px-4`) and rhythm (`pt-4 pb-3 gap-3`) everywhere; header outside the scroll list.
4. **States:** `StateView` with `align="top"` (add the prop if missing) under a header, in lists
   and panes; centred only on a full empty screen; `px-6`, text never touches a pane edge.
   `pb-safe` once, on the outermost column (a nested `pb-safe` doubles the inset).
5. **Rows, buttons, inputs:** ≥ 44 pt at every width. Reusables' `sm:h-9` is fixed once in
   `src/components/ui/` (listed under local changes in its README), never per call site; long text
   has `numberOfLines`.
6. **Titles:** the header title names the column it belongs to; a split shows the list title, the
   detail names itself in its own heading.

7. **Width:** every screen uses the full content width with the 16 pt gutter (`Screen`, list
   headers, `DetailScroll`): no centred column. Cards go side by side with `Columns`
   (`columnsFor`, `MIN_COLUMN` 320) and `grow` on each card; only the pre-pairing forms
   (`connect`, `manual`) stay a centred `max-w-lg`.
8. **Day:** map and bookings choose the day with `DayPicker` (Oggi · Domani · calendar, ADR 0014),
   never a local today/tomorrow control.

## Workflow

1. Reproduce at the five widths (reference.md, "Device check"); screenshot before.
2. List every defect against the catalogue, then grep for the same pattern in other screens.
3. Fix in the shared primitive (`src/components/layout/`), then adapt the callers.
4. Tests: `renderApp({ size })` at `phone`, `tabletPortrait` (834 × 1194), `tabletLandscape`
   (1194 × 834), `tabletSplitView` (678 × 1032: tablet without the split) — add them to `WINDOWS` in `src/test/render-app.tsx` if missing; the old `tablet`
   (1024 × 1366) alone proves nothing for portrait. Width rules table-driven; extra cases via
   the `test-writer` agent. New strings in it/en/de/fr.
5. Screenshot after, iPhone and iPad portrait/landscape, light and dark; `make check`.

## Red flags

- Changing one screen's `w-80`/`px-8` while another screen has the same split → extract it.
- "Tested at tablet" with only 1024 × 1366 → test 834 and 1194.
- Removing an affordance (search icon, label) on one screen only → pick one rule, apply to all.
- A literal pane width (`288`, `w-72`, `w-80`) outside `panes.ts` and the components that use it.
- Checking the rail or a header only in the quiet state: test offline and with operations waiting.
- Done without a simulator screenshot at 834 pt.
