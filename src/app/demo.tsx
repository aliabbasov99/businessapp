import { useDatabase } from '@/hooks/use-database';
import { getCashTransactions, getEvents, getInventory, getNotifications, getRecentSales, getSuppliers, paymentLabel } from '@/data/queries';
import { createReports } from '@/data/reports';
import { formatMoney, formatNumber, formatTime } from '@/utils/format';
import { presentEvent } from '@/utils/event-presentation';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import {
  ArrowUpRight,
  Banknote,
  Bell,
  Building,
  ChevronDown,
  Eye,
  EyeOff,
  Landmark,
  Percent,
  ReceiptText,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, Pressable, StyleSheet, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reports } from '@/components/demo/Reports';
import { DataStatus } from '@/components/home/data-status';
import { AiAgentOverlay } from '@/components/home/ai-agent-overlay';
import { getBranchOptions, BranchSheet, type BranchId } from '@/components/home/branch-sheet';
import { HomeMenu, type HomeTab } from '@/components/home/home-menu';
import { NotificationsOverlay } from '@/components/home/notifications-overlay';
import { StatCarousel, type CardKey } from '@/components/home/stat-carousel';
import { usePreferences } from '@/context/PreferencesContext';
import { Fonts, getColors } from '@/constants/theme';

const TAB_TITLES: Record<HomeTab, string> = {
  icmal: 'İcmal',
  hadiseler: 'Hadisələr',
  hesabatlar: 'Hesabatlar',
};

type Tone = 'orange' | 'blue' | 'purple' | 'green';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  orange: { bg: '#FCF0DE', fg: '#B26B12' },
  blue: { bg: '#E4F0FD', fg: '#2B6CB0' },
  purple: { bg: '#EEE8FA', fg: '#6B46C1' },
  green: { bg: '#E2F4EA', fg: '#2F7D57' },
};

type CashKind = 'bankIn' | 'cashIn' | 'out';

const CASH_KINDS: Record<CashKind, { bg: string; fg: string; Icon: typeof Landmark }> = {
  bankIn: { bg: '#E4F0FD', fg: '#2B6CB0', Icon: Landmark },
  cashIn: { bg: '#E2F4EA', fg: '#2F7D57', Icon: Banknote },
  out: { bg: '#FCF0DE', fg: '#B26B12', Icon: ArrowUpRight },
};

