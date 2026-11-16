import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatPKR } from '../domain/money';
import type { IconName } from './controls';
import { Gradient, gradients, shadow, stroke } from './depth';
import { T } from './text';
import { colors, radius, space } from './theme';

/**
 * A list row: content on white, with an optional money strip along the bottom on a
 * faint tint, separated by a dashed rule like the tear line on a receipt.
 */
export function RowCard({ onPress, children, footer }: { onPress?: () => void; children: ReactNode; footer?: ReactNode }) {
  const body = (
    <>
      <View style={styles.rowBody}>{children}</View>
      {footer ? <View style={styles.rowFooter}>{footer}</View> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {body}
    </Pressable>
  );
}

/** Title on the start side, a status or amount on the end side. */
export function RowHead({ title, end, sub }: { title: string; end?: ReactNode; sub?: string | null }) {
  return (
    <View style={styles.head}>
      <View style={styles.flex}>
        <T variant="heading" numberOfLines={1}>{title}</T>
        {sub ? <T variant="small" color={colors.muted} numberOfLines={1}>{sub}</T> : null}
      </View>
      {end}
    </View>
  );
}

/** From and to as a short road: an open pin, a dashed line, a filled lime pin. */
export function RouteLine({ from, to, fromNote, toNote }: { from?: string | null; to?: string | null; fromNote?: string | null; toNote?: string | null }) {
  if (!from && !to) return null;
  return (
    <View style={styles.route}>
      <View style={styles.routeTrack}>
        <View style={styles.pinStart} />
        <View style={styles.dash} />
        <View style={styles.pinEnd} />
      </View>
      <View style={styles.routeLabels}>
        <View style={styles.flex}>
          <T variant="bodyStrong" numberOfLines={1}>{from || '—'}</T>
          {fromNote ? <T variant="small" color={colors.muted}>{fromNote}</T> : null}
        </View>
        <View style={[styles.flex, styles.alignEnd]}>
          <T variant="bodyStrong" numberOfLines={1}>{to || '—'}</T>
          {toNote ? <T variant="small" color={colors.muted}>{toNote}</T> : null}
        </View>
      </View>
    </View>
  );
}

export function MetaChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.chip}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.muted} />
      <T variant="small" color={colors.ink} numberOfLines={1}>{label}</T>
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** A pill for outward and return, with the direction drawn as an arrow. */
export function DirectionPill({ direction, label }: { direction: 'outward' | 'return'; label: string }) {
  const out = direction === 'outward';
  return (
    <View style={[styles.pill, out ? styles.pillOut : styles.pillBack]}>
      <MaterialCommunityIcons name={out ? 'arrow-top-right' : 'arrow-bottom-left'} size={14} color={out ? colors.ink : colors.amberInk} />
      <T variant="small" color={out ? colors.ink : colors.amberInk}>{label}</T>
    </View>
  );
}

/** How much of what is owed has come in. Full bar means settled. */
export function PayProgress({ due, received }: { due: number; received: number }) {
  const share = due > 0 ? Math.max(0, Math.min(1, received / due)) : received > 0 ? 1 : 0;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <View style={[styles.fill, { width: `${share * 100}%` }, share >= 1 && styles.fillDone]} />
    </View>
  );
}

type MoneyItem = { label: string; value: number; tone?: 'good' | 'bad' };

/** Two or three amounts side by side, the last one emphasised. */
export function MoneyStrip({ items }: { items: MoneyItem[] }) {
  return (
    <View style={styles.strip}>
      {items.map((m, i) => {
        const last = i === items.length - 1;
        const color = m.tone === 'good' ? colors.emerald : m.tone === 'bad' ? colors.crimson : colors.ink;
        return (
          <View key={m.label} style={[styles.stripItem, last && styles.alignEnd]}>
            <T variant="small" color={colors.muted} numberOfLines={1}>{m.label}</T>
            <T variant={last ? 'amount' : 'bodyStrong'} color={color} numberOfLines={1} style={styles.tabular}>{formatPKR(m.value)}</T>
          </View>
        );
      })}
    </View>
  );
}

/** Initials on the ink gradient, so each broker is recognisable at a glance. */
export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Gradient colors={gradients.ink} direction="diagonal" glow={{ color: '#C6F432', x: 1, y: 0, r: 0.9, opacity: 0.3 }} />
      <T variant="bodyStrong" color={colors.accent} style={{ fontSize: size * 0.36 }}>{initials}</T>
    </View>
  );
}

