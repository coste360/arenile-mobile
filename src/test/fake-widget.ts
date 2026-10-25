// In-memory home screen widget: records what the app publishes.
import type { WidgetBridge } from '@/features/widget/bridge';
import type { WidgetEntry } from '@/features/widget/types';

export interface FakeWidget extends WidgetBridge {
  /** Every publication, in order. */
  published: WidgetEntry[][];
  /** The entries currently shown (last publication). */
  current(): readonly WidgetEntry[] | undefined;
}

export function createFakeWidget(): FakeWidget {
  const published: WidgetEntry[][] = [];
  return {
    published,
    publish(entries) {
      published.push([...entries]);
    },
    current: () => published.at(-1),
  };
}
