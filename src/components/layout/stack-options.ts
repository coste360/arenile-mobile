/**
 * Header options shared by every stack. Since iOS 26 the native header is
 * see-through by default and the screen extends under it: scroll views move
 * their content below it, but the fixed top of the bookings list, the
 * waitlist and the day map ended up behind the title. An opaque header keeps
 * every screen below it, on phones and tablets.
 */
export const OPAQUE_HEADER = { headerTransparent: false } as const;
