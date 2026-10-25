// What the home screen widget shows (spec 04, phase 3: "12 arrivi, 3 da
// saldare"). The widget runs in an isolated runtime (expo-widgets): it cannot
// import modules, read app state, translate or format, so the app hands it
// every string ready to display. Counts only: no customer names, no amounts,
// since a home screen is visible to whoever holds the phone.

/** Colours of the Android widget surface (iOS uses the system colours). */
export interface WidgetColors {
  background: string;
  foreground: string;
  /** Labels: the theme primary, readable on the background in both schemes. */
  accent: string;
}

export interface WidgetItem {
  label: string;
  value: string;
}

export interface DaySummaryWidgetProps {
  /** `summary` shows the counts, `message` only explains why there are none. */
  kind: 'summary' | 'message';
  /** Establishment name, or the app name when not paired. */
  title: string;
  /** Day of the data ("dom 25 ott"), empty when there is none. */
  subtitle: string;
  /** Explanation for the `message` kind. */
  message: string;
  /** Arrivals, to settle, checked in, free spots (in this order); empty for `message`. */
  items: WidgetItem[];
  /** "Aggiornato alle 09:12", empty when there is no data. */
  footer: string;
  /** The whole widget as one sentence for VoiceOver / TalkBack. */
  accessibilityLabel: string;
  colors: { light: WidgetColors; dark: WidgetColors };
}

/** A timeline entry: from `date` on, the widget shows `props` (iOS schedules them). */
export interface WidgetEntry {
  date: Date;
  props: DaySummaryWidgetProps;
}
