// Pan and pinch zoom of the day map (react-native-gesture-handler v3 hooks +
// Reanimated). While a gesture runs, the UI thread moves and scales the
// already drawn SVG as one native layer (no React render, smooth with
// hundreds of spots); when it ends, the transform is committed to the camera
// (React state) and the SVG is redrawn sharp at the new scale. A single tap
// gesture hit-tests the spots, instead of one touchable per SVG shape.
//
// The one file of the map that needs `style` (ADR 0008): the live transform
// comes from shared values and the drawing is placed in dp around the
// viewport; neither can be a class. Listed in scripts/style-guard.js.
import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

import {
  boundCamera,
  centerOn,
  commitLive,
  fitCamera,
  resizeCamera,
  scaleLimits,
  screenToMap,
  zoomAt,
  type Camera,
  type Point,
  type Rect,
  type Size,
} from '../geometry';

cssInterop(GestureHandlerRootView, { className: 'style' });

/** Drawn area around the viewport, in viewports per side: a pan shows map, not blanks. */
export const OVERSCAN = 0.25;
/** Zoom step of the buttons. */
const ZOOM_STEP = 1.6;

export interface FocusRequest {
  point: Point;
  /** Smallest scale to show it at, relative to the fit (labels readable). */
  minZoom: number;
  /** Changes for every request (the same spot may be asked twice). */
  nonce: number;
}

export interface MapViewportProps {
  /** Map rectangle to fit (sand and sea), in map units. */
  content: Rect;
  /** Size used until the first layout (and in tests, where layout never runs). */
  initialSize: Size;
  /** Accessible name of the map (what it shows and how to explore it without gestures). */
  accessibilityLabel: string;
  /** Draws the map for a camera; called only when the camera or the data change. */
  children: (camera: Camera, viewport: Size) => ReactNode;
  /** A tap at a map point (map units) at scale `k`. */
  onTap?: (point: Point, k: number) => void;
  focus?: FocusRequest;
}

