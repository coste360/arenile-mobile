/**
 * Header options shared by every stack. Since iOS 26 the native header is
 * see-through by default and the screen extends under it: scroll views move
 * their content below it, but the fixed top of the bookings list, the
 * waitlist and the day map ended up behind the title. An opaque header keeps
 * every screen below it, on phones and tablets.
 */
export const OPAQUE_HEADER = { headerTransparent: false } as const;

/**
 * Phones stay in portrait: in landscape a phone keeps about 390 pt of height
 * for header, toolbar and content. Tablets rotate freely (a counter stand is
 * often landscape, and iPad multitasking needs every orientation).
 * app.json declares the same for iOS, so the launch is already portrait.
 */
export function orientationFor(formFactor: 'phone' | 'tablet') {
  // portrait_up: Android's 'portrait' also allows upside down, iPhone does not.
  return formFactor === 'phone' ? ('portrait_up' as const) : ('default' as const);
}
