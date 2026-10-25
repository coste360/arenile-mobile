import { render, screen } from '@testing-library/react-native';

import { gridDocument } from '@/test/map-fixtures';

import { contentRect, fitCamera, zoomAt, scaleLimits } from '../geometry';
import { buildDaySpots } from '../model';
import { MAP_PALETTE } from '../palette';
import { MapCanvas, truncate } from './map-canvas';

const texts = { anonymous: 'Cliente anonimo', anonymousShort: 'Anonimo' };
const viewport = { width: 390, height: 460 };
// The SVG is hidden from screen readers (the list and the sheet carry the content).
const HIDDEN = { includeHiddenElements: true };

describe('MapCanvas', () => {
  // 30 × 20 = 600 umbrellas: a large lido.
  const document = gridDocument(30, 20);
  const spots = buildDaySpots({
    document,
    day: undefined,
    slot: 'FULL',
    canSeeCustomers: true,
    texts,
  });
  const fit = fitCamera(contentRect(document.map), viewport);

  async function draw(camera = fit, extra: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
    await render(
      <MapCanvas
        document={document}
        spots={spots}
        camera={camera}
        viewport={viewport}
        overscan={0.25}
        palette={MAP_PALETTE.light}
        locale="it"
        seaLabel="Mare"
        {...extra}
      />,
    );
    return screen.queryAllByTestId(/^spot-/, HIDDEN);
  }

  it('draws every spot of the fitted map', async () => {
    expect(await draw()).toHaveLength(600);
  });

  it('draws only the spots around the viewport when zoomed in', async () => {
    const zoomed = zoomAt(fit, { x: 0, y: 0 }, 8, scaleLimits(fit));
    const drawn = await draw(zoomed);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(60);
  });

  it('dims the spots that do not match the search', async () => {
    const first = spots[0]!.id;
    await draw(fit, { matches: new Set([first]) });
    expect(screen.getByTestId(`spot-${first}`, HIDDEN)).toHaveProp('opacity', 1);
    expect(screen.getByTestId(`spot-${spots[1]!.id}`, HIDDEN)).toHaveProp('opacity', 0.3);
  });

  it('truncates captions to the room they have', () => {
    expect(truncate('Bianchi', 100, 10)).toBe('Bianchi');
    expect(truncate('Bianchi-Visconti', 40, 10)).toBe('Bianch…');
  });
});
