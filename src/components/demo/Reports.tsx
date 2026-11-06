import { useDatabase } from '@/hooks/use-database';
import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { createReports, REPORT_PERIOD_LABELS, REPORT_PERIODS } from '@/data/reports';
import type { BranchSelection } from '@/data/schema';
import { formatMoney, formatPercent } from '@/utils/format';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import LineChartBase from './LineChartBase';

type Report = ReturnType<typeof createReports>[number];

function ReportCard({ report, period, privacy, onPeriodChange }: {
  report: Report;
  period: number;
  privacy: boolean;
  onPeriodChange: (period: number) => void;
}) {
  const { colors, isDark } = useTheme();
  const { t, locale } = useLocale();
  const [compact, setCompact] = useState(false);
  const gradientId = `report${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { total, change } = report.summaries[period];
  const trend = formatPercent(change, locale, true);
  const trendColor = change > 0 ? colors.trendUp : change < 0 ? colors.trendDown : colors.textMuted;
  const trendBackground = change > 0 ? colors.trendUpBg : change < 0 ? colors.trendDownBg : colors.raised;

  return (
    <View
      onLayout={event => setCompact(event.nativeEvent.layout.width <= 310)}
      style={[styles.card, { borderColor: isDark ? colors.border : '#D3E4F4', backgroundColor: colors.identity }]}>
      <View style={styles.cardClip}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="50%">
                <Stop offset="0%" stopColor={isDark ? '#20364F' : '#F0F7FF'} />
                <Stop offset="100%" stopColor={isDark ? '#192B42' : '#E0EDFC'} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>
        </View>

        <View style={[styles.summary, compact && styles.summaryCompact]}>
          <View pointerEvents="none" style={[styles.ring, styles.ringTop]} />
          <View pointerEvents="none" style={[styles.ring, styles.ringBottom, { borderColor: isDark ? '#8ABEF012' : '#FFFFFF70' }]} />
          <View style={styles.headingRow}>
            <Text style={[styles.title, { color: colors.accent }]}>{report.title}</Text>
            <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>{[report.scopeLabel && t(report.scopeLabel), t(REPORT_PERIOD_LABELS[period])].filter(Boolean).join(' · ')}</Text>
          </View>
          <View style={styles.valueRow}>
            <Text
              style={[styles.total, { color: colors.textPrimary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}>
              {privacy ? '••• ₼' : formatMoney(Math.round(total * 100), locale)}
            </Text>
            <View style={[styles.trend, { backgroundColor: trendBackground, borderColor: isDark ? colors.border : change > 0 ? '#D0EADD' : change < 0 ? '#F7DCDA' : '#E0E8EF' }]}>
              <Text style={[styles.trendText, { color: trendColor }]}>{privacy ? '•••' : trend}</Text>
            </View>
          </View>

          <View style={[styles.periods, { backgroundColor: isDark ? '#101F338F' : '#FFFFFF78', borderColor: isDark ? colors.border : '#FFFFFFA6' }]}>
            {REPORT_PERIODS.map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={`${t(report.title)} · ${t(label)}`}
                accessibilityState={{ selected: period === i }}
                onPress={() => onPeriodChange(i)}
                style={({ pressed }) => [styles.periodButton, period === i && { backgroundColor: isDark ? '#2162A1' : '#054F96' }, pressed && styles.pressed]}>
                <Text style={[styles.periodText, { color: period === i ? '#FFFFFF' : colors.textSecondary }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.plot, compact && styles.plotCompact, { backgroundColor: isDark ? colors.white : '#FFFFFFEB', borderColor: isDark ? colors.border : '#FFFFFF' }]}>
          <LineChartBase title={report.chartTitle} showTitle={false} bare period={period} data={report.data} privacy={privacy} />
        </View>
      </View>
    </View>
  );
}

export function Reports({ branch, privacy, periods, onPeriodChange }: {
  branch: BranchSelection;
  privacy: boolean;
  periods: number[];
  onPeriodChange: (index: number, period: number) => void;
}) {
  useDatabase();
  const { locale } = useLocale();
  const reports = createReports(branch, locale);
  return reports.map((report, index) => (
    <ReportCard key={report.key} report={report} period={periods[index] ?? 0} privacy={privacy} onPeriodChange={period => onPeriodChange(index, period)} />
  ));
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 13,
    marginBottom: 17,
    borderWidth: 1,
    borderRadius: 23,
    shadowColor: '#174F81',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  cardClip: { overflow: 'hidden', borderRadius: 22 },
  summary: { paddingTop: 20, paddingHorizontal: 19, paddingBottom: 15, gap: 15, overflow: 'hidden' },
  summaryCompact: { paddingTop: 17, paddingHorizontal: 15, paddingBottom: 13, gap: 13 },
  ring: { position: 'absolute', borderRadius: 120 },
  ringTop: { width: 174, height: 174, borderWidth: 23, borderColor: '#7FC2FA17', top: -98, right: -34 },
  ringBottom: { width: 214, height: 214, borderWidth: 37, left: -140, bottom: -173 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 22 },
  title: { fontFamily: Fonts.bold, fontSize: 14, flex: 1 },
  periodLabel: { fontFamily: Fonts.regular, fontSize: 11, flexShrink: 1, textAlign: 'right' },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  total: { flexShrink: 1, fontFamily: 'Montserrat-SemiBold', fontSize: 30, lineHeight: 38, letterSpacing: -1, fontVariant: ['tabular-nums', 'lining-nums'] },
  trend: { paddingVertical: 3, paddingHorizontal: 5, borderRadius: 7, borderWidth: 1, flexShrink: 0 },
  trendText: { fontFamily: 'Montserrat-Medium', fontSize: 10.5, lineHeight: 15, fontVariant: ['tabular-nums'] },
  periods: { flexDirection: 'row', gap: 4, padding: 4, borderWidth: 1, borderRadius: 14 },
  periodButton: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  periodText: { fontFamily: Fonts.regular, fontSize: 12 },
  plot: { marginHorizontal: 10, marginBottom: 10, paddingTop: 10, paddingHorizontal: 4, paddingBottom: 5, borderWidth: 1, borderRadius: 16 },
  plotCompact: { marginHorizontal: 8, marginBottom: 8 },
  pressed: { opacity: 0.7 },
});
