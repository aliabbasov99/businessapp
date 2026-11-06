import { useEffect } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { loadDatabase } from '@/data/api';
import { useDatabaseSnapshot } from '@/hooks/use-database';
import { useDataSync } from '@/hooks/use-data-sync';
import { useTheme } from './ThemeContext';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useDatabaseSnapshot();
  const { phase } = useDataSync();
  const failed = phase === 'offline';
  const { colors } = useTheme();
  useEffect(() => {
    void loadDatabase();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void loadDatabase();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (phase !== 'offline') return;
    // Retry only while the app is visible; no background polling or extra native module.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void loadDatabase();
    }, 30000);
    return () => clearInterval(timer);
  }, [phase]);

  if (snapshot) return children;
  return (
    <View style={[styles.container, { backgroundColor: colors.screenBg }]}>
      {failed ? <>
        <Text style={[styles.message, { color: colors.textPrimary }]}>Bu cihazda yadda saxlanmış məlumat yoxdur. İlk yükləmə üçün serverə bağlantı lazımdır.</Text>
        <Pressable accessibilityRole="button" onPress={() => { void loadDatabase(); }} style={[styles.button, { backgroundColor: colors.brand }]}>
          <Text style={styles.buttonText}>Yenidən cəhd et</Text>
        </Pressable>
      </> : <>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={[styles.message, { color: colors.textSecondary }]}>Məlumatlar yüklənir…</Text>
      </>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 },
  message: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  button: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 16 },
});
