// Platforms without home screen widgets (web): nothing to register. Metro
// picks day-summary-widget.ios.tsx / .android.tsx on the phones.
import type { DaySummaryWidgetProps } from '@/features/widget/types';

export interface DaySummaryWidget {
  updateSnapshot(props: DaySummaryWidgetProps): void;
  updateTimeline(entries: { date: Date; props: DaySummaryWidgetProps }[]): void;
}

const widget: DaySummaryWidget | null = null;
export default widget;
