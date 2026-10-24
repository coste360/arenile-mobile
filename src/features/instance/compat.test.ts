import { meta } from '@/test/fake-fetch';

import { checkCompatibility } from './compat';

const versions = { app: '1.0.0', minInstance: '1.0.0' };

describe('checkCompatibility', () => {
  it.each([
    ['same versions', meta(), versions, { ok: true }],
    ['newer instance', meta({ version: '1.4.2' }), versions, { ok: true }],
    ['development instance', meta({ version: 'dev' }), versions, { ok: true }],
    ['v-prefixed tag', meta({ version: 'v1.0.1' }), versions, { ok: true }],
    [
      'instance too old',
      meta({ version: '0.9.3' }),
      versions,
      { ok: false, reason: 'instance_too_old' },
    ],
    [
      'app too old',
      meta({ min_client_versions: { mobile: '1.1.0', desktop: '0.1.0' } }),
      versions,
      { ok: false, reason: 'app_too_old' },
    ],
    [
      'newer app than required',
      meta({ min_client_versions: { mobile: '1.0.0', desktop: '0.1.0' } }),
      { app: '1.2.0', minInstance: '1.0.0' },
      { ok: true },
    ],
    [
      'instance check wins over app check',
      meta({ version: '0.5.0', min_client_versions: { mobile: '9.0.0', desktop: '0.1.0' } }),
      versions,
      { ok: false, reason: 'instance_too_old' },
    ],
    [
      'not an Arenile instance',
      { ...meta(), product: 'other' as 'arenile' },
      versions,
      { ok: false, reason: 'not_arenile' },
    ],
  ])('%s', (_name, m, v, expected) => {
    expect(checkCompatibility(m, v)).toEqual(expected);
  });
});
