// Home screen widget, iOS (WidgetKit via expo-widgets, layout in SwiftUI with
// Expo UI). The component is serialised by the `'widget'` directive and runs
// in the widget extension: no imports beyond Expo UI, no hooks, no values from
// outside the function. It only lays out the props the app prepared
// (features/widget/summary.ts) and never reads the network or the app's data.
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { DaySummaryWidgetProps } from '@/features/widget/types';

const DaySummary = (props: DaySummaryWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'systemSmall';
  // Small: arrivals and to settle (the spec's "12 arrivi, 3 da saldare"); medium: all four.
  const items = small ? props.items.slice(0, 2) : props.items;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[accessibilityElement('ignore'), accessibilityLabel(props.accessibilityLabel)]}
    >
      <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1), minimumScaleFactor(0.7)]}>
        {props.title}
      </Text>
      {props.subtitle ? (
        <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>
          {props.subtitle}
        </Text>
      ) : null}
      <Spacer />
      {props.kind === 'message' ? (
        <Text modifiers={[font({ textStyle: small ? 'caption' : 'subheadline' }), lineLimit(4)]}>
          {props.message}
        </Text>
      ) : small ? (
        <VStack alignment="leading" spacing={2}>
          {items.map((item) => (
            <HStack key={item.label} spacing={6}>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>
                {item.value}
              </Text>
              <Text modifiers={[font({ textStyle: 'caption' }), secondary, lineLimit(1)]}>
                {item.label}
              </Text>
            </HStack>
          ))}
        </VStack>
      ) : (
        <HStack spacing={12}>
          {items.map((item) => (
            <VStack key={item.label} alignment="leading" spacing={0}>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>
                {item.value}
              </Text>
              <Text
                modifiers={[
                  font({ textStyle: 'caption' }),
                  secondary,
                  lineLimit(1),
                  minimumScaleFactor(0.7),
                ]}
              >
                {item.label}
              </Text>
            </VStack>
          ))}
        </HStack>
      )}
      <Spacer />
      {props.footer ? (
        <Text modifiers={[font({ textStyle: 'caption2' }), secondary, lineLimit(1)]}>
          {props.footer}
        </Text>
      ) : null}
    </VStack>
  );
};

/** Shown in the widget gallery and before the app publishes the first snapshot. */
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
