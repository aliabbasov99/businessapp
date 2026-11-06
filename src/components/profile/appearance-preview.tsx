import { useDatabase } from '@/hooks/use-database';
import { getOverviewCards } from '@/data/overview';
import { getRecentSales, paymentLabel } from '@/data/queries';
import { formatMoney, formatPercent, formatTime } from '@/utils/format';
import { Activity, Bell, ChartNoAxesCombined, ChevronDown, Ellipsis, Eye, LayoutDashboard, ReceiptText, Sparkles } from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useTheme } from '@/context/ThemeContext';


export function AppearancePreview() {
  useDatabase();
  const RECEIPTS = getRecentSales(null, 6);
  const salesCard = getOverviewCards().find(card => card.key === 'dovriyye')!;

  const { colors } = useTheme();
  const { locale, t } = useLocale();
  const { initials } = usePreferences();
  return (
    <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.screenBg }]} accessibilityLabel={t('profile.appearance.caption')}>
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <View style={styles.row}>
          <Image source={require('@/assets/images/promar-logo-horizontal-white.png')} style={styles.logo} resizeMode="contain" />
          <View style={styles.actions}>
            <Bell size={15} color="#E0F1FF" /><Eye size={15} color="#E0F1FF" />
            <Text style={styles.avatar}>{initials}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.heading}>İcmal</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</Text>
        </View>
        <View style={[styles.row, styles.branch]}>
          <Text style={styles.branchText}>Bütün filiallar</Text><ChevronDown size={14} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.sales, { backgroundColor: colors.raised }]}>
          <Text style={[styles.bold, { color: colors.textPrimary }]}>Dövriyyə</Text>
          <Text style={[styles.small, { color: colors.textSecondary }]}>Satış</Text>
          <View style={styles.row}>
            <Text style={[styles.total, { color: colors.textPrimary }]}>{formatMoney(salesCard.main.value, locale)}</Text>
            <Text style={[styles.trend, { color: colors.trendDown, backgroundColor: colors.trendDownBg }]}>{formatPercent(salesCard.main.changePercent, locale, true)}</Text>
          </View>
          <View style={[styles.metrics, { borderColor: colors.border }]}>
            {salesCard.details.map(metric => (
              <View key={metric.label} style={styles.metric}>
                <Text style={[styles.small, { color: colors.textSecondary }]}>{metric.label}</Text>
                <Text style={[styles.bold, { color: colors.textPrimary }]}>{formatMoney(metric.value, locale)}</Text>
                <Text style={[styles.trend, { color: metric.changePercent >= 0 ? colors.trendUp : colors.trendDown, backgroundColor: metric.changePercent >= 0 ? colors.trendUpBg : colors.trendDownBg }]}>{formatPercent(metric.changePercent, locale, true)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={[styles.bold, { color: colors.textPrimary }]}>Son satışlar</Text>
        {RECEIPTS.map(sale => (
          <View key={sale.id} style={[styles.receipt, { backgroundColor: colors.white }]}>
            <ReceiptText size={16} color={colors.accent} />
            <View style={styles.receiptCopy}>
              <Text style={[styles.small, { color: colors.textPrimary }]}>Çek № {sale.receiptNumber}</Text>
              <Text style={[styles.small, { color: colors.textSecondary }]}>{formatTime(sale.occurredAt, locale)} · {t(paymentLabel(sale))}</Text>
            </View>
            <Text style={[styles.bold, { color: sale.amountMinor < 0 ? colors.trendDown : colors.textPrimary }]}>{formatMoney(sale.amountMinor, locale)}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.menu, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
        {[
          { Icon: LayoutDashboard, label: 'İcmal' }, { Icon: Activity, label: 'Hadisələr' },
          { Icon: Sparkles, label: 'AI' }, { Icon: ChartNoAxesCombined, label: 'Hesabatlar' },
          { Icon: Ellipsis, label: 'Daha çox' },
        ].map(({ Icon, label }, index) => (
          <View key={label} style={styles.menuCell}>
            <View style={[styles.menuItem, index === 0 && { backgroundColor: colors.identity }, index === 2 && styles.menuAi]}>
              <Icon size={index === 2 ? 13 : 16} color={index === 2 ? '#FFFFFF' : index === 0 ? colors.accent : colors.textMuted} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.menuLabel, { color: index === 2 ? '#FFFFFF' : index === 0 ? colors.accent : colors.textMuted }, index === 2 && styles.menuAiLabel]}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  header: { padding: 12, gap: 8 },
  logo: { width: 87, height: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#BDE4FF', color: '#054F96', fontSize: 10, textAlign: 'center', lineHeight: 24, fontFamily: Fonts.semibold },
  heading: { color: '#FFFFFF', fontSize: 20, fontFamily: Fonts.bold },
  date: { color: '#C6E3FB', fontSize: 10 },
  branch: { padding: 9, borderRadius: 7, backgroundColor: '#FFFFFF17' },
  branchText: { color: '#FFFFFF', fontSize: 11 },
  body: { padding: 9, gap: 8 },
  sales: { borderRadius: 10, padding: 12, gap: 6 },
  small: { fontSize: 10, fontFamily: Fonts.regular },
  bold: { fontFamily: Fonts.bold, fontSize: 11 },
  total: { fontFamily: Fonts.bold, fontSize: 23 },
  trend: { fontFamily: Fonts.medium, fontSize: 10, padding: 3, borderRadius: 5, alignSelf: 'flex-start' },
  metrics: { flexDirection: 'row', gap: 6, paddingTop: 6, borderTopWidth: 1 },
  metric: { flex: 1, gap: 4 },
  receipt: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, minHeight: 43, borderRadius: 8 },
  receiptCopy: { flex: 1, gap: 3 },
  menu: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 5, paddingTop: 8, paddingBottom: 12 },
  menuCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  menuItem: { width: '100%', minHeight: 40, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 5, borderRadius: 10 },
  menuAi: { width: 40, height: 40, marginTop: -8, borderRadius: 20, backgroundColor: '#0D6DBB', borderWidth: 1, borderColor: '#FFFFFFAA', gap: 0, shadowColor: '#054F96', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.24, shadowRadius: 7, elevation: 4 },
  menuAiLabel: { fontFamily: Fonts.bold, fontSize: 10, lineHeight: 12 },
  menuLabel: { fontSize: 8, fontFamily: Fonts.medium },
});
