// Rows of the figure cards of "Oggi": every row is full, so the grid never
// shows a short last row that looks like a missing card (3 + 2). With the
// room for `fits` cards side by side it uses equal rows of the most cards
// that divide the count, or one full-width card first and equal rows after
// it: 5 cards are 5, or 1 + 4, or 1 + 2 + 2.

/** Narrowest figure card: a three-digit number and a two-word label at 16 pt. */
export const FIGURE_MIN = 150;
/** Space between cards (gap-3). */
export const FIGURE_GAP = 12;

/** How many cards fit side by side in `width` points. */
export function figuresPerRow(width: number): number {
  return Math.max(1, Math.floor((width + FIGURE_GAP) / (FIGURE_MIN + FIGURE_GAP)));
}

/** Size of each row for `count` cards in `width` points. */
export function figureRows(count: number, width: number): number[] {
  if (count <= 0) return [];
  for (let columns = Math.min(figuresPerRow(width), count); columns > 1; columns--) {
    if (count % columns === 0) return Array<number>(count / columns).fill(columns);
    if ((count - 1) % columns === 0)
      return [1, ...Array<number>((count - 1) / columns).fill(columns)];
  }
  return Array<number>(count).fill(1);
}
