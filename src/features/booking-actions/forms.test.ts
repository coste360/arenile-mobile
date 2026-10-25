import { cashSchema, noteSchema } from './forms';
import { NOTE_MAX_LENGTH } from './rules';

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0]!.message;

describe('noteSchema', () => {
  it.each([
    ['Ombrellone da sostituire', null],
    ['   ', 'operations.note.errors.note_empty'],
    ['x'.repeat(NOTE_MAX_LENGTH), null],
    ['x'.repeat(NOTE_MAX_LENGTH + 1), 'operations.note.errors.note_too_long'],
  ])('%j → %s', (text, want) => {
    expect(firstMessage(noteSchema.safeParse({ text }))).toBe(want);
  });

  it('trims the text it returns', () => {
    expect(noteSchema.parse({ text: '  Arriva alle 11 ' })).toEqual({ text: 'Arriva alle 11' });
  });
});

describe('cashSchema', () => {
  it.each([
    ['20,00', null],
    ['5', null],
    ['20,01', 'operations.cash.errors.amount_over_balance'],
    ['0', 'operations.cash.errors.amount_zero'],
    ['dieci', 'operations.cash.errors.amount_invalid'],
  ])('%j with 20,00 € due → %s', (amount, want) => {
    expect(firstMessage(cashSchema(2000).safeParse({ amount }))).toBe(want);
  });
});
