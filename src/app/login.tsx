import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import { Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppleIcon, PhoneIcon } from '@/components/login/social-icons';
import { Fonts, getColors } from '@/constants/theme';

const HERO_ASPECT_RATIO = 739 / 482;
const API_BASE = 'https://businessappapi.promar.workers.dev';

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Xəta', 'Zəhmət olmasa e-poçt və şifrəni daxil edin.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.status === 'a') {
        router.replace('/demo');
      } else if (data.status === 'p') {
        Alert.alert('Gözləyirik', 'Hesabınız admin təsdiqini gözləyir. Lütfən bir az gözləyin.');
      } else if (data.status === 'r') {
        Alert.alert('Rədd edildi', 'Hesabınız rədd edilib. Əlaqə üçün administratora müraciət edin.');
      } else {
        Alert.alert('Xəta', data.message ?? 'E-poçt və ya şifrə yanlışdır.');
      }
    } catch {
      Alert.alert('Şəbəkə xətası', 'Serverə qoşulmaq mümkün olmadı. İnternet bağlantınızı yoxlayın.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.statusBarFill, { height: insets.top }]} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 26) }]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.hero}>
            <Image
              source={require('@/assets/images/login-hero-v2.png')}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="PROMAR"
            />
          </View>

          <View style={styles.body}>
            <View style={styles.handle} />
            <Text style={styles.title}>Hesabınıza daxil olun</Text>

            <View style={styles.firstFieldGroup}>
              <Text style={styles.label}>E-poçt ünvanı</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder={t("ad@example.com")}
                placeholderTextColor={colors.placeholder}
                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Şifrə</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder={t("Şifrəniz")}
                  placeholderTextColor={colors.placeholder}
                  style={[styles.input, styles.passwordInput, focusedField === 'password' && styles.inputFocused]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(showPassword ? 'Şifrəni gizlət' : 'Şifrəni göstər')}
                  hitSlop={8}
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(v => !v)}>
                  {showPassword ? (
                    <EyeOff size={19} color={colors.textSecondary} strokeWidth={1.8} />
                  ) : (
                    <Eye size={19} color={colors.textSecondary} strokeWidth={1.8} />
                  )}
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.forgot} hitSlop={8} onPress={() => router.push('/forgot_password')}>
              <Text style={styles.forgotText}>Şifrəni unutmusunuz?</Text>
            </Pressable>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]}>
              {loading ? (
                <ActivityIndicator color={'#FFFFFF'} />
              ) : (
                <Text style={styles.buttonText}>Daxil ol</Text>
              )}
            </Pressable>

            <Text style={styles.or}>və ya davam edin</Text>

            <View style={styles.socials}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Apple ilə davam edin")}
                hitSlop={6}
                style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
                <AppleIcon size={22} />
              </Pressable>
              {/* Google ilə giriş müvəqqəti söndürülüb (native modul, Expo Go live test) — geri qaytarmaq üçün: @react-native-google-signin/google-signin + bu düyməni bərpa et */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Telefon ilə davam edin")}
                hitSlop={6}
                onPress={() => router.push('/login_page_phone')}
                style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
                <PhoneIcon size={22} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  statusBarFill: {
    width: '100%',
    backgroundColor: colors.brand,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  content: {
    flexGrow: 1,
    backgroundColor: colors.screenBg,
  },
  hero: {
    width: '100%',
    aspectRatio: HERO_ASPECT_RATIO,
    backgroundColor: colors.brand,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    flexGrow: 1,
    marginTop: -15,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.white,
    shadowColor: '#003C75',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 6,
  },
  handle: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: 32,
    height: 3,
    marginLeft: -16,
    borderRadius: 3,
    backgroundColor: '#C4DAEC',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  firstFieldGroup: {
    marginTop: 16,
  },
  fieldGroup: {
    marginTop: 2,
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    marginTop: 15,
    marginBottom: 6,
  },
  input: {
    height: 49,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    textAlignVertical: 'center',
    shadowColor: colors.inputShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 9,
    elevation: 2,
  },
  inputFocused: {
    borderColor: colors.brand,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 47,
  },
  eyeButton: {
    position: 'absolute',
    right: 6,
    height: 49,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgot: {
    alignSelf: 'flex-end',
    paddingVertical: 9,
    paddingLeft: 12,
  },
  forgotText: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.accent,
  },
  button: {
    height: 47,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  buttonText: {
    fontFamily: Fonts.semibold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  or: {
    marginTop: 23,
    marginBottom: 14,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  socials: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  socialButton: {
    width: 49,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: '#163D5E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
