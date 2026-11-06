import { useDatabase } from '@/hooks/use-database';
import { getActiveUser, getUserBusinesses, getUserSystems } from '@/data/queries';
import { interpolate } from '@/utils/event-presentation';
import { ArrowLeft, Calculator, ChevronRight, IdCard, MessageCircle, MessageSquareText, Moon, Phone, ShoppingBasket, Smartphone, Sun, Utensils } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalizedText as Text } from '@/components/localized-text';
import { AppearancePreview } from '@/components/profile/appearance-preview';
import { SupportChat } from '@/components/profile/support-chat';
import { LANGUAGE_FLAGS } from '@/constants/language-flags';
import { Fonts, type getColors } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { NOTIFICATION_KEYS, usePreferences } from '@/context/PreferencesContext';
import { useTheme } from '@/context/ThemeContext';
import { LANGUAGES } from '@/i18n/translations';

const DETAIL_TITLES: Record<string, string> = {
  personal: 'profile.personal', business: 'profile.business', security: 'profile.security',
  systems: 'profile.systems', support: 'profile.support', notifications: 'profile.notifications',
  language: 'profile.language.title', appearance: 'profile.appearance.title', about: 'profile.about',
};
const businessIcons = { restaurant: Utensils, retail: ShoppingBasket, accounting: Calculator };
const systemNames = { restaurant_pos: 'Restoran POS', retail_inventory: 'Market və anbar', accounting: 'Mühasibatlıq' };

