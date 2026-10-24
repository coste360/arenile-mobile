import { versionAtLeast } from './version';

// Same cases as TestVersionAtLeast_Scenarios in the core
// (internal/desktop/remote/remote_test.go), plus app-specific ones.
describe('versionAtLeast', () => {
  it.each([
    ['1.2.0', '1.2.0', true],
    ['1.10.0', '1.9.9', true],
    ['v2.0.0', '1.99.0', true],
    ['1.2.0', '1.3.0', false],
    ['0.9.0-rc.1', '0.9.0', true],
    ['dev', '9.0.0', true],
    ['1.2', '1.2.1', false],
    ['1.2.0', '', true],
    ['1.0.1', '1.0.0', true],
    ['0.9.9', '1.0.0', false],
    ['1.0.0+build.5', '1.0.0', true],
    ['1.2.3.4', '1.0.0', true],
    ['1.x.0', '1.0.0', true],
    [null, '1.0.0', true],
    ['2.0.0', undefined, true],
  ] as const)('versionAtLeast(%j, %j) = %j', (version, minimum, expected) => {
    expect(versionAtLeast(version, minimum)).toBe(expected);
  });
});
