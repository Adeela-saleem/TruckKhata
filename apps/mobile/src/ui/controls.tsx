import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { formatDate, parseISODate, today, toISODate } from '../domain/dates';
import { useApp } from './context';
import { T, typeStyle } from './text';
import { Gradient, gradients, shadow, sheen, stroke } from './depth';
import { colors, fonts, radius, space, touch } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ButtonProps = { label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'plain' | 'quiet'; icon?: IconName; disabled?: boolean };

export function Button({ label, onPress, tone = 'primary', icon, disabled }: ButtonProps) {
  const fg = tone === 'primary' || tone === 'danger' ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[tone], pressed && styles.pressed, disabled && styles.disabled]}
    >
      {tone === 'primary' && <Gradient colors={gradients.ink} glow={{ color: '#C6F432', x: 0.5, y: 1.4, r: 0.9, opacity: 0.18 }} />}
      {icon && <MaterialCommunityIcons name={icon} size={22} color={fg} />}
      <T variant="bodyStrong" color={fg} center style={styles.buttonLabel}>{label}</T>
    </Pressable>
  );
}

type FieldProps = {
  label: string; value: string; onChange: (text: string) => void; keyboard?: KeyboardTypeOptions; placeholder?: string;
  multiline?: boolean; hint?: string; required?: boolean; caps?: boolean; onBlur?: () => void; testID?: string;
};

export function Field({ label, value, onChange, keyboard, placeholder, multiline, hint, required, caps, onBlur, testID }: FieldProps) {
  const { lang } = useApp();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <T variant="label">{label}{required ? ' *' : ''}</T>
      <TextInput
        accessibilityLabel={label} testID={testID} value={value} onChangeText={onChange}
        onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur?.(); }}
        keyboardType={keyboard} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline}
        autoCapitalize={caps ? 'characters' : 'sentences'} autoCorrect={false}
        style={[styles.input, typeStyle('body', value || placeholder || '', value ? 'en' : lang), multiline && styles.multiline, focused && styles.inputFocused]}
      />
      {hint ? <T variant="small" color={colors.muted}>{hint}</T> : null}
    </View>
  );
}

export function MoneyField(props: Omit<FieldProps, 'keyboard'>) {
  return <Field {...props} keyboard="decimal-pad" placeholder="0" />;
}

