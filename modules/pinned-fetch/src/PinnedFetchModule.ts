// The native module, or null when this build does not contain it (Expo Go,
// web, unit tests): callers then refuse self-signed instances (ADR 0006).
import { requireOptionalNativeModule } from 'expo';

import type { PinnedFetchNativeModule } from './PinnedFetch.types';

export default requireOptionalNativeModule<PinnedFetchNativeModule>('PinnedFetch');