export function MapViewport({
  content,
  initialSize,
  accessibilityLabel,
  children,
  onTap,
  focus,
}: MapViewportProps) {
  const { t } = useTranslation();
  const [measured, setMeasured] = useState<Size | null>(null);
  const size = measured ?? initialSize;
  const fit = useMemo(() => fitCamera(content, size), [content, size]);
  const limits = useMemo(() => scaleLimits(fit), [fit]);
  const [chosen, setChosen] = useState<Camera | null>(null);
  const camera = chosen ?? fit;

  // Live transform of the running gesture (UI thread): p' = p * s + o.
  const s = useSharedValue(1);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const active = useSharedValue(0);
  // Scale limits of the live transform, relative to the committed camera.
  const minS = useSharedValue(limits.min / camera.k);
  const maxS = useSharedValue(limits.max / camera.k);
  const resetPending = useRef(false);

  useEffect(() => {
    minS.set(limits.min / camera.k);
    maxS.set(limits.max / camera.k);
  }, [camera.k, limits, minS, maxS]);

  const update = useCallback(
    (next: (cam: Camera) => Camera) =>
      setChosen((prev) => boundCamera(next(prev ?? fit), content, size)),
    [fit, content, size],
  );

  // Latest values for the gesture callbacks, which outlive a render.
  const latest = useRef({ camera, onTap, limits, size, update });
  useLayoutEffect(() => {
    latest.current = { camera, onTap, limits, size, update };
  });

  // Gesture end (JS thread): the live transform becomes the camera. Stable,
  // because the worklets keep a reference to it.
  const [commit] = useState(() => (ls: number, lx: number, ly: number) => {
    const { limits: l, size: v, update: u } = latest.current;
    resetPending.current = true;
    u((cam) => commitLive(cam, { s: ls, ox: lx, oy: ly }, l, v));
  });

  // The redrawn SVG already includes the transform: drop it in the same commit.
  useLayoutEffect(() => {
    if (!resetPending.current) return;
    resetPending.current = false;
    s.set(1);
    ox.set(0);
    oy.set(0);
  }, [chosen, s, ox, oy]);

  // When the last finger of pan and pinch lifts, commit what moved. Declared
  // before the gestures: a worklet copies its closure when it is created, so a
  // worklet defined later would be captured as undefined and crash the UI thread.
  const finish = () => {
    'worklet';
    active.set(Math.max(0, active.get() - 1));
    const ls = s.get();
    const lx = ox.get();
    const ly = oy.get();
    if (active.get() === 0 && (ls !== 1 || lx !== 0 || ly !== 0)) scheduleOnRN(commit, ls, lx, ly);
  };

  const pan = usePanGesture({
    averageTouches: true,
    onBegin: () => {
      'worklet';
      active.set(active.get() + 1);
    },
    onUpdate: (e) => {
      'worklet';
      ox.set(ox.get() + e.changeX);
      oy.set(oy.get() + e.changeY);
    },
    onFinalize: () => {
      'worklet';
      finish();
    },
  });

  const pinch = usePinchGesture({
    testID: 'day-map-pinch',
    onBegin: () => {
      'worklet';
      active.set(active.get() + 1);
    },
    onUpdate: (e) => {
      'worklet';
      const prev = s.get();
      const next = Math.min(maxS.get(), Math.max(minS.get(), prev * e.scaleChange));
      const c = next / prev;
      ox.set(e.focalX - (e.focalX - ox.get()) * c);
      oy.set(e.focalY - (e.focalY - oy.get()) * c);
      s.set(next);
    },
    onFinalize: () => {
      'worklet';
      finish();
    },
  });

  const tap = useTapGesture({
    runOnJS: true,
    testID: 'day-map-tap',
    onActivate: (e) => {
      const { camera: cam, onTap: handler } = latest.current;
      handler?.(screenToMap(cam, { x: e.x, y: e.y }), cam.k);
    },
  });

  const gesture = useCompetingGestures(useSimultaneousGestures(pan, pinch), tap);

  const live = useAnimatedStyle(() => ({
    transform: [{ translateX: ox.get() }, { translateY: oy.get() }, { scale: s.get() }],
  }));

  // Centre on a spot chosen from the search or the list.
  const lastFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || focus.nonce === lastFocus.current) return;
    lastFocus.current = focus.nonce;
    update((cam) => centerOn(cam, focus.point, size, limits, fit.k * focus.minZoom));
  }, [focus, update, size, limits, fit.k]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.width || height !== size.height)) {
      setMeasured({ width, height });
      // Rotation, the phone sheet opening: what was in the centre stays there.
      setChosen((prev) => (prev ? resizeCamera(prev, size, { width, height }) : null));
    }
  };

  const zoom = (factor: number) =>
    update((cam) => zoomAt(cam, { x: size.width / 2, y: size.height / 2 }, factor, limits));
  const percent = Math.round((camera.k / fit.k) * 100);

  return (
    <GestureHandlerRootView className="flex-1 overflow-hidden bg-map-sand">
      <View className="flex-1" onLayout={onLayout}>
        <GestureDetector gesture={gesture}>
          <View
            className="absolute inset-0"
            accessible
            role="img"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ text: t('dayMap.zoom.value', { percent }) }}
            testID="day-map-viewport"
          >
            <Animated.View
              style={[
                { position: 'absolute', left: 0, top: 0, width: size.width, height: size.height },
                { transformOrigin: 'top left' },
                live,
              ]}
            >
              <View
                style={{
                  position: 'absolute',
                  left: -size.width * OVERSCAN,
                  top: -size.height * OVERSCAN,
                }}
              >
                {children(camera, size)}
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
        <View className="absolute bottom-3 right-3 gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 border border-border"
            accessibilityLabel={t('dayMap.zoom.in')}
            disabled={camera.k >= limits.max * 0.999}
            onPress={() => zoom(ZOOM_STEP)}
          >
            <Icon as={ZoomInIcon} size={20} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 border border-border"
            accessibilityLabel={t('dayMap.zoom.out')}
            disabled={camera.k <= limits.min * 1.001}
            onPress={() => zoom(1 / ZOOM_STEP)}
          >
            <Icon as={ZoomOutIcon} size={20} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 border border-border"
            accessibilityLabel={t('dayMap.zoom.fit')}
            onPress={() => setChosen(null)}
          >
            <Icon as={MaximizeIcon} size={20} />
          </Button>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
