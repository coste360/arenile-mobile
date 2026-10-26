// Layout of the day map on tablets: whether the spot sheet fits beside the map.
import { MIN_MAP, SHEET_PANE } from '@/components/layout/panes';

/**
 * Whether the spot sheet fits beside the map in `content` points (the window
 * minus the navigation); otherwise it opens under the map, as on phones.
 */
export function sheetBesideMap(tablet: boolean, content: number): boolean {
  return tablet && content - SHEET_PANE >= MIN_MAP;
}
