// Typed translation keys: t('…') only accepts keys of the Italian source file.
import 'i18next';

import type it from './locales/it.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof it };
  }
}
