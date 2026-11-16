import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPKR } from '../domain/money';
import { loadDashboard } from '../repo/dashboard';
import { getSetting } from '../repo/settings';
import { useApp, useData } from '../ui/context';
import { Banner, DirectionIcon, type IconName } from '../ui/controls';
import { Gradient, Rise, gradients, shadow, sheen, stroke, useCountUp } from '../ui/depth';
import { ModuleIcon, type ModuleIconName } from '../ui/icons';
import { T } from '../ui/text';
import { colors, radius, space, touch } from '../ui/theme';

const modules: { key: ModuleIconName; href: Href }[] = [
  { key: 'ada', href: '/ada' },
  { key: 'parties', href: '/parties' },
  { key: 'trips', href: '/trips' },
  { key: 'insurance', href: '/insurance' },
  { key: 'bills', href: '/bills' },
  { key: 'reports', href: '/reports' },
];

const quickAdd: { key: string; icon: IconName; href: Href }[] = [
  { key: 'ada', icon: 'notebook-edit-outline', href: '/ada/form' },
  { key: 'trip', icon: 'truck-fast-outline', href: '/trips/form' },
  { key: 'bill', icon: 'receipt-text-outline', href: '/bills/form' },
  { key: 'party', icon: 'account-plus-outline', href: '/parties/form' },
  { key: 'insurance', icon: 'shield-car', href: '/insurance/form' },
];

const BACKUP_REMINDER_DAYS = 7;

/**
 * The hero's one illustration: a road leaving the card's lower edge and climbing to a lit
 * destination pin, with the lane markings dashed down the middle. Every trip in the app is this.
 */
