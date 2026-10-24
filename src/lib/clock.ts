// Injected clock, like the core's internal/clock: code that needs the time
// receives a Clock, so tests are deterministic.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