/** An icon in a small tinted square, for expense types and record kinds. */
export function IconWell({ icon, tone = 'lime', size = 42 }: { icon: IconName; tone?: 'lime' | 'red' | 'amber' | 'green' | 'grey'; size?: number }) {
  const bg = { lime: colors.accentSoft, red: colors.redBg, amber: colors.amberBg, green: colors.greenBg, grey: colors.autoBox }[tone];
  const fg = { lime: colors.ink, red: colors.crimson, amber: colors.amberInk, green: colors.emerald, grey: colors.muted }[tone];
  return (
    <View style={[styles.well, { width: size, height: size, backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={size * 0.52} color={fg} />
    </View>
  );
}

/** Details as a two-column grid of small label over value, instead of a long label: value list. */
export function InfoGrid({ items }: { items: { icon: IconName; label: string; value: string | null | undefined }[] }) {
  const shown = items.filter((i) => i.value);
  if (shown.length === 0) return null;
  return (
    <View style={styles.grid}>
      {shown.map((i) => (
        <View key={i.label} style={styles.gridItem}>
          <MaterialCommunityIcons name={i.icon} size={18} color={colors.muted} style={styles.gridIcon} />
          <View style={styles.flex}>
            <T variant="small" color={colors.muted} numberOfLines={1}>{i.label}</T>
            <T variant="bodyStrong" numberOfLines={2}>{i.value}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/** One line of a money breakdown; a total line gets a dashed rule above it. */
export function ReceiptLine({ label, value, sign, total, tone }: { label: string; value: number; sign?: '+' | '-'; total?: boolean; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? colors.emerald : tone === 'bad' ? colors.crimson : colors.ink;
  return (
    <View style={[styles.receiptLine, total && styles.receiptTotal]}>
      <T variant={total ? 'bodyStrong' : 'body'} color={total ? colors.ink : colors.muted} style={styles.flex}>{label}</T>
      <T variant={total ? 'amount' : 'bodyStrong'} color={color} style={styles.tabular}>{`${sign ? `${sign} ` : ''}${formatPKR(value)}`}</T>
    </View>
  );
}

/** Two short related fields on one line, such as From and To. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{(Array.isArray(children) ? children : [children]).map((c, i) => <View key={i} style={styles.flex}>{c}</View>)}</View>;
}

/** A titled white panel that groups related form fields. */
export function FormSection({ title, icon, children }: { title: string; icon?: IconName; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {icon && <IconWell icon={icon} size={32} />}
        <T variant="heading">{title}</T>
      </View>
      {children}
    </View>
  );
}

/** Rounded white panel for detail content. */
export function Panel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.panel}>
      {title ? <T variant="heading">{title}</T> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },

  row: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...stroke, ...shadow.card },
  rowPressed: { transform: [{ scale: 0.985 }], backgroundColor: '#FBFCFA' },
  rowBody: { padding: space.lg, gap: space.md },
  rowFooter: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, backgroundColor: '#F8F9F6', borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: 'rgba(14,22,17,0.14)' },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  route: { gap: 6 },
  routeTrack: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  pinStart: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card },
  dash: { flex: 1, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: 'rgba(14,22,17,0.25)', marginHorizontal: 4 },
  pinEnd: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 2.5, borderColor: colors.ink },
  routeLabels: { flexDirection: 'row', gap: space.md },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.autoBox, maxWidth: '100%' },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  pillOut: { backgroundColor: colors.accentSoft, borderColor: 'rgba(120,160,0,0.3)' },
  pillBack: { backgroundColor: colors.amberBg, borderColor: 'rgba(160,110,0,0.25)' },

  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(14,22,17,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.emerald },
  fillDone: { backgroundColor: colors.emerald },

  strip: { flexDirection: 'row', gap: space.md },
  stripItem: { flex: 1, gap: 1 },

  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.brand },
  well: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  gridItem: { width: '50%', flexDirection: 'row', gap: space.sm, paddingEnd: space.sm },
  gridIcon: { marginTop: 2 },

  receiptLine: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 5 },
  receiptTotal: { marginTop: space.xs, paddingTop: space.md, borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: 'rgba(14,22,17,0.2)' },

  // Bottom-aligned so the boxes line up even when one label wraps to two lines.
  fieldRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-end' },
  section: { backgroundColor: colors.card, borderRadius: radius.xl, padding: space.lg, gap: space.md, ...stroke, ...shadow.card },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 2 },
  panel: { backgroundColor: colors.card, borderRadius: radius.xl, padding: space.lg, gap: space.md, ...stroke, ...shadow.card },
});