function RouteArt() {
  // Starts below the card's bottom edge, so the road comes into view rather than starting mid-air.
  const road = 'M 120 300 C 150 230, 170 150, 236 128 S 300 70, 312 34';
  return (
    <View pointerEvents="none" style={styles.routeArt}>
      <Svg width={320} height={300} viewBox="0 0 320 300">
        <Path d={road} stroke="#1E2721" strokeWidth={30} fill="none" strokeLinecap="round" />
        <Path d={road} stroke="#2B362E" strokeWidth={26} fill="none" strokeLinecap="round" />
        <Path d={road} stroke="#C6F432" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="10 12" fill="none" strokeLinecap="round" />
        <Circle cx={312} cy={34} r={22} fill="#C6F432" fillOpacity={0.12} />
        <Circle cx={312} cy={34} r={12} fill="#C6F432" fillOpacity={0.25} />
        <Circle cx={312} cy={34} r={6} fill="#C6F432" />
        <Circle cx={236} cy={128} r={4} fill="#FFFFFF" fillOpacity={0.6} />
      </Svg>
    </View>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export default function Home() {
  const { t, lang, setLang } = useApp();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const { data } = useData(async (db) => {
    const [dash, company, lastBackup, records] = await Promise.all([
      loadDashboard(db),
      getSetting(db, 'company_name'),
      getSetting(db, 'last_backup_at'),
      db.get<{ n: number }>(`SELECT (SELECT COUNT(*) FROM ada_entries) + (SELECT COUNT(*) FROM trip_legs) + (SELECT COUNT(*) FROM bills) AS n`),
    ]);
    const stale = !lastBackup || Date.now() - new Date(lastBackup).getTime() > BACKUP_REMINDER_DAYS * 86400000;
    return { dash, company, backupDue: stale && (records?.n ?? 0) > 0 };
  });
  const due = data?.dash.insuranceDue ?? 0;
  const profit = useCountUp(data?.dash.monthProfit ?? 0);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.pageWash}><Gradient colors={gradients.page} glow={{ color: '#D9F77A', x: 0.85, y: 0, r: 0.7, opacity: 0.35 }} /></View>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl * 2 }]} keyboardShouldPersistTaps="handled">
        {/* Top bar: company switcher pill, then round shortcuts. */}
        <Rise index={0} style={styles.topBar}>
          <View style={styles.companyPill}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.menu')} onPress={() => router.push('/settings')} style={styles.pillIcon}>
              <MaterialCommunityIcons name="menu" size={24} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings/company')} style={styles.pillName}>
              <T variant="heading" numberOfLines={1} style={styles.flex}>{data?.company || t('app.name')}</T>
              <MaterialCommunityIcons name="chevron-down" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <RoundButton label={t('home.alerts')} onPress={() => router.push('/insurance')}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.ink} />
            {due > 0 && <View style={styles.dot}><T variant="small" color={colors.white} style={styles.dotText}>{due}</T></View>}
          </RoundButton>
          <RoundButton label={t('home.language')} onPress={() => setLang(lang === 'ur' ? 'en' : 'ur')}>
            <T variant="label">{lang === 'ur' ? 'EN' : 'اردو'}</T>
          </RoundButton>
        </Rise>

        {/* Hero: the two numbers an owner checks first. */}
        <Rise index={1}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reports')} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
          <View style={styles.heroClip}>
            <Gradient colors={gradients.ink} direction="diagonal" glow={{ color: '#C6F432', x: 1, y: 0, r: 0.75, opacity: 0.22 }} />
            <RouteArt />
          </View>
          <View style={styles.heroChip}>
            <View style={styles.liveDot} />
            <T variant="small" color="#DDE3DA">{t('home.thisMonth')}</T>
          </View>
          <T variant="amountBig" color={colors.accent} style={styles.heroAmount}>{formatPKR(profit)}</T>
          <T variant="small" color="#9FA79D">{t('home.tripsCount', { count: data?.dash.monthTrips ?? 0 })}</T>
          <View style={styles.heroRow}>
            <View style={styles.flex}>
              <T variant="small" color="#B9BEB8">{t('home.brokersOwe')}</T>
              <T variant="amount" color={colors.white}>{formatPKR(data?.dash.outstanding ?? 0)}</T>
            </View>
            <View style={styles.heroCta}>
              <View style={styles.ctaFill}><Gradient colors={gradients.lime} /></View>
              <T variant="label" color={colors.ink}>{t('home.viewReports')}</T>
              <DirectionIcon direction="forward" color={colors.ink} size={20} />
            </View>
          </View>
        </Pressable>
        </Rise>

        {due > 0 && (
          <Banner
            icon="shield-alert-outline" tone="bad" onPress={() => router.push('/insurance')}
            text={`${due} ${t(due === 1 ? 'home.insuranceDue' : 'home.insuranceDuePlural')}`}
          />
        )}
        {data && !data.company?.trim() && (
          <Banner icon="domain" tone="info" text={t('home.companyMissing')} action={t('home.companyAdd')} onPress={() => router.push('/settings/company')} />
        )}
        {data?.backupDue && <Banner icon="cloud-upload-outline" tone="info" text={t('home.backupDue')} action={t('home.backupNow')} onPress={() => router.push('/settings/backup')} />}

        <Rise index={2} style={styles.section}>
        <View style={styles.sectionHead}>
          <T variant="title" style={styles.flex}>{t('home.khata')}</T>
          <Pressable accessibilityRole="search" onPress={() => router.push('/search')} style={styles.link}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.ink} />
            <T variant="label">{t('home.searchPlaceholder')}</T>
          </Pressable>
        </View>
        <View style={styles.gridCard}>
          {modules.map((m) => (
            <Pressable key={m.key} accessibilityRole="button" onPress={() => router.push(m.href)} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
              <View style={styles.tileIcon}>
                <ModuleIcon name={m.key} size={32} />
              </View>
              <T variant="label" center numberOfLines={2}>{t(`modules.${m.key}`)}</T>
            </Pressable>
          ))}
        </View>
        </Rise>

        <Rise index={3} style={styles.section}>
        <View style={styles.sectionHead}>
          <T variant="title" style={styles.flex}>{t('home.addNew')}</T>
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.link}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.ink} />
            <T variant="label">{t('home.more')}</T>
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <ActionCard label={t('add.ada')} icon="notebook-edit-outline" tone="accent" onPress={() => router.push('/ada/form')} />
          <ActionCard label={t('add.trip')} icon="truck-fast-outline" tone="dark" onPress={() => router.push('/trips/form')} />
        </View>
        </Rise>
      </ScrollView>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAdding(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.grabber} />
            <T variant="title">{t('home.quickAdd')}</T>
            {quickAdd.map((q) => (
              <Pressable key={q.key} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && styles.tilePressed]} onPress={() => { setAdding(false); router.push(q.href); }}>
                <View style={styles.tileIcon}><Gradient colors={gradients.limeSoft} direction="diagonal" /><MaterialCommunityIcons name={q.icon} size={24} color={colors.ink} /></View>
                <T variant="bodyStrong" style={styles.flex}>{t(`add.${q.key}`)}</T>
                <DirectionIcon direction="forward" color={colors.muted} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionCard({ label, icon, tone, onPress }: { label: string; icon: IconName; tone: 'accent' | 'dark'; onPress: () => void }) {
  const dark = tone === 'dark';
  const fg = dark ? colors.white : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.action, dark ? shadow.dark : shadow.float, { backgroundColor: dark ? colors.brand : colors.accent }, pressed && styles.pressed]}>
      <View style={styles.actionClip}>
        <Gradient colors={dark ? gradients.ink : gradients.lime} direction="diagonal"
          glow={dark ? { color: '#C6F432', x: 1, y: 1, r: 0.8, opacity: 0.2 } : { color: '#FFFFFF', x: 0.1, y: 0, r: 0.8, opacity: 0.5 }} />
      </View>
      <View style={styles.actionTop}>
        <View style={[styles.actionIcon, dark ? styles.actionIconDark : styles.actionIconLight]}>
          <MaterialCommunityIcons name={icon} size={26} color={fg} />
        </View>
        <DirectionIcon direction="forward" color={fg} size={26} />
      </View>
      <T variant="heading" color={fg} numberOfLines={2}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  flex: { flex: 1 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.975 }] },
  pageWash: { position: 'absolute', top: 0, start: 0, end: 0, height: 420 },
  body: { paddingHorizontal: space.lg, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  section: { gap: space.md },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  companyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: touch, backgroundColor: colors.card, borderRadius: radius.pill, paddingStart: space.xs, paddingEnd: space.md, ...stroke, ...shadow.card },
  pillIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pillName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  round: { width: touch, height: touch, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...stroke, ...shadow.card },
  dot: { position: 'absolute', top: 5, end: 5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.crimson, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  dotText: { fontSize: 10, lineHeight: 13 },

  hero: { backgroundColor: colors.brand, borderRadius: radius.xl, padding: space.xl, paddingBottom: space.lg, gap: 2, minHeight: 236, ...shadow.dark, ...sheen },
  heroClip: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: radius.xl, overflow: 'hidden' },
  routeArt: { position: 'absolute', end: -10, top: -6 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, boxShadow: '0 0 0 3px rgba(198,244,50,0.25)' },
  heroAmount: { fontSize: 40, lineHeight: 48, marginTop: space.md, letterSpacing: -0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.accent, borderRadius: radius.pill, paddingStart: space.lg, paddingEnd: space.sm, minHeight: 46, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', boxShadow: '0 6px 18px -6px rgba(198,244,50,0.55)' },
  ctaFill: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.card, ...stroke, ...shadow.card },

  gridCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: radius.xl, padding: space.md, rowGap: space.xs, ...stroke, ...shadow.raised },
  tile: { width: '33.333%', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs, borderRadius: radius.lg },
  tilePressed: { backgroundColor: '#F4F7EE', transform: [{ scale: 0.96 }] },
  tileIcon: {
    width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: '#F5F7F0', borderWidth: 1, borderColor: 'rgba(14,22,17,0.06)',
  },

  actionRow: { flexDirection: 'row', gap: space.md },
  action: { flex: 1, minHeight: 148, borderRadius: radius.xl, padding: space.lg, justifyContent: 'space-between', gap: space.md, ...sheen },
  actionClip: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: radius.xl, overflow: 'hidden' },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionIcon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  actionIconDark: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' },
  actionIconLight: { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.7)' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(14,20,17,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopStartRadius: radius.xl, borderTopEndRadius: radius.xl, padding: space.lg, gap: space.xs, ...shadow.raised },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: space.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 12, paddingHorizontal: space.xs, borderRadius: radius.md },
});
