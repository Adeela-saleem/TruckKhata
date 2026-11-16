import type { ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { hasUrdu } from '../i18n';
import { useApp } from './context';
import { colors, fonts } from './theme';

type Variant = 'body' | 'bodyStrong' | 'small' | 'label' | 'title' | 'heading' | 'amount' | 'amountBig';

/** Type scale: 13 / 15 / 16 / 18 / 22, with amounts set apart in heavier weights. */
const sizes: Record<Variant, { size: number; latin: string; urdu: string; tracking?: number }> = {
  body: { size: 15.5, latin: fonts.regular, urdu: fonts.urdu },
  bodyStrong: { size: 15.5, latin: fonts.semibold, urdu: fonts.urduBold },
  small: { size: 13.5, latin: fonts.regular, urdu: fonts.urdu },
  label: { size: 14.5, latin: fonts.medium, urdu: fonts.urdu },
  title: { size: 22, latin: fonts.heavy, urdu: fonts.urduBold, tracking: -0.5 },
  heading: { size: 17, latin: fonts.bold, urdu: fonts.urduBold, tracking: -0.2 },
  amount: { size: 17, latin: fonts.bold, urdu: fonts.bold, tracking: -0.2 },
  amountBig: { size: 28, latin: fonts.heavy, urdu: fonts.heavy, tracking: -0.8 },
};

const numeric = new Set<Variant>(['amount', 'amountBig']);

function plain(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plain).join('');
  return '';
}

/** Nastaliq sits far above and below its line, so it needs roughly double line height. */
export function typeStyle(variant: Variant, content: string, lang: 'en' | 'ur'): TextStyle {
  const spec = sizes[variant];
  const urdu = hasUrdu(content) || (content === '' && lang === 'ur');
  if (urdu && spec.urdu !== fonts.bold && spec.urdu !== fonts.heavy) {
    return { fontFamily: spec.urdu, fontSize: spec.size - 1, lineHeight: Math.round(spec.size * 2.1) };
  }
  // Same-width digits keep amounts lined up down a column.
  return {
    fontFamily: spec.latin, fontSize: spec.size, lineHeight: Math.round(spec.size * 1.32), letterSpacing: spec.tracking ?? 0,
    ...(numeric.has(variant) ? { fontVariant: ['tabular-nums' as const] } : {}),
  };
}

type Props = TextProps & { variant?: Variant; color?: string; center?: boolean; children?: ReactNode };

export function T({ variant = 'body', color = colors.ink, center, style, children, ...rest }: Props) {
  const { lang } = useApp();
  // Native mirrors "left" in right-to-left layouts; browsers need the actual side.
  const align = center ? 'center' : Platform.OS === 'web' && lang === 'ur' ? 'right' : 'left';
  return (
    <Text {...rest} style={[typeStyle(variant, plain(children), lang), { color, textAlign: align }, style]}>
      {children}
    </Text>
  );
}
