import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { monthRange, today, weekRange, type DateRange } from '../domain/dates';
import { useApp } from './context';
import { Chips, DateField, DirectionIcon, goBack, type IconName } from './controls';
import { T } from './text';
import { shadow, stroke } from './depth';
import { colors, radius, space } from './theme';

export type HeaderAction = { icon: IconName; label: string; onPress: () => void };

export function Header({ title, subtitle, actions = [] }: { title: string; subtitle?: string; actions?: HeaderAction[] }) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('actions.back')} onPress={goBack} style={({ pressed }) => [styles.headerButton, pressed && styles.headerPressed]}>
        <DirectionIcon direction="back" color={colors.ink} size={28} />
      </Pressable>
      <View style={styles.headerText}>
        {subtitle ? <T variant="small" color={colors.muted} numberOfLines={1}>{subtitle}</T> : null}
        <T variant="title" numberOfLines={1}>{title}</T>
      </View>
      {actions.map((a) => (
        <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} style={({ pressed }) => [styles.headerButton, pressed && styles.headerPressed]}>
          <MaterialCommunityIcons name={a.icon} size={22} color={colors.ink} />
        </Pressable>
      ))}
    </View>
  );
}

/** `sectioned` tells a form screen that it groups its own fields; otherwise a form's fields share one white panel. */
type ScreenProps = { title: string; subtitle?: string; actions?: HeaderAction[]; children: ReactNode; footer?: ReactNode; sectioned?: boolean };

export function Screen({ title, subtitle, actions, children, footer, sectioned }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={title} subtitle={subtitle} actions={actions} />
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {footer && !sectioned ? <View style={styles.formPanel}>{children}</View> : children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

type ListProps<I> = ScreenProps & {
  data: readonly I[]; renderItem: ListRenderItem<I>; keyExtractor: (item: I) => string; empty: ReactNode; overlay?: ReactNode;
};

export function ListScreen<I>({ title, subtitle, actions, children, data, renderItem, keyExtractor, empty, overlay }: ListProps<I>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Header title={title} subtitle={subtitle} actions={actions} />
      <FlatList
        style={styles.root}
        data={data as I[]} renderItem={renderItem} keyExtractor={keyExtractor} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={styles.listHead}>{children}</View>}
        ListEmptyComponent={<View>{empty}</View>}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
      />
      {overlay}
    </View>
  );
}

export function FilterPanel({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.filters}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.filterToggle}>
        <MaterialCommunityIcons name="tune-variant" size={20} color={colors.ink} />
        <T variant="label" style={{ flex: 1 }}>{t('actions.filters')}</T>
        {activeCount > 0 && <View style={styles.filterCount}><T variant="small" color={colors.ink}>{activeCount}</T></View>}
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
      </Pressable>
      {open && <View style={styles.filterBody}>{children}</View>}
    </View>
  );
}

export type RangeChoice = 'all' | 'week' | 'month' | 'custom';

export function rangeFor(choice: RangeChoice, custom: DateRange): DateRange {
  if (choice === 'week') return weekRange(today());
  if (choice === 'month') return monthRange(today());
  if (choice === 'custom') return custom;
  return { from: null, to: null };
}

export function RangePicker({ choice, onChoice, custom, onCustom, options = ['all', 'week', 'month', 'custom'] }: {
  choice: RangeChoice; onChoice: (c: RangeChoice) => void; custom: DateRange; onCustom: (r: DateRange) => void; options?: RangeChoice[];
}) {
  const { t } = useApp();
  return (
    <View style={styles.rangeBox}>
      <Chips label={t('range.label')} value={choice} onChange={onChoice} options={options.map((o) => ({ value: o, label: t(`range.${o}`) }))} />
      {choice === 'custom' && (
        <>
          <DateField allowClear label={t('range.from')} value={custom.from} onChange={(from) => onCustom({ ...custom, from })} />
          <DateField allowClear label={t('range.to')} value={custom.to} onChange={(to) => onCustom({ ...custom, to })} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  header: { backgroundColor: colors.page, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.md, paddingHorizontal: space.lg },
  headerText: { flex: 1, paddingHorizontal: space.xs },
  headerButton: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...stroke, ...shadow.card },
  headerPressed: { backgroundColor: colors.autoBox },
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.card, borderTopStartRadius: radius.xl, borderTopEndRadius: radius.xl, ...stroke, boxShadow: '0 -8px 24px -12px rgba(14,22,17,0.18)' },
  listHead: { gap: space.md, marginBottom: space.md },
  listContent: { padding: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  filters: { backgroundColor: colors.card, borderRadius: radius.lg, ...stroke, ...shadow.card },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.lg },
  filterCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  filterBody: { padding: space.md, paddingTop: 0, gap: space.md },
  rangeBox: { gap: space.md },
  formPanel: { backgroundColor: colors.card, borderRadius: radius.xl, padding: space.lg, gap: space.md, ...stroke, ...shadow.card },
});
