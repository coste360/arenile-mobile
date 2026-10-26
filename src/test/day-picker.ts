// Picks a day in the DayPicker (day map, bookings list) through its native
// calendar, mocked in jest.setup.ts as a plain view with the picker's props.
import { fireEvent, type screen as Screen } from 'expo-router/testing-library';

import type { CalendarDate } from '@/lib/calendar';

/** The third segment: "Scegli un altro giorno", or the chosen date with "cambia giorno". */
export const OTHER_DAY = /^Scegli un altro giorno$|, cambia giorno$/;

/**
 * Opens the calendar from the third segment and picks `date`, given to the
 * picker as local noon like the native one does (toPickerDate).
 */
export async function pickDay(screen: typeof Screen, date: CalendarDate) {
  await fireEvent.press(screen.getByRole('radio', { name: OTHER_DAY }));
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  await fireEvent(
    await screen.findByTestId('day-picker-calendar'),
    'valueChange',
    { type: 'set' },
    new Date(y, m - 1, d, 12),
  );
}

/** Dates asked to `path` (the `date` or `from` query parameter), in order. */
export function datesRequested(calls: Request[], path: string, param = 'date'): string[] {
  return calls
    .filter((r) => new URL(r.url).pathname === path)
    .map((r) => new URL(r.url).searchParams.get(param) ?? '');
}
