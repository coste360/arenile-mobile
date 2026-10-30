import { backdropColours, shoreFrame, shorePath } from './backdrop';
import { MAP_PALETTE } from './palette';

describe('backdropColours', () => {
  // The panel's MapBackdrop: fill-beach-sand-soft, fill-beach-wood (grain),
  // fill-beach-water-soft, stroke-beach-water, fill-map-sea-label
  // (core web/shared/src/styles/globals.css, light and .dark).
  it.each([
    [
      'light',
      {
        sand: '#fbf7f0',
        grain: '#ba9472',
        sea: '#e3f4f7',
        wave: '#a9d7e4',
        label: 'hsl(202 80.3% 23.9%)', // #0c4a6e
      },
    ],
    [
      'dark',
      {
        sand: '#3a3833',
        grain: '#cfb396',
        sea: '#2c4553',
        wave: '#74afc4',
        label: 'hsl(200 72.4% 88.6%)', // #cde9f7
      },
    ],
  ] as const)('%s uses the panel tokens', (scheme, want) => {
    expect(backdropColours(MAP_PALETTE[scheme])).toEqual(want);
  });
});

describe('shorePath', () => {
  it.each([
    // length, depth, offset, waves, line start, fill end
    [96, 30, 0, 1, 'M0 0 Q24 -4 48 0 T96 0', ' L96 30 L0 30Z'],
    [192, 30, 0, 2, 'M0 0 Q24 -4 48 0 T96 0 Q120 -4 144 0 T192 0', ' L192 30 L0 30Z'],
    [40, 24, 0, 1, 'M0 0 Q10 -4 20 0 T40 0', ' L40 24 L0 24Z'],
    [96, 30, 10, 1, 'M0 10 Q24 6 48 10 T96 10', ' L96 30 L0 30Z'],
  ])('length %d depth %d offset %d: %d wave(s)', (length, depth, offset, waves, line, fillEnd) => {
    const p = shorePath(length, depth, offset);
    expect(p.line).toBe(line);
    expect(p.line.match(/Q/g)).toHaveLength(waves);
    expect(p.fill).toBe(`${line}${fillEnd}`);
  });
});

describe('shoreFrame', () => {
  it.each([
    ['bottom', { transform: 'translate(0 200)', length: 300 }],
    ['top', { transform: 'translate(300 0) rotate(180)', length: 300 }],
    ['left', { transform: 'rotate(90)', length: 200 }],
    ['right', { transform: 'translate(300 200) rotate(-90)', length: 200 }],
  ] as const)('sea on the %s', (side, want) => {
    expect(shoreFrame(side, 300, 200)).toEqual(want);
  });
});
