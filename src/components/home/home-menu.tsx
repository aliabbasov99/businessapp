import { router } from 'expo-router';
import { Activity, ChartNoAxesCombined, Ellipsis, LayoutDashboard, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';

export type HomeTab = 'icmal' | 'hadiseler' | 'hesabatlar';
const AI_BUTTON_SIZE = 52;
const TABS = [
  { key: 'icmal', label: 'İcmal', Icon: LayoutDashboard },
  { key: 'hadiseler', label: 'Hadisələr', Icon: Activity },
  { key: 'hesabatlar', label: 'Hesabatlar', Icon: ChartNoAxesCombined },
  { key: 'profile', label: 'Daha çox', Icon: Ellipsis },
] as const;

export function HomeMenu({ active, onTabPress, onAiPress }: {
  active: HomeTab;
  onTabPress: (tab: HomeTab) => void;
  onAiPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLocale();
  const renderTab = ({ key, label, Icon }: (typeof TABS)[number]) => {
    const selected = active === key;
    const color = selected ? colors.accent : colors.textMuted;
    return (
      <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(label)}
        accessibilityState={{ selected }}
        onPress={() => key === 'profile' ? router.push('/profile') : onTabPress(key)}
        style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
        <View style={[styles.tab, selected && { backgroundColor: colors.identity }]}>
          <Icon size={20} color={color} strokeWidth={1.8} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, { color }]}>{label}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={[styles.barBackground, {
      backgroundColor: colors.white,
      borderTopColor: colors.border,
      paddingBottom: Math.max(insets.bottom, 16),
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <View style={styles.bar}>
        {renderTab(TABS[0])}{renderTab(TABS[1])}
        <View style={styles.cell}>
          <Pressable accessibilityRole="button" accessibilityLabel="PROMAR AI" onPress={onAiPress}
            style={({ pressed }) => [styles.ai, pressed && styles.pressed]}>
            <Svg pointerEvents="none" width={AI_BUTTON_SIZE} height={AI_BUTTON_SIZE} style={StyleSheet.absoluteFill}>
              <Defs><LinearGradient id="ai-menu-gradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#1786DC" /><Stop offset="1" stopColor="#054F96" />
              </LinearGradient></Defs>
              <Rect x={0.5} y={0.5} width={AI_BUTTON_SIZE - 1} height={AI_BUTTON_SIZE - 1}
                rx={(AI_BUTTON_SIZE - 1) / 2} fill="url(#ai-menu-gradient)" stroke="#FFFFFFAA" />
            </Svg>
            <Sparkles size={17} color="#FFFFFF" strokeWidth={1.8} />
            <Text style={styles.aiLabel}>AI</Text>
          </Pressable>
        </View>
        {renderTab(TABS[2])}{renderTab(TABS[3])}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barBackground: { borderTopWidth: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 10 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 54, width: '100%', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 14 },
  label: { fontFamily: Fonts.medium, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  ai: { width: AI_BUTTON_SIZE, height: AI_BUTTON_SIZE, marginTop: -12, borderRadius: AI_BUTTON_SIZE / 2, backgroundColor: '#054F96', alignItems: 'center', justifyContent: 'center', shadowColor: '#054F96', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 9, elevation: 5 },
  aiLabel: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 13, lineHeight: 15 },
  pressed: { opacity: 0.7 },
});
