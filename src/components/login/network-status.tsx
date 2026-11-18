import { CircleCheck, RefreshCw, WifiOff } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';
import type { NetworkStatusPhase } from '@/hooks/use-network-status';

type Palette = {
  background: string;
  ink: string;
  muted: string;
  border: string;
};

const LIGHT_OFFLINE: Palette = {
  background: '#FFF6E7',
  ink: '#875315',
  muted: '#986D37',
  border: '#F0DFC4',
};

const DARK_OFFLINE: Palette = {
  background: '#332C20',
  ink: '#F1CB8C',
  muted: '#D0B88F',
  border: '#514431',
};

const LIGHT_SUCCESS: Palette = {
  background: '#E8F6EE',
  ink: '#26734B',
  muted: '#26734B',
  border: 'transparent',
};

const DARK_SUCCESS: Palette = {
  background: '#193C35',
  ink: '#8FE1B8',
  muted: '#8FE1B8',
  border: 'transparent',
};

type NetworkBannerProps = {
  phase: NetworkStatusPhase;
  onRetry: () => void;
};

/**
 * Connection notice copied from the PROMAR prototype: amber when offline,
 * blue while checking and green for a moment after the connection returns.
 */
export function NetworkBanner({ phase, onRetry }: NetworkBannerProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLocale();

  if (phase === 'online') return null;

  const palette =
    phase === 'success'
      ? isDark
        ? DARK_SUCCESS
        : LIGHT_SUCCESS
      : phase === 'offline'
        ? isDark
          ? DARK_OFFLINE
          : LIGHT_OFFLINE
        : {
            background: colors.raised,
            ink: colors.accent,
            muted: colors.textSecondary,
            border: colors.border,
          };

  const titleKey =
    phase === 'success'
      ? 'network.success.title'
      : phase === 'checking'
        ? 'network.checking.title'
        : 'network.offline.title';
  const subtitleKey =
    phase === 'success'
      ? 'network.success.subtitle'
      : phase === 'checking'
        ? 'network.checking.subtitle'
        : 'network.offline.subtitle';

  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`${t(titleKey)}. ${t(subtitleKey)}`}
      style={[styles.banner, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
      <View style={styles.symbol}>
        {phase === 'checking' ? (
          <ActivityIndicator size="small" color={palette.ink} />
        ) : phase === 'success' ? (
          <CircleCheck size={20} color={palette.ink} strokeWidth={1.8} />
        ) : (
          <WifiOff size={20} color={palette.ink} strokeWidth={1.8} />
        )}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.ink }]}>{t(titleKey)}</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>{t(subtitleKey)}</Text>
      </View>

      {phase !== 'success' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('network.retry')}
          disabled={phase === 'checking'}
          hitSlop={4}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: palette.border },
            (pressed || phase === 'checking') && styles.retryDimmed,
          ]}>
          <RefreshCw size={17} color={palette.ink} strokeWidth={1.8} />
        </Pressable>
      )}
    </View>
  );
}

type NetworkToastProps = {
  message: string | null;
  bottom: number;
};

export function NetworkToast({ message, bottom }: NetworkToastProps) {
  const { isDark } = useTheme();
  const { t } = useLocale();

  if (!message) return null;

  const palette = isDark ? DARK_OFFLINE : LIGHT_OFFLINE;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        { bottom, backgroundColor: palette.background, borderColor: palette.border },
      ]}>
      <Text style={[styles.toastText, { color: palette.ink }]}>{t(message)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 2,
  },
  symbol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  retry: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
  },
  retryDimmed: {
    opacity: 0.55,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 70,
  },
  toastText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 19,
  },
});
