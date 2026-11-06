import { useDatabase } from '@/hooks/use-database';
import { getOverviewCards } from '@/data/overview';
import { useLocale } from '@/context/LocaleContext';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts, getColors } from '@/constants/theme';
import { Image, StyleSheet, View } from 'react-native';

function Trend({ up, value }: { up: boolean; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.pctRow}>
      <Image source={up ? require('@/assets/icons/up.png') : require('@/assets/icons/down.png')} style={styles.trendIcon} />
      <Text style={up ? styles.pctUp : styles.pctDown}>{value}</Text>
    </View>
  );
}

function CardHeader({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.cardHeaderRow}>
      <View style={styles.headerLeft}>
        <Image source={icon} style={styles.cardIcon} />
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardTitleSub}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HeaderCard() {
  useDatabase();
  const styles = useThemedStyles(createStyles);
  const { locale } = useLocale();
  const icons = {
    dovriyye: require('@/assets/icons/dovri.png'), anbar: require('@/assets/icons/anbar.png'),
    techizatcilar: require('@/assets/icons/tech.png'), kassa: require('@/assets/icons/kassa.png'),
  };
  const cards = getOverviewCards();
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Image source={require('@/assets/images/promar-logo-horizontal-white.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>İcmal</Text>
        <View style={styles.filterRow}><Text style={styles.filterText}>Bütün filiallar</Text></View>
        <View style={styles.dividerLight} />
      </View>
      {[cards.slice(0, 2), cards.slice(2)].map((row, rowIndex) => (
        <View key={rowIndex} style={styles.cardsRow}>
          {row.map((card, index) => (
            <View key={card.key} style={[styles.card, index === 0 ? styles.cardLeft : styles.cardRight]}>
              <CardHeader icon={icons[card.key]} title={card.title} subtitle={card.main.label} />
              <View style={styles.mainRow}><View style={styles.mainCell}>
                <Text style={styles.mainValue}>{card.main.unit === 'money' ? formatMoney(card.main.value, locale) : formatNumber(card.main.value, locale)}</Text>
                <Trend up={card.main.changePercent >= 0} value={formatPercent(card.main.changePercent, locale)} />
              </View></View>
              <View style={styles.groupRow}>
                {card.details.map((metric, i) => (
                  <View key={metric.label} style={i === 0 ? styles.cellLeft : styles.cellRight}>
                    <Text style={styles.groupLabel}>{metric.label}</Text>
                    <Text style={styles.groupValue}>{formatMoney(metric.value, locale)}</Text>
                    <Trend up={metric.changePercent >= 0} value={formatPercent(metric.changePercent, locale)} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  wrap: { backgroundColor: colors.screenBg, width: '100%' },
  header: { backgroundColor: colors.header, paddingTop: 22, paddingHorizontal: 14 },
  logo: { width: 110, height: 24 },
  subtitle: { color: '#FFFFFF', fontFamily: Fonts.semibold, fontSize: 26, marginTop: 8 },
  filterRow: { marginTop: 4, flexDirection: 'row' },
  filterText: { color: '#FFFFFF', fontFamily: Fonts.regular, fontSize: 11.7 },
  dividerLight: { height: 4, backgroundColor: '#7EC1FA', marginTop: 10, marginHorizontal: -14 },
  cardsRow: { flexDirection: 'row', paddingHorizontal: 10, marginTop: 10, gap: 6 },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 4, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardLeft: { marginRight: 2 },
  cardRight: { marginLeft: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8, paddingVertical: 6 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardIcon: { width: 18, height: 18 },
  cardTitle: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 10.4 },
  cardTitleSub: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 9.1, marginTop: 1 },
  mainRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  mainCell: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  mainValue: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 15.6 },
  pctRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 },
  trendIcon: { width: 10, height: 10 },
  pctUp: { color: colors.trendUp, fontFamily: Fonts.medium, fontSize: 9.1 },
  pctDown: { color: colors.trendDown, fontFamily: Fonts.medium, fontSize: 9.1 },
  groupRow: { flexDirection: 'row' },
  cellLeft: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRightWidth: 1, borderRightColor: colors.border },
  cellRight: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  groupLabel: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 8.5 },
  groupValue: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 11.7, marginTop: 2 },
});
