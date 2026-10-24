// Build-time facts about this app. No server address here: the app has no
// default instance, the user pairs it with their own (spec 29.2).
import Constants from 'expo-constants';

/** Version of this app (app.json "version"), sent at pairing and checked against min_client_versions.mobile. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Oldest Arenile instance this app supports: 1.0.0 is the first release with
 * device pairing and min_client_versions (core ADR 0015). Raise it when the
 * app starts relying on newer API operations, and say so in CHANGELOG.md.
 */
export const MIN_INSTANCE_VERSION = '1.0.0';
