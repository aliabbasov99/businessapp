import { useDatabase } from '@/hooks/use-database';
import { getRecentSales, paymentLabel } from '@/data/queries';
import { formatMoney, formatTime } from '@/utils/format';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useLocale } from '@/context/LocaleContext';
import { Pressable, StyleSheet, View } from 'react-native';

import { Fonts, getColors } from '@/constants/theme';

export function RecentSales({ privacy }: { privacy: boolean }) {
  useDatabase();
  const SALES = getRecentSales();
  const styles = useThemedStyles(createStyles);
  const { t, locale } = useLocale();
  return (
    <View style={styles.wrap}>
      <View style={styles.list}>
        {SALES.map((sale) => (
          <Pressable
            key={sale.id}
            accessibilityRole="button"
            accessibilityLabel={`${t('Çek №')} ${sale.receiptNumber} · ${privacy ? '•••' : formatMoney(sale.amountMinor, locale)} · ${formatTime(sale.occurredAt, locale)}`}
            style={styles.row}
          >
            <View style={styles.left}>
              <Text style={styles.no}>Çek № {sale.receiptNumber}</Text>
              <Text style={styles.sub}>
                {formatTime(sale.occurredAt, locale)} · {t(paymentLabel(sale))}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.amount, sale.amountMinor < 0 && styles.amountNegative]}>
                {privacy ? '••• ₼' : formatMoney(sale.amountMinor, locale)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#054F96',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
  no: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  amount: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  amountNegative: {
    color: colors.trendDown,
  },
});
