import type { DaySummaryWidget } from '@/widgets/day-summary-widget';

import { createExpoWidgetBridge, loadDaySummaryWidget } from './bridge';
import { WIDGET_COLORS } from './colors';
import type { DaySummaryWidgetProps, WidgetEntry } from './types';

const props = (message: string): DaySummaryWidgetProps => ({
  kind: 'message',
  title: 'Lido Azzurro',
  subtitle: '',
  message,
  items: [],
  footer: '',
  accessibilityLabel: message,
  colors: WIDGET_COLORS,
});

const ENTRIES: WidgetEntry[] = [
  { date: new Date('2026-10-25T08:30:00Z'), props: props('now') },
  { date: new Date('2026-10-25T23:00:00Z'), props: props('midnight') },
];

function fakeWidget() {
  return { updateSnapshot: jest.fn(), updateTimeline: jest.fn() } satisfies DaySummaryWidget;
}

describe('createExpoWidgetBridge', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('schedules the whole timeline on iOS', () => {
    const widget = fakeWidget();
    createExpoWidgetBridge(() => widget, 'ios', false).publish(ENTRIES);
    expect(widget.updateTimeline).toHaveBeenCalledWith(ENTRIES);
    expect(widget.updateSnapshot).not.toHaveBeenCalled();
  });

  it('shows the current entry on Android (no timelines)', () => {
    const widget = fakeWidget();
    createExpoWidgetBridge(() => widget, 'android', false).publish(ENTRIES);
    expect(widget.updateSnapshot).toHaveBeenCalledWith(ENTRIES[0]!.props);
    expect(widget.updateTimeline).not.toHaveBeenCalled();
  });

  it('does nothing on other platforms, without loading the module', () => {
    const load = jest.fn(fakeWidget);
    createExpoWidgetBridge(load, 'web').publish(ENTRIES);
    expect(load).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'])('never loads the module in Expo Go (%s)', (os) => {
    const load = jest.fn(fakeWidget);
    createExpoWidgetBridge(load, os, true).publish(ENTRIES);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the widget module once', () => {
    const load = jest.fn(fakeWidget);
    const bridge = createExpoWidgetBridge(load, 'ios', false);
    bridge.publish(ENTRIES);
    bridge.publish(ENTRIES);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the app working on a build without the widget (Expo Go)', () => {
    const load = jest.fn(() => {
      throw new Error("Cannot find native module 'ExpoWidgets'");
    });
    const bridge = createExpoWidgetBridge(load, 'ios', false);
    expect(() => bridge.publish(ENTRIES)).not.toThrow();
    expect(() => bridge.publish(ENTRIES)).not.toThrow();
    expect(load).toHaveBeenCalledTimes(1);
    // The warning names the error kind only, never its message.
    expect(console.warn).toHaveBeenCalledWith('widget: not available on this build', 'Error');
  });

  it('survives a failing native update', () => {
    const widget = fakeWidget();
    widget.updateSnapshot.mockImplementation(() => {
      throw new TypeError('bad props');
    });
    expect(() =>
      createExpoWidgetBridge(() => widget, 'android', false).publish(ENTRIES),
    ).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith('widget: update failed', 'TypeError');
  });

  it('ignores an empty publication', () => {
    const widget = fakeWidget();
    createExpoWidgetBridge(() => widget, 'ios', false).publish([]);
    expect(widget.updateTimeline).not.toHaveBeenCalled();
  });
});

describe('loadDaySummaryWidget', () => {
  it('does not load the widget module when its native module is missing (Expo Go)', () => {
    const requireWidget = jest.fn(fakeWidget);
    expect(loadDaySummaryWidget(() => false, requireWidget)).toBeNull();
    expect(requireWidget).not.toHaveBeenCalled();
  });

  it('loads the widget module when the build has it', () => {
    const widget = fakeWidget();
    expect(
      loadDaySummaryWidget(
        () => true,
        () => widget,
      ),
    ).toBe(widget);
  });
});
