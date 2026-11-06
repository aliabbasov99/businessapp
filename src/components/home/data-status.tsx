import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { useDataSync } from '@/hooks/use-data-sync';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import { loadDatabase } from '@/data/api';
import { Fonts } from '@/constants/theme';

export function DataStatus() {
  const { phase, savedAt, cacheAvailable } = useDataSync();
  const { colors } = useTheme();
  const { locale, t } = useLocale();
  if (phase === 'online' && cacheAvailable) return null;
  const offline = phase === 'offline';
  return (
    <View style={[styles.notice, { backgroundColor: colors.raised }]}>
      <View style={styles.copy}>
        <Text style={[styles.message, { color: colors.textPrimary }]}>
          {offline ? 'Oflayn · Son yadda qalan məlumatlar' : phase === 'online' ? 'Məlumatı cihazda saxlamaq mümkün olmadı' : 'Yadda qalan məlumatlar göstərilir · Yenilənir…'}
        </Text>
        {savedAt ? <Text style={[styles.date, { color: colors.textSecondary }]}>
          {t('Son yenilənmə')}: {new Date(savedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text> : null}
      </View>
      {offline ? <Pressable accessibilityRole="button" onPress={() => { void loadDatabase(); }} hitSlop={10}>
        <Text style={[styles.retry, { color: colors.brand }]}>Yenilə</Text>
      </Pressable> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 12 },
  copy: { flex: 1 },
  message: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 18 },
  date: { fontFamily: Fonts.regular, fontSize: 11, marginTop: 3 },
  retry: { fontFamily: Fonts.semibold, fontSize: 12 },
});
