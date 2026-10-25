// Home screen widget, Android (Jetpack Glance via expo-widgets, layout with
// the Compose components of Expo UI). Serialised by the `'widget'` directive:
// no imports beyond Expo UI, no hooks, no values from outside the function.
// It only lays out the props the app prepared (features/widget/summary.ts),
// colours included, and never reads the network or the app's data.
import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { DaySummaryWidgetProps } from '@/features/widget/types';

const DaySummary = (props: DaySummaryWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const colors = environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  // The initial layout carries no colours: Glance defaults until the first snapshot.
  const surface = colors.background
    ? [fillMaxSize(), background(colors.background), paddingAll(12)]
    : [fillMaxSize(), paddingAll(12)];
  const foreground = colors.foreground || undefined;
  const accent = colors.accent || undefined;

  return (
    <Column verticalArrangement={{ spacedBy: 4 }} modifiers={surface}>
      <Text color={foreground} maxLines={1} style={{ typography: 'titleMedium' }}>
        {props.title}
      </Text>
      {props.subtitle ? (
        <Text color={accent} maxLines={1} style={{ typography: 'labelMedium' }}>
          {props.subtitle}
        </Text>
      ) : null}
      {props.kind === 'message' ? (
        <Text color={foreground} maxLines={4} style={{ typography: 'bodySmall' }}>
          {props.message}
        </Text>
      ) : (
        <Column verticalArrangement={{ spacedBy: 2 }}>
          {props.items.map((item) => (
            <Row
              key={item.label}
              horizontalArrangement={{ spacedBy: 6 }}
              verticalAlignment="center"
            >
              <Text color={foreground} style={{ typography: 'titleLarge', fontWeight: 'bold' }}>
                {item.value}
              </Text>
              <Text color={accent} maxLines={1} style={{ typography: 'labelMedium' }}>
                {item.label}
              </Text>
            </Row>
          ))}
        </Column>
      )}
      <Spacer />
      {props.footer ? (
        <Text color={accent} maxLines={1} style={{ typography: 'labelSmall' }}>
          {props.footer}
        </Text>
      ) : null}
    </Column>
  );
};

/** Shown in the widget picker and before the app publishes the first snapshot. */
const INITIAL: DaySummaryWidgetProps = {
  kind: 'message',
  title: 'Arenile',
  subtitle: '',
  message: 'Apri Arenile per vedere il riepilogo del giorno.',
  items: [],
  footer: '',
  accessibilityLabel: 'Arenile. Apri Arenile per vedere il riepilogo del giorno.',
  colors: {
    light: { background: '', foreground: '', accent: '' },
    dark: { background: '', foreground: '', accent: '' },
  },
};

export default createWidget('DaySummary', DaySummary, INITIAL);