export default function ProfileDetailScreen() {
  useDatabase();
  const BUSINESSES = getUserBusinesses();
  const SYSTEMS = getUserSystems();
  const insets = useSafeAreaInsets();
  const { kind = 'personal' } = useLocalSearchParams<{ kind?: string }>();
  const { t, lang, setLang } = useLocale();
  const { colors, theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = usePreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fullName, setFullName] = useState(preferences.profile.name);
  const [email, setEmail] = useState(preferences.profile.email);
  const [phone, setPhone] = useState(preferences.profile.phone);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkProvider, setLinkProvider] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const rows = kind === 'business' ? BUSINESSES.map(business => ({
    id: business.id, Icon: businessIcons[business.type], name: business.name,
    sub: `${business.branchCount > 0 ? `${interpolate(t('{count} filial'), { count: business.branchCount })} · ` : ''}${t(business.role === 'owner' ? 'Biznes sahibi' : 'Rəhbər')}`,
  })) : SYSTEMS.map(system => ({
    id: system.id, Icon: businessIcons[system.business.type], name: systemNames[system.type], sub: t(system.business.name),
  }));

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/profile');
  const saveProfile = async () => {
    if (!fullName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFeedback('Məlumatları yoxlayın: ad və düzgün e-poçt tələb olunur.');
      return;
    }
    setSaving(true);
    const saved = await updatePreferences({ profile: { name: fullName.trim(), email: email.trim(), phone: phone.trim() } });
    setSaving(false);
    setFeedback(saved ? 'Yadda saxlanıldı.' : 'Yadda saxlamaq mümkün olmadı. Yenidən cəhd edin.');
  };
  const savePreference = async (update: Parameters<typeof updatePreferences>[0]) => {
    const saved = await updatePreferences(update);
    setFeedback(saved ? 'Bu cihazda yadda saxlanıldı.' : 'Yadda saxlamaq mümkün olmadı. Yenidən cəhd edin.');
  };
  const toggleRow = (label: string, sub: string, value: boolean, onChange: (value: boolean) => void, last = false) => (
    <View key={label} style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text><Text style={styles.sub}>{sub}</Text>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange}
        trackColor={{ false: '#64788D', true: '#176FBA' }} thumbColor="#FFFFFF" />
    </View>
  );

  if (kind === 'support' && chatOpen) {
    return <SupportChat messages={preferences.supportMessages}
      onSend={message => { void savePreference({ supportMessages: [...preferences.supportMessages, message] }); }}
      onBack={() => setChatOpen(false)} />;
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <View style={{ height: insets.top, backgroundColor: colors.header }} />
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: 18, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.detail.back')} onPress={goBack} style={styles.back}>
          <ArrowLeft size={18} color={colors.accent} /><Text style={styles.backText}>{t('profile.detail.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t(DETAIL_TITLES[kind] ?? 'profile.title')}</Text>
        {kind === 'personal' && <>
          <View style={styles.customer}>
            <View style={styles.customerIcon}><IdCard size={22} color={colors.accent} /></View>
            <View><Text style={styles.label}>{t('profile.personal.customerId')}</Text><Text style={styles.customerId}>{getActiveUser().id}</Text></View>
          </View>
          <View style={[styles.card, styles.fields]}>
            <Text style={styles.label}>{t('profile.personal.name')}</Text>
            <TextInput accessibilityLabel={t('profile.personal.name')} value={fullName} onChangeText={setFullName} style={styles.input} autoCapitalize="words" autoComplete="name" />
            <Text style={styles.label}>{t('profile.personal.email')}</Text>
            <TextInput accessibilityLabel={t('profile.personal.email')} value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Text style={styles.label}>{t('profile.personal.phone')}</Text>
            <TextInput accessibilityLabel={t('profile.personal.phone')} value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" autoComplete="tel" placeholder="+994 50 000 00 00" placeholderTextColor={colors.placeholder} />
          </View>
          <Pressable accessibilityRole="button" disabled={saving} onPress={saveProfile} style={[styles.primary, saving && styles.pressed]}>
            <Text style={styles.primaryText}>{t('profile.personal.save')}</Text>
          </Pressable>
        </>}
        {(kind === 'business' || kind === 'systems') && <>
          {kind === 'business' && <Text style={styles.intro}>{t('profile.business.intro')}</Text>}
          <View style={styles.card}>
            {rows.map(({ id, Icon, name, sub }, index) => (
              <View key={id} style={[styles.row, index < rows.length - 1 && styles.rowBorder]}>
                <View style={styles.icon}><Icon size={17} color={colors.accent} /></View>
                <View style={styles.copy}><Text style={styles.label}>{name}</Text><Text style={styles.sub}>{sub}</Text></View>
              </View>
            ))}
          </View>
        </>}
        {kind === 'security' && <>
          <View style={styles.card}>
            {toggleRow(t('profile.security.biometric'), t('profile.security.biometricSub'), preferences.biometric, value => { void savePreference({ biometric: value }); })}
            {toggleRow(t('profile.security.twoFactor'), t('profile.security.twoFactorSub'), preferences.twoFactor, value => { void savePreference({ twoFactor: value }); }, true)}
          </View>
          <Text style={styles.section}>{t('profile.security.linkedTitle')}</Text>
          <View style={styles.card}>
            {['Apple', 'Google'].map(provider => <View key={provider}>
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={[styles.label, styles.copy]}>{provider}</Text>
                <Text style={styles.value}>{t(provider === 'Google' ? 'profile.security.googleStatus' : 'profile.security.appleStatus')}</Text>
                {provider === 'Apple' && <Pressable accessibilityRole="button" accessibilityLabel={`${provider} · ${t('Qoş')}`} onPress={() => setLinkProvider(linkProvider === provider ? null : provider)} style={styles.link}>
                  <Text style={styles.linkText}>Qoş</Text>
                </Pressable>}
              </View>
              {linkProvider === provider && <View style={styles.confirm}>
                <Text style={styles.label}>Bu hesabı PROMAR-a qoşmaq istəyirsiniz?</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" style={styles.link} onPress={() => setLinkProvider(null)}><Text style={styles.linkText}>Ləğv et</Text></Pressable>
                  <Pressable accessibilityRole="button" style={styles.link} onPress={() => { setLinkProvider(null); setFeedback('Hesabın qoşulması üçün giriş xidməti konfiqurasiya edilməlidir.'); }}><Text style={styles.linkText}>Təsdiqlə</Text></Pressable>
                </View>
              </View>}
            </View>)}
            <View style={styles.row}><Text style={styles.label}>{t('profile.security.emailPass')}</Text><Text style={styles.value}>{t('profile.security.emailPassStatus')}</Text></View>
          </View>
          <Text style={styles.section}>{t('profile.security.deviceTitle')}</Text>
          <View style={styles.card}><View style={styles.row}>
            <View style={styles.icon}><Smartphone size={18} color={colors.accent} /></View>
            <View style={styles.copy}><Text style={styles.label}>{Device.modelName ?? t('profile.security.thisDevice')}</Text><Text style={styles.sub}>{t('profile.security.deviceReady')}</Text></View>
          </View></View>
          <Text style={[styles.sub, { marginTop: 14 }]}>Nümunə ayarlar: real biometrik və iki mərhələli giriş hələ qoşulmayıb.</Text>
        </>}
        {kind === 'support' && <View style={styles.card}>
          {[
            { label: 'WhatsApp', Icon: MessageCircle }, { label: 'Mesaj', Icon: MessageSquareText }, { label: 'Zəng', Icon: Phone },
          ].map(({ label, Icon }, index) => (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(label)} style={[styles.row, index < 2 && styles.rowBorder]}
              onPress={() => label === 'Mesaj' ? setChatOpen(true) : setFeedback('Dəstək nömrəsi hələ təyin edilməyib.')}>
              <View style={styles.icon}><Icon size={18} color={colors.accent} /></View>
              <Text style={[styles.label, styles.copy]}>{label}</Text><ChevronRight size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>}
        {kind === 'notifications' && <View style={styles.card}>
          {NOTIFICATION_KEYS.map((key, index) => toggleRow(
            t(`profile.notifications.${key}`), t(`profile.notifications.${key}Sub`), preferences.notifications[key],
            value => { void savePreference({ notifications: { ...preferences.notifications, [key]: value } }); },
            index === NOTIFICATION_KEYS.length - 1,
          ))}
        </View>}
        {kind === 'language' && <View>
          {LANGUAGES.map((language, index) => <Pressable key={language.code} accessibilityRole="radio"
            accessibilityState={{ checked: lang === language.code }} accessibilityLabel={language.label}
            onPress={() => setLang(language.code)} style={[styles.row, styles.languageRow, styles.rowBorder]}>
            <SvgXml xml={LANGUAGE_FLAGS[language.code]} width={28} height={21} />
            <Text style={[styles.languageLabel, styles.copy]}>{index === 0 ? 'Azərbaycan dili' : language.label}</Text>
            <View style={[styles.radio, lang === language.code && styles.radioSelected]}>{lang === language.code && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}</View>
          </Pressable>)}
        </View>}
        {kind === 'appearance' && <>
          <View style={styles.choices}>
            {(['light', 'dark'] as const).map(mode => {
              const Icon = mode === 'light' ? Sun : Moon;
              const selected = theme === mode;
              const foreground = mode === 'light' ? '#054F96' : '#E9F2FC';
              return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                accessibilityLabel={t(`profile.appearance.${mode}`)} onPress={() => setTheme(mode)}
                style={[styles.choice, { backgroundColor: mode === 'light' ? '#EAF5FF' : '#20334A', borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : 1 }]}>
                <Icon size={20} color={foreground} /><Text style={[styles.label, { color: foreground }]}>{t(`profile.appearance.${mode}`)}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={styles.caption}>{t('profile.appearance.caption')}</Text>
          <AppearancePreview />
        </>}
        {kind === 'about' && <View style={[styles.card, styles.fields]}>
          <Text style={styles.about}>PROMAR</Text><Text style={styles.intro}>{t('profile.about.body')}</Text>
        </View>}
        {!!feedback && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{t(feedback)}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.screenBg },
    body: { paddingHorizontal: 22 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
    backText: { color: colors.accent, fontFamily: Fonts.semibold, fontSize: 12 },
    title: { fontFamily: Fonts.bold, color: colors.textPrimary, fontSize: 21, marginTop: 10, marginBottom: 14 },
    card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 15, paddingHorizontal: 13 },
    fields: { padding: 14, gap: 8, marginTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 54, paddingVertical: 10 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    copy: { flex: 1 },
    label: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 12 },
    sub: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 11, marginTop: 4 },
    value: { color: colors.textSecondary, fontFamily: Fonts.medium, fontSize: 11, marginLeft: 'auto' },
    icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
    section: { color: colors.textSecondary, fontFamily: Fonts.bold, fontSize: 10, marginTop: 20, marginBottom: 8 },
    intro: { color: colors.textSecondary, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 20, marginBottom: 12 },
    input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.textPrimary, backgroundColor: colors.white, fontFamily: Fonts.regular, fontSize: 14, padding: 11, marginBottom: 4 },
    customer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 11, backgroundColor: colors.identity, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
    customerIcon: { backgroundColor: colors.white, borderRadius: 11, padding: 9 },
    customerId: { color: colors.accent, fontFamily: Fonts.semibold, fontSize: 18, marginTop: 3 },
    primary: { backgroundColor: colors.header, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginTop: 14 },
    primaryText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: 13 },
    feedback: { color: colors.accent, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 19, marginTop: 12 },
    link: { backgroundColor: colors.raised, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
    linkText: { color: colors.accent, fontFamily: Fonts.bold, fontSize: 12 },
    confirm: { paddingVertical: 12, gap: 10 },
    actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: colors.accent, backgroundColor: colors.raised },
    radioDot: { width: 12, height: 12, borderRadius: 6 },
    languageRow: { minHeight: 62, gap: 15 },
    languageLabel: { color: colors.textPrimary, fontFamily: Fonts.regular, fontSize: 12 },
    choices: { flexDirection: 'row', gap: 9, marginVertical: 10 },
    choice: { flex: 1, minHeight: 68, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 5 },
    caption: { color: colors.textPrimary, fontFamily: Fonts.semibold, fontSize: 12, marginBottom: 8 },
    about: { color: colors.accent, fontFamily: Fonts.bold, fontSize: 20 },
    pressed: { opacity: 0.6 },
  });
}
