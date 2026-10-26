// Build-time facts about this app. The app has no default instance, the user
// pairs it with their own (spec 29.2); the only address here is the demo
// instance of Coste360, reached only from "Prova la demo" (ADR 0015).
import Constants from 'expo-constants';

/** Version of this app (app.json "version"), sent at pairing and checked against min_client_versions.mobile. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Oldest Arenile instance this app supports: 1.0.0 is the first release with
 * device pairing and min_client_versions (core ADR 0015). Raise it when the
 * app starts relying on newer API operations, and say so in CHANGELOG.md.
 */
export const MIN_INSTANCE_VERSION = '1.0.0';

/** Demo instance of Coste360 (core ADR 0027): sample data, reset every night. */
export const DEMO_INSTANCE_URL = 'https://demo.arenile.app';