export default function DemoScreen() {
  useDatabase();
  const styles = useThemedStyles(createStyles);
  const { colors, isDark } = useTheme();
  const { t, locale } = useLocale();
  const { preferences: { profile }, initials } = usePreferences();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<HomeTab>('icmal');
  const [privacy, setPrivacy] = useState(false);
  const [branch, setBranch] = useState<BranchId>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [unread, setUnread] = useState(() => getNotifications().filter(item => item.readAt === null).length);
  const [detailEvent, setDetailEvent] = useState<number | null>(null);
  const [reportPeriods, setReportPeriods] = useState(() => createReports().map(() => 0));

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  }, [locale]);

  const BRANCHES = getBranchOptions();
  const selectedBranch = BRANCHES.find(item => item.id === branch) ?? BRANCHES[0];
  const SALES = getRecentSales(branch, 8);
  const INVENTORY = getInventory(branch);
  const SUPPLIERS = getSuppliers();
  const CASH_FLOWS = getCashTransactions(branch);
  const EVENTS = getEvents(branch).filter(event => event.type !== 'daily_report_ready').map(event => ({
    id: event.id, ...presentEvent(event, locale, t),
  }));
  const selectedEvent = EVENTS.find(event => event.id === detailEvent);
  const unitLabels = { kg: 'kq', liter: 'lt', box: 'qt', piece: 'əd' };
  const toneNames: Tone[] = ['green', 'orange', 'blue', 'purple'];

  const renderList = (key: CardKey) => {
    switch (key) {
      case 'dovriyye':
        // Dövriyyə → son satışlar (çeklər)
        return (
          <View>
            <Text style={styles.sectionHeading}>Son satışlar</Text>
            <View style={styles.listCard}>
              {SALES.map((sale, index) => (
                <View
                  key={sale.id}
                  style={[styles.listRow, index === SALES.length - 1 && styles.listRowLast]}>
                  <View style={[styles.badge, { backgroundColor: colors.raised }]}>
                    <ReceiptText size={17} color={colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={styles.listCopy}>
                    <View style={styles.listLine}>
                      <Text style={styles.itemName} numberOfLines={1}>Çek № {sale.receiptNumber}</Text>
                      <Text style={[styles.amountText, sale.amountMinor < 0 && styles.amountNegative]}>
                        {privacy ? '••• ₼' : formatMoney(sale.amountMinor, locale)}
                      </Text>
                    </View>
                    <Text style={[styles.metaMuted, styles.listLineSub]}>
                      {formatTime(sale.occurredAt, locale)} · {t(paymentLabel(sale))}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );

      case 'anbar':
        // Anbar → məhsul qalıqları
        return (
          <View>
            <Text style={styles.sectionHeading}>Məhsul qalıqları</Text>
            <View style={styles.listCard}>
              {INVENTORY.map((item, index) => {
                const tone = TONES[toneNames[(item.id - 1) % toneNames.length]];
                return (
                  <View
                    key={item.id}
                    style={[styles.listRow, index === INVENTORY.length - 1 && styles.listRowLast]}>
                    <View style={[styles.badge, { backgroundColor: isDark ? colors.raised : tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{item.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.listCopy}>
                      <View style={styles.listLine}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.itemStrong}>{formatNumber(item.quantity, locale)} {unitLabels[item.unit]}</Text>
                      </View>
                      <View style={[styles.inventoryMeta, styles.listLineSub]}>
                        <Text style={styles.metaCode} numberOfLines={1} adjustsFontSizeToFit>{item.code}</Text>
                        <Text style={[styles.metaMuted, styles.inventoryPrice]} numberOfLines={1} adjustsFontSizeToFit>
                          Alış <Text style={styles.metaValue}>{formatMoney(item.costPriceMinor, locale)}</Text>
                        </Text>
                        <Text style={[styles.metaMuted, styles.inventoryPrice]} numberOfLines={1} adjustsFontSizeToFit>
                          Satış <Text style={styles.metaValue}>{formatMoney(item.salePriceMinor, locale)}</Text>
                        </Text>
                        <Text style={[styles.metaValue, styles.inventoryMetaAmount]} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(item.stockAmountMinor, locale)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );

      case 'techizatcilar':
        // Təchizatçılar → təchizatçı siyahısı
        return (
          <View>
            <Text style={styles.sectionHeading}>Təchizatçı siyahısı</Text>
            <View style={styles.listCard}>
              {SUPPLIERS.map((sup, index) => {
                const tone = TONES[toneNames[(sup.id - 1) % toneNames.length]];
                return (
                  <View
                    key={sup.id}
                    style={[styles.listRow, index === SUPPLIERS.length - 1 && styles.listRowLast]}>
                    <View style={[styles.badge, { backgroundColor: isDark ? colors.raised : tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{sup.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.listCopy}>
                      <View style={styles.listLine}>
                        <Text style={styles.itemName} numberOfLines={1}>{sup.name}</Text>
                        <Text style={[styles.amountText, sup.balanceMinor < 0 && styles.amountNegative]}>
                          {formatMoney(sup.balanceMinor, locale)}
                        </Text>
                      </View>
                      <View style={[styles.metaGroup, styles.listLineSub]}>
                        <Text style={styles.metaMuted}>
                          VÖEN: <Text style={styles.metaValue}>{sup.taxId}</Text>
                        </Text>
                        <Pressable
                          accessibilityRole="link"
                          accessibilityLabel={t(`Zəng et: ${sup.phone}`)}
                          onPress={() => Linking.openURL(`tel:${sup.phone.replace(/\s/g, '')}`)}>
                          <Text style={styles.phoneLink}>{sup.phone}</Text>
                        </Pressable>
                      </View>
                      <View style={[styles.metaGroup, styles.listLineSub]}>
                        <Text style={styles.metaMuted}>Depozit</Text>
                        <Text style={styles.metaValue}>{formatMoney(sup.depositMinor, locale)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );

      case 'kassa':
        // Kassa qalığı → son pul əməliyyatları
        return (
          <View>
            <Text style={styles.sectionHeading}>Son pul əməliyyatları</Text>
            <View style={styles.listCard}>
              {CASH_FLOWS.map((f, index) => {
                const kindKey: CashKind = f.amountMinor < 0 ? 'out' : f.account === 'bank' ? 'bankIn' : 'cashIn';
                const kind = CASH_KINDS[kindKey];
                return (
                  <View
                    key={f.id}
                    style={[styles.listRow, index === CASH_FLOWS.length - 1 && styles.listRowLast]}>
                    <View style={[styles.badge, { backgroundColor: isDark ? colors.raised : kind.bg }]}>
                      <kind.Icon size={17} color={kind.fg} strokeWidth={1.8} />
                    </View>
                    <View style={styles.listCopy}>
                      <View style={styles.listLine}>
                        <Text style={styles.itemName} numberOfLines={1}>{f.description}</Text>
                        <Text style={[styles.amountText, f.amountMinor < 0 && styles.amountNegative]}>
                          {formatMoney(f.amountMinor, locale)}
                        </Text>
                      </View>
                      <Text style={[styles.metaMuted, styles.listLineSub]}>{t(f.account === 'bank' ? 'Bank' : 'Kassa')} · {t(f.amountMinor < 0 ? 'Ödəniş' : 'Daxilolma')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Başlıq — İcmal */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Image
            source={require('@/assets/images/promar-logo-horizontal-white.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="PROMAR"
          />

          <View style={styles.hdActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(unread > 0 ? `Bildirişlər · ${unread} yeni` : 'Bildirişlər')}
              style={({ pressed }) => [styles.hdButton, pressed && styles.pressed]}
              onPress={() => setNotificationsOpen(true)}>
              <Bell size={18} color="#E0F1FF" strokeWidth={1.8} />
              {unread > 0 ? <View style={styles.unreadDot} /> : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(privacy ? 'Rəqəmləri göstər' : 'Rəqəmləri gizlət')}
              accessibilityState={{ selected: privacy }}
              style={({ pressed }) => [styles.hdButton, pressed && styles.pressed]}
              onPress={() => setPrivacy(v => !v)}>
              {privacy ? (
                <EyeOff size={18} color="#E0F1FF" strokeWidth={1.8} />
              ) : (
                <Eye size={18} color="#E0F1FF" strokeWidth={1.8} />
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${profile.name} · ${t('profile.title')}`}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
              onPress={() => router.push('/profile')}>
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hdHeading}>
          <Text style={styles.hdTitle}>{TAB_TITLES[tab]}</Text>
          <Text style={styles.hdDate}>{dateLabel}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: sheetOpen }}
          accessibilityLabel={`${t('Filial seçimi')}: ${t(selectedBranch.title)}`}
          style={({ pressed }) => [styles.branchTrigger, pressed && styles.pressed]}
          onPress={() => setSheetOpen(true)}>
          <View style={styles.branchIcon}>
            <Building size={22} color="#CBE8FF" strokeWidth={1.7} />
          </View>
          <View style={styles.branchCopy}>
            <Text style={styles.branchStrong}>{selectedBranch.title}</Text>
          </View>
          <View style={[styles.branchChevron, sheetOpen && styles.branchChevronOpen]}>
            <ChevronDown size={16} color="#DEEFFF" strokeWidth={2} />
          </View>
        </Pressable>
      </View>

      {/* Məzmun */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <DataStatus />
        {tab === 'icmal' ? (
          <>
            <StatCarousel privacy={privacy} renderList={renderList} />
          </>
        ) : null}

        {tab === 'hadiseler' ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Son əməliyyatlar</Text>
            {EVENTS.map(event => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={t(event.title)}
                style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                onPress={() => setDetailEvent(current => (current === event.id ? null : event.id))}>
                <View style={styles.eventIcon}>
                  {event.icon === 'receipt' ? <ReceiptText size={17} color={colors.accent} strokeWidth={1.8} /> : <Percent size={17} color={colors.accent} strokeWidth={1.8} />}
                </View>
                <View style={styles.eventCopy}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventSub}>{event.sub}</Text>
                </View>
                <Text style={styles.eventAmount}>{event.amount}</Text>
              </Pressable>
            ))}
            {selectedEvent ? (
              <View style={styles.detailBox}>
                <Text style={styles.detailText}>{selectedEvent.detail}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'hesabatlar' ? (
          <Reports
            branch={branch}
            privacy={privacy}
            periods={reportPeriods}
            onPeriodChange={(index, period) => setReportPeriods(current => current.map((value, i) => i === index ? period : value))}
          />
        ) : null}
      </ScrollView>

      {/* Alt menyu */}
      <HomeMenu
        active={tab}
        onTabPress={setTab}
        onAiPress={() => setAiOpen(true)}
      />

      <BranchSheet
        visible={sheetOpen}
        selected={branch}
        onSelect={setBranch}
        onClose={() => setSheetOpen(false)}
      />
      <NotificationsOverlay
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadChange={setUnread}
      />
      <AiAgentOverlay
        visible={aiOpen}
        branchLabel={selectedBranch.title}
        onClose={() => setAiOpen(false)}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  header: {
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  logo: {
    width: 118,
    height: 19,
  },
  hdActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hdButton: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7FC2FA',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C9E7FF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.accent,
  },
  hdHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    marginBottom: 13,
  },
  hdTitle: {
    fontFamily: Fonts.bold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  hdDate: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#C6E3FB',
  },
  branchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 63,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  branchIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  branchCopy: {
    flex: 1,
    minWidth: 0,
  },
  branchSmall: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#C6E2FA',
    marginBottom: 2,
  },
  branchStrong: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: '#FFFFFF',
  },
  branchChevron: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  branchChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  body: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  bodyContent: {
    paddingTop: 14,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#054F96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHeading: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowDivider: {
    marginTop: 16,
  },
  rowLabel: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  rowValue: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inventoryItem: {
    paddingTop: 2,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inventoryItemLast: {
    borderBottomWidth: 0,
  },
  inventoryItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inventoryCodeBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inventoryCode: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  inventoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  inventoryName: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inventoryStock: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  inventoryAmount: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  eventSub: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  eventAmount: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  detailBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    marginTop: 12,
  },
  detailText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  sectionHeading: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginHorizontal: 18,
    marginBottom: 8,
  },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 12,
    marginHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#054F96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
  },
  listLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listLineSub: {
    marginTop: 5,
  },
  itemName: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  itemStrong: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  amountText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  amountNegative: {
    color: colors.trendDown,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 14,
  },
  metaCode: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1.6,
    minWidth: 0,
  },
  inventoryMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  inventoryPrice: {
    flex: 1,
    minWidth: 0,
  },
  inventoryMetaAmount: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  metaMuted: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  metaValue: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: colors.textPrimary,
  },
  phoneLink: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
