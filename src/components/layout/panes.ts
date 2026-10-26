// Widths of the tablet panes and the rules built on them: whether the
// navigation pane fits beside the content, how wide the content is, whether
// a detail fits beside its list. Every adaptive layout reads these (pane
// classes w-16, w-72, w-80, w-96 are the same numbers), never a breakpoint.

/** Icon rail of the collapsed navigation (w-16). */
export const NAV_RAIL = 64;
/** Expanded navigation pane (w-72). */
export const NAV_PANE = 288;
/** List of a master/detail screen (w-80). */
export const LIST_PANE = 320;
/** Narrowest detail beside its list; below it the detail opens as on phones. */
export const MIN_DETAIL = 360;
/** Spot sheet beside the day map (w-96). */
export const SHEET_PANE = 384;
/** Narrowest day map beside its sheet; below it the sheet opens under the map. */
export const MIN_MAP = 420;
/** Narrowest content beside the expanded navigation; below it the pane is a drawer over it. */
export const MIN_CONTENT_BESIDE_NAV = 600;

/** Collapsed rail, expanded beside the content, or expanded as a drawer over it. */
export type NavMode = 'rail' | 'beside' | 'drawer';

/** Whether the expanded navigation fits beside the content in a window `width` wide. */
export function navFitsBeside(width: number): boolean {
  return width - NAV_PANE >= MIN_CONTENT_BESIDE_NAV;
}

export function navMode(expanded: boolean, width: number): NavMode {
  if (!expanded) return 'rail';
  return navFitsBeside(width) ? 'beside' : 'drawer';
}

/** Width left to the screen content next to the navigation (the drawer covers it, the rail stays). */
export function contentWidth(width: number, mode: NavMode | null): number {
  if (mode === null) return width;
  return width - (mode === 'beside' ? NAV_PANE : NAV_RAIL);
}

/** Whether a master/detail screen keeps the detail beside the list in `content` points. */
export function detailFitsBeside(content: number): boolean {
  return content - LIST_PANE >= MIN_DETAIL;
}
