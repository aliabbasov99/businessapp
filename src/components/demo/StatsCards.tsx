import { useDatabase } from '@/hooks/use-database';
import { getOverviewCards } from '@/data/overview';
import { useLocale } from '@/context/LocaleContext';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { Fonts, getColors } from '@/constants/theme';
import { AzerbaijaniManat, Building2, Package, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

function Metric({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRow}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={positive ? styles.trendUp : styles.trendDown}>{(positive ? '↑' : '↓') + ' ' + change}</Text>
      </View>
    </View>
  );
}

function StatCard({ title, icon, metrics }: { title: string; icon: React.ReactNode; metrics: { label: string; value: string; change: string; positive: boolean }[] }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.statCard}>
      <View style={styles.statHead}>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={styles.iconWrap}>{icon}</View>
      </View>
      {metrics.map((m, i) => (
        <Metric key={i} {...m} />
      ))}
    </View>
  );
}

export default function StatsCards() {
  useDatabase();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { locale } = useLocale();
  const icons = { dovriyye: AzerbaijaniManat, anbar: Package, techizatcilar: Building2, kassa: Wallet };
  const cards = getOverviewCards();
  return (
    <View style={styles.wrap}>
      {[cards.slice(0, 2), cards.slice(2)].map((row, index) => (
        <View key={index} style={[styles.row, index > 0 && { marginTop: 6 }]}>
          {row.map(card => {
            const Icon = icons[card.key];
            return <StatCard key={card.key} title={card.title} icon={<Icon size={16} color={colors.accent} />}
              metrics={[card.main, ...card.details].map(metric => ({
                label: metric.label, value: metric.unit === 'money' ? formatMoney(metric.value, locale) : formatNumber(metric.value, locale),
                change: formatPercent(metric.changePercent, locale), positive: metric.changePercent >= 0,
              }))} />;
          })}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingTop: 10 },
  row: { flexDirection: 'row', gap: 6 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  statTitle: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 14.3 },
  iconWrap: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  metric: { paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  metricLabel: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 9.8 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  metricValue: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 14.3 },
  trendUp: { color: colors.trendUp, fontFamily: Fonts.medium, fontSize: 11.7 },
  trendDown: { color: colors.trendDown, fontFamily: Fonts.medium, fontSize: 11.7 },
});
