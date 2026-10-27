# Adaptive layout reference (Arenile mobile)

## Layout map

| Piece             | Where                                                                                                                                          | Notes                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Pane widths       | `src/components/layout/panes.ts`                                                                                                               | `NAV_RAIL`, `NAV_PANE`, `LIST_PANE`, `MIN_DETAIL`, width rules                                                    |
| Layout class      | `src/components/layout/use-device-layout.ts`                                                                                                   | `layoutFor(w, h)`: tablet when the short side ≥ 600                                                               |
| Phone navigation  | `src/app/(connected)/_layout.tsx`                                                                                                              | stack; home header buttons (map, operations, reports, settings); `ConnectionIndicator` in every header            |
| Tablet navigation | same file, `TabletNavigation` / `NavList` / `NavToggle`; state in `src/components/layout/nav-pane.tsx`                                         | pane beside a stack without back buttons; connection status in the pane                                           |
| Header options    | `src/components/layout/stack-options.ts`                                                                                                       | `OPAQUE_HEADER` (iOS 26 header is see-through by default)                                                         |
| Scroll screens    | `src/components/layout/screen.tsx`, `columns.tsx`                                                                                              | `Screen`: full width, 16 pt gutter at every width; `Columns` puts cards side by side when each keeps `MIN_COLUMN` |
| Master/detail     | `src/components/layout/master-detail.tsx` (`MasterDetail`, `DetailScroll`, `useSplitView`), used by `bookings/index.tsx`, `waitlist/index.tsx` | list pane + detail region; phone pushes `[id]` routes; tablet uses `?selected=`                                   |
| Day map           | `src/features/day-map/components/day-map-view.tsx`, `../layout.ts`                                                                             | sheet beside the map only when the map keeps ≥ 420 pt (`sheetBesideMap`), otherwise it covers the map full height |
| States            | `src/components/state-view.tsx`                                                                                                                | empty, loading, error, forbidden, offline                                                                         |
| Search            | `src/components/search-field.tsx`                                                                                                              | icon and clear button inside the field, every list and the map                                                    |
| Filters           | `src/components/filter-chip.tsx`, `segmented-choice.tsx` (`ChoiceGroup`, `segmented`), `day-picker.tsx`                                        | chips for filters, segmented control for exclusive choices, `DayPicker` for the day                               |
| Tests             | `src/test/render-app.tsx` (`WINDOWS`, `renderApp({ size })`)                                                                                   | real routes and providers at a window size                                                                        |

## Defect catalogue

Check each item at every width of SKILL.md; record file:line and width.

- **Width budget:** nav pane + list pane + detail. Detail < 360 pt or a map < 420 pt is a defect.
- **Breakpoint sizing:** `sm:`/`md:`/`xl:` on pane widths or on control heights (`sm:h-9` = 36 pt).
- **Header order and gutter:** search → chips → count → divider; first element and chips start on
  the same `px-4` line; search icon inside the field; same vertical rhythm (`pt-4 pb-3 gap-3`).
- **Chips:** horizontal scroll reaches the pane edge (`-mx-4` + `px-4` content); the last chip is
  never cut at a fixed inner padding.
- **Empty and placeholder states:** top-aligned in lists; detail placeholder hidden when the list is
  empty; no two states on screen at once saying different things.
- **Titles:** the header title belongs to the column it describes; long titles truncate.
- **Rows:** targets ≥ 44 pt, `numberOfLines` on names and notes, amounts never squeeze names.
- **Borders:** one divider between panes (no double `border-r` + `border-l`), dividers reach both
  edges, no border under a header that already has one.
- **Safe areas:** `pb-safe` on the last scroll container; landscape side insets on iPhone; the
  sheet or drawer above the home indicator.
- **Keyboard:** inputs in the lower half stay visible (`keyboardShouldPersistTaps`, scroll).
- **State across resize:** rotating or entering Split View keeps the selection and route params.
- **Dynamic Type and themes:** XXL text does not clip; dark theme keeps contrast and borders.

## Device check (local, no EAS build needed)

1. Metro for Expo Go: `npx expo start --go --port 8082` (the dev client in `package.json` would
   otherwise be targeted).
2. Simulators: `xcrun simctl list devices available | grep -E "iPhone|iPad"`; boot an iPhone and an
   iPad 11"; install Expo Go on the iPad by copying the iPhone's app
   (`xcrun simctl get_app_container <iphone> host.exp.Exponent`, then `xcrun simctl install <ipad> <path>`).
3. Open the app: `xcrun simctl openurl <udid> "exp://127.0.0.1:8082"`; a route:
   `exp://127.0.0.1:8082/--/waitlist`.
4. Pair (needs a running Arenile instance: `make dev` in the core repo with the demo seed, or the
   public demo) with a pairing code of the instance (panel: Configurazione → Dispositivi → Abbina un
   dispositivo); open its `arenile://pair?d=…` payload as `exp://127.0.0.1:8082/--/pair?d=…` and
   confirm.
5. Rotate with the Simulator menu Device → Rotate Left/Right (⌘← / ⌘→); Split View: open a
   second app beside it from the Dock.
6. Screenshot: `xcrun simctl io <udid> screenshot <file>.png`, then read the image. Compare before
   and after at 390, 834, 1194.
