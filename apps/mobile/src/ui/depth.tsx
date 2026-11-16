import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Shadows are tinted with the ink colour, not grey, and always come in two layers:
 * a tight contact shadow that seats the surface on the page, and a soft ambient one.
 */
export const shadow = {
  card: { boxShadow: '0 1px 2px rgba(14,22,17,0.06), 0 6px 18px -6px rgba(14,22,17,0.10)' } as ViewStyle,
  raised: { boxShadow: '0 2px 4px rgba(14,22,17,0.08), 0 14px 32px -10px rgba(14,22,17,0.22)' } as ViewStyle,
  float: { boxShadow: '0 4px 10px rgba(60,90,0,0.22), 0 18px 36px -12px rgba(60,90,0,0.45)' } as ViewStyle,
  dark: { boxShadow: '0 2px 6px rgba(8,14,10,0.25), 0 20px 40px -14px rgba(8,14,10,0.55)' } as ViewStyle,
};

/** A hairline stroke that reads on white without looking like a box. */
export const stroke = { borderWidth: 1, borderColor: 'rgba(14,22,17,0.07)' } as ViewStyle;

/** Top-edge highlight that makes a filled surface look lit from above. */
export const sheen = { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' } as ViewStyle;

type GradientProps = {
  colors: readonly string[];
  /** 'down' runs top to bottom; 'diagonal' runs from the top start corner. */
  direction?: 'down' | 'diagonal';
  /** Optional soft glow: colour and where it sits, as fractions of the box. */
  glow?: { color: string; x: number; y: number; r?: number; opacity?: number };
};

/** Paints a gradient behind its parent's content. The parent clips it with overflow: hidden. */
export function Gradient({ colors, direction = 'down', glow }: GradientProps) {
  const id = useId().replace(/:/g, '');
  const stops = colors.map((c, i) => <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0" x2={direction === 'diagonal' ? '1' : '0'} y2="1">{stops}</LinearGradient>
          {glow && (
            <RadialGradient id={`r${id}`} cx={glow.x} cy={glow.y} r={glow.r ?? 0.6} fx={glow.x} fy={glow.y}>
              <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity ?? 0.5} />
              <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#g${id})`} />
        {glow && <Rect width="100%" height="100%" fill={`url(#r${id})`} />}
      </Svg>
    </View>
  );
}

export const gradients = {
  ink: ['#26302A', '#121813', '#0B100C'],
  lime: ['#DBFF6B', '#C3F23A', '#A6DE1F'],
  limeSoft: ['#F7FFE0', '#EAF8C4'],
  page: ['#F7F8F4', '#EEF1EB'],
} as const;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** One orchestrated entrance: each section rises in shortly after the one before. */
export function Rise({ index, children, style }: { index: number; children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    Animated.timing(value, { toValue: 1, duration: 420, delay: 60 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, reduced, value]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Counts a number up to its value, so the headline figure arrives rather than appears. */
export function useCountUp(target: number, duration = 700) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) return;
    const start = Date.now();
    const begin = from.current;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(begin + (target - begin) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return reduced ? target : shown;
}