/** Text box that suggests earlier values, so names stay spelled the same way. */
export function SuggestField({ suggestions, ...props }: FieldProps & { suggestions: readonly string[] }) {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const term = props.value.trim().toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(term) && s.toLowerCase() !== term).slice(0, 4);
  }, [props.value, suggestions]);
  return (
    <View onTouchStart={() => setFocused(true)} onPointerDown={() => setFocused(true)}>
      <Field {...props} />
      {focused && matches.length > 0 && (
        <View style={styles.suggestions}>
          {matches.map((m) => (
            <Pressable key={m} accessibilityRole="button" style={styles.suggestion} onPress={() => { props.onChange(m); setFocused(false); }}>
              <T>{m}</T>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Calculated values look different from anything the user can type in. */
export function AutoBox({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const { t } = useApp();
  return (
    <View style={styles.autoBox}>
      <Gradient colors={['#F6F8F2', '#EBEFE5']} />
      <View style={styles.autoText}>
        <T variant="label" color={colors.muted}>{label}</T>
        <T variant="small" color={colors.muted}>{t('auto')}</T>
      </View>
      <T variant="amount" color={tone === 'good' ? colors.emerald : tone === 'bad' ? colors.crimson : colors.ink}>{value}</T>
    </View>
  );
}

export function Chips<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V | null; onChange: (v: V) => void; label?: string }) {
  return (
    <View style={styles.field}>
      {label ? <T variant="label">{label}</T> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
              {on && <Gradient colors={gradients.ink} />}
              <T variant="label" color={on ? colors.white : colors.ink}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggle}>
      <MaterialCommunityIcons name={value ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28} color={value ? colors.brand : colors.muted} />
      <View style={styles.flex}>
        <T variant="label">{label}</T>
        {hint ? <T variant="small" color={colors.muted}>{hint}</T> : null}
      </View>
    </Pressable>
  );
}

function monthDays(month: Date): (string | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
}

export function DateField({ label, value, onChange, required, allowClear }: { label: string; value: string | null; onChange: (date: string | null) => void; required?: boolean; allowClear?: boolean }) {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseISODate(value ?? today()));
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const title = month.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric' });
  return (
    <View style={styles.field}>
      <T variant="label">{label}{required ? ' *' : ''}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.dateButton} onPress={() => { setMonth(parseISODate(value ?? today())); setOpen(true); }}>
        <MaterialCommunityIcons name="calendar-month" size={24} color={colors.brand} />
        <Text style={styles.dateText}>{value ? formatDate(value) : '--/--/----'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.calendar}>
            <View style={styles.calendarHead}>
              <Pressable accessibilityRole="button" accessibilityLabel="previous month" style={styles.calendarArrow} onPress={() => shift(-1)}>
                <DirectionIcon direction="back" />
              </Pressable>
              <T variant="heading" center style={styles.flex}>{title}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="next month" style={styles.calendarArrow} onPress={() => shift(1)}>
                <DirectionIcon direction="forward" />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {monthDays(month).map((day, i) => (
                <View key={day ?? `blank${i}`} style={styles.dayCell}>
                  {day && (
                    <Pressable accessibilityRole="button" accessibilityLabel={formatDate(day)} style={[styles.day, day === value && styles.dayOn, day === today() && day !== value && styles.dayToday]} onPress={() => { onChange(day); setOpen(false); }}>
                      <Text style={[styles.dayText, day === value && { color: colors.white }]}>{Number(day.slice(8))}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            {allowClear && !required && <Button label={t('actions.clear')} tone="plain" onPress={() => { onChange(null); setOpen(false); }} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Points the way the layout reads, in both English and Urdu. */
export function DirectionIcon({ direction, color = colors.ink, size = 28 }: { direction: 'back' | 'forward'; color?: string; size?: number }) {
  const { isRTL } = useApp();
  const pointsLeft = (direction === 'back') !== isRTL;
  return <MaterialCommunityIcons name={pointsLeft ? 'chevron-left' : 'chevron-right'} size={size} color={color} />;
}

export function Card({ children, onPress, accent }: { children: ReactNode; onPress?: () => void; accent?: string }) {
  const body = <>{accent && <View style={[styles.accent, { backgroundColor: accent }]} />}<View style={styles.cardBody}>{children}</View></>;
  if (!onPress) return <View style={styles.card}>{body}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}>{body}</Pressable>;
}

export function Line({ label, value, tone, strong }: { label: string; value: ReactNode; tone?: 'good' | 'bad'; strong?: boolean }) {
  const color = tone === 'good' ? colors.emerald : tone === 'bad' ? colors.crimson : colors.ink;
  return (
    <View style={styles.line}>
      <T variant="small" color={colors.muted} style={styles.lineLabel}>{label}</T>
      <T variant={strong ? 'bodyStrong' : 'body'} color={color} style={styles.lineValue}>{value}</T>
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' | 'info' }) {
  const palette = {
    good: [colors.greenBg, colors.emerald], warn: [colors.amberBg, colors.amberInk], bad: [colors.redBg, colors.crimson], info: [colors.autoBox, colors.ink],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <T variant="small" color={palette[1]} style={styles.badgeText}>{label}</T>
    </View>
  );
}

export function Banner({ text, tone = 'warn', icon = 'alert', onPress, action }: { text: string; tone?: 'warn' | 'bad' | 'info'; icon?: IconName; onPress?: () => void; action?: string }) {
  const well = tone === 'bad' ? colors.redBg : tone === 'info' ? colors.accentSoft : colors.amberBg;
  const fg = tone === 'bad' ? colors.crimson : tone === 'info' ? colors.ink : colors.amberInk;
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.banner, tone === 'bad' && styles.bannerBad, pressed && styles.pressed]}>
      <View style={[styles.bannerWell, { backgroundColor: well }]}><MaterialCommunityIcons name={icon} size={22} color={fg} /></View>
      <View style={[styles.flex, { gap: 2 }]}>
        <T variant={action ? 'small' : 'body'} color={colors.ink}>{text}</T>
        {action ? <T variant="bodyStrong" color={tone === 'bad' ? colors.crimson : colors.ink}>{action}</T> : null}
      </View>
      {onPress && <View style={styles.bannerGo}><DirectionIcon direction="forward" color={colors.ink} size={20} /></View>}
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <T variant="heading" style={styles.flex}>{title}</T>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionAction}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.ink} />
          <T variant="label" color={colors.ink}>{action}</T>
        </Pressable>
      )}
    </View>
  );
}

export function Empty({ title, hint, icon = 'text-box-outline' }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyWell}>
        <Gradient colors={gradients.limeSoft} direction="diagonal" />
        <MaterialCommunityIcons name={icon} size={36} color={colors.ink} />
      </View>
      <T variant="heading" center>{title}</T>
      {hint ? <T center color={colors.muted}>{hint}</T> : null}
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  const { lang } = useApp();
  return (
    <View style={styles.search}>
      <MaterialCommunityIcons name="magnify" size={24} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} autoCorrect={false}
        style={[styles.searchInput, typeStyle('body', value || placeholder, value ? 'en' : lang)]}
      />
      {value !== '' && (
        <Pressable accessibilityRole="button" accessibilityLabel="clear" onPress={() => onChange('')} style={styles.searchClear}>
          <MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
      <View style={styles.fabFill}><Gradient colors={gradients.lime} glow={{ color: '#FFFFFF', x: 0.3, y: 0, r: 0.8, opacity: 0.55 }} /></View>
      <View style={styles.fabPlus}><MaterialCommunityIcons name="plus" size={22} color={colors.accent} /></View>
      <T variant="heading" color={colors.ink}>{label}</T>
    </Pressable>
  );
}

type SummaryTone = 'good' | 'bad' | 'muted';
type SummaryRow = { label: string; value: string; tone?: SummaryTone };

/**
 * The money total for a screen, on the same dark surface as the home hero, so the figure
 * that matters reads first. Rows sit above; the headline amount closes the card.
 */
export function SummaryCard({ rows, headline, children }: { rows: SummaryRow[]; headline?: SummaryRow; children?: ReactNode }) {
  const tint = (tone?: SummaryTone) => (tone === 'good' ? '#8BE3B0' : tone === 'bad' ? '#FF9AA2' : tone === 'muted' ? '#9FA79D' : colors.white);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryClip}>
        <Gradient colors={gradients.ink} direction="diagonal" glow={{ color: '#C6F432', x: 1, y: 0, r: 0.7, opacity: 0.16 }} />
      </View>
      {rows.map((r, i) => (
        <View key={`${i}${r.label}`} style={styles.line}>
          <T variant="small" color="#AEB5AC" style={styles.lineLabel}>{r.label}</T>
          <T variant="bodyStrong" color={tint(r.tone)} style={styles.lineValue}>{r.value}</T>
        </View>
      ))}
      {headline && (
        <View style={[styles.summaryHead, rows.length > 0 && styles.summaryDivider]}>
          <T variant="label" color="#DDE3DA" style={styles.lineLabel}>{headline.label}</T>
          <T variant="amountBig" color={headline.tone ? tint(headline.tone) : colors.accent}>{headline.value}</T>
        </View>
      )}
      {children}
    </View>
  );
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const surface = { backgroundColor: colors.card, borderRadius: radius.md };
// Fields sit inside white form sections, so they are a shade darker than the panel they are on.
const box = { minHeight: touch, backgroundColor: '#F6F7F3', borderWidth: 1, borderColor: 'rgba(14,22,17,0.10)', borderRadius: radius.md, paddingHorizontal: space.md };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { borderRadius: radius.xl, paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.sm, backgroundColor: colors.brand, ...shadow.dark, ...sheen },
  summaryClip: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: radius.xl, overflow: 'hidden' },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  summaryDivider: { marginTop: space.xs, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)' },
  button: { minHeight: touch, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, overflow: 'hidden' },
  buttonLabel: { flexShrink: 1 },
  primary: { backgroundColor: colors.brand, ...shadow.dark, ...sheen },
  danger: { backgroundColor: colors.crimson, boxShadow: '0 2px 6px rgba(160,20,40,0.25), 0 14px 28px -12px rgba(160,20,40,0.5)' },
  plain: { backgroundColor: colors.card, ...stroke, ...shadow.card },
  quiet: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: 'rgba(120,160,0,0.18)' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
  field: { gap: 6 },
  input: { ...box, color: colors.ink },
  // outlineWidth removes the browser's own focus ring in the web preview; the lime ring replaces it.
  inputFocused: { backgroundColor: colors.card, borderColor: colors.ink, boxShadow: '0 0 0 4px rgba(198,244,50,0.45)', outlineWidth: 0 },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  suggestions: { ...surface, borderWidth: 1.5, borderColor: colors.line, marginTop: space.xs, overflow: 'hidden' },
  suggestion: { minHeight: 46, paddingHorizontal: space.md, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  autoBox: { backgroundColor: colors.autoBox, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(14,22,17,0.05)', borderStyle: 'dashed', borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  autoText: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 42, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.card, ...stroke, ...shadow.card, justifyContent: 'center', overflow: 'hidden' },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand, ...shadow.dark },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44, paddingVertical: space.xs },
  dateButton: { ...box, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateText: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(18,20,18,0.5)', justifyContent: 'center', padding: space.lg },
  calendar: { backgroundColor: colors.card, ...shadow.raised, borderRadius: radius.xl, padding: space.lg, gap: space.sm, maxWidth: 420, width: '100%', alignSelf: 'center' },
  calendarHead: { flexDirection: 'row', alignItems: 'center' },
  calendarArrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.brand, ...shadow.dark },
  dayToday: { backgroundColor: colors.accentSoft },
  dayText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, flexDirection: 'row', ...stroke, ...shadow.card },
  pressedCard: { backgroundColor: '#FAFBF8', transform: [{ scale: 0.99 }] },
  // A short status mark at the start edge instead of a full-height stripe.
  accent: { width: 4, borderRadius: 2, marginVertical: space.lg, marginStart: space.md },
  cardBody: { flex: 1, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  lineLabel: { flexShrink: 1 },
  lineValue: { flexShrink: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 2, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(14,22,17,0.06)' },
  badgeText: {},
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingEnd: space.md, borderRadius: radius.lg, backgroundColor: colors.card, ...stroke, ...shadow.card },
  bannerBad: { borderColor: 'rgba(211,38,58,0.25)', backgroundColor: '#FFF8F8' },
  bannerWell: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bannerGo: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.autoBox, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, minHeight: 44 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.card, ...stroke, ...shadow.card },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: space.xl, gap: space.sm },
  emptyWell: {
    width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: space.sm,
    borderWidth: 1, borderColor: 'rgba(120,160,0,0.22)', boxShadow: '0 10px 24px -12px rgba(90,130,0,0.5)',
  },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, ...stroke, ...shadow.card, borderRadius: radius.pill, paddingHorizontal: space.lg, minHeight: touch, gap: space.sm },
  searchInput: { flex: 1, minHeight: touch - 4, color: colors.ink },
  searchClear: { padding: space.xs },
  fab: {
    position: 'absolute', bottom: 24, end: 16, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.accent,
    paddingStart: space.sm, paddingEnd: space.xl, minHeight: 60, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(90,120,0,0.35)', ...shadow.float,
  },
  fabFill: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: radius.pill, overflow: 'hidden' },
  fabPlus: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
