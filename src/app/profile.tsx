import { useDatabase } from '@/hooks/use-database';
import {
  ArrowLeft, Bell, Building, ChevronRight, Headphones, Info,
  Languages, LogOut, Plug, ShieldCheck, SunMoon, UserRound,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { getUserBusinesses } from '@/data/queries';
import { useLocale } from '@/context/LocaleContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useTheme } from '@/context/ThemeContext';

function SettingRow({ Icon, label, value, kind, last }: {
  Icon: typeof Bell;
  label: string;
  value?: string;
  kind: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/profile_detail', params: { kind } })}
      style={({ pressed }) => [styles.settingRow, !last && {
        borderBottomWidth: 1, borderBottomColor: colors.divider,
      }, pressed && styles.pressed]}>
      <View style={[styles.settingIcon, { backgroundColor: colors.raised }]}>
        <Icon size={16} color={colors.accent} strokeWidth={1.8} />
      </View>
      <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
      {value ? <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      <ChevronRight size={15} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  useDatabase();
  const insets = useSafeAreaInsets();
  const { t, languageLabel } = useLocale();
  const { colors, isDark } = useTheme();
  const { preferences: { profile }, initials } = usePreferences();
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/demo');

  return (
    <View style={[styles.root, { backgroundColor: colors.screenBg }]}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 8 }]}>
        <Image source={require('@/assets/images/promar-logo-horizontal-white.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="PROMAR" />
        <View style={styles.titleRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('profile.back')}
            onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeft size={21} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{t('profile.title')}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.identity, { backgroundColor: colors.identity, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.raised }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.identityName, { color: colors.textPrimary }]}>{profile.name}</Text>
            <Text style={[styles.identityEmail, { color: colors.textSecondary }]}>{profile.email}</Text>
            <View style={[styles.role, { backgroundColor: colors.raised }]}>
              <Text style={[styles.roleText, { color: colors.accent }]}>{t('profile.identity.role')}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{t('profile.group.account')}</Text>
        <View style={[styles.group, { backgroundColor: colors.white, borderColor: colors.cardBorder }]}>
          <SettingRow Icon={UserRound} label={t('profile.personal')} kind="personal" />
          <SettingRow Icon={Building} label={t('profile.business')} value={String(getUserBusinesses().length)} kind="business" />
          <SettingRow Icon={ShieldCheck} label={t('profile.security')} kind="security" />
          <SettingRow Icon={Plug} label={t('profile.systems')} kind="systems" />
          <SettingRow Icon={Headphones} label={t('profile.support')} kind="support" last />
        </View>
        <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{t('profile.group.settings')}</Text>
        <View style={[styles.group, { backgroundColor: colors.white, borderColor: colors.cardBorder }]}>
          <SettingRow Icon={Bell} label={t('profile.notifications')} kind="notifications" />
          <SettingRow Icon={Languages} label={t('profile.language')} value={languageLabel} kind="language" />
          <SettingRow Icon={SunMoon} label={t('profile.appearance')} value={t(isDark ? 'profile.appearance.dark' : 'profile.appearance.light')} kind="appearance" />
          <SettingRow Icon={Info} label={t('profile.about')} kind="about" last />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.logout')}
          onPress={() => router.replace('/login')} style={({ pressed }) => [styles.logout, {
            backgroundColor: colors.white, borderColor: isDark ? '#76505A' : '#EFDCE0',
          }, pressed && styles.pressed]}>
          <LogOut size={17} color={colors.trendDown} />
          <Text style={[styles.logoutText, { color: colors.trendDown }]}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 16 },
  logo: { width: 122, height: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 9 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF29', borderRadius: 13, backgroundColor: '#FFFFFF16' },
  title: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 23, letterSpacing: -0.5 },
  body: { padding: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1, borderRadius: 17, marginBottom: 3 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.semibold, fontSize: 15 },
  identityCopy: { flex: 1 },
  identityName: { fontFamily: Fonts.bold, fontSize: 16 },
  identityEmail: { fontFamily: Fonts.regular, fontSize: 11, marginTop: 2 },
  role: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 5 },
  roleText: { fontFamily: Fonts.bold, fontSize: 10 },
  groupLabel: { fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.1, marginTop: 13, marginBottom: 6, marginHorizontal: 3 },
  group: { paddingHorizontal: 10, borderWidth: 1, borderRadius: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 47, paddingVertical: 7 },
  settingIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontFamily: Fonts.semibold, fontSize: 12 },
  settingValue: { fontFamily: Fonts.medium, fontSize: 10, maxWidth: '35%' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, borderWidth: 1, borderRadius: 12, marginTop: 13 },
  logoutText: { fontFamily: Fonts.bold, fontSize: 12 },
  pressed: { opacity: 0.7 },
});
