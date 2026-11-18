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
import { NetworkBanner, NetworkToast } from '@/components/login/network-status';
import { AppleIcon, GoogleIcon, PhoneIcon } from '@/components/login/social-icons';
import { Fonts, getColors } from '@/constants/theme';
import { ApiError, loginWithPassword, type AuthResponse } from '@/data/api';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { signInWithGoogle } from '@/utils/google-auth';
import { finishLogin } from '@/utils/finish-login';
import { savePendingAuth } from '@/utils/pending-auth';

const HERO_ASPECT_RATIO = 737 / 477;

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const network = useNetworkStatus();

  // Pending accounts are remembered locally so every later launch opens the
  // approval screen instead of asking for the same credentials again.
  async function goPending(token: string, fallbackEmail: string | null, provider: string) {
    await savePendingAuth({ token, email: fallbackEmail, provider });
    router.replace('/pending_approval');
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Xəta', 'Zəhmət olmasa e-poçt və şifrəni daxil edin.');
      return;
    }
    if (!network.requireOnline()) return;

    setLoading(true);
    try {
      const data = await loginWithPassword(email, password);
      if (data.success && data.status === 'a') {
        await finishLogin(data.user);
      } else if (data.status === 'p') {
        if (data.pending_token) {
          await goPending(data.pending_token, data.email ?? email.trim(), 'password');
        } else {
          Alert.alert('Gözləyirik', data.message || 'Hesabınız admin təsdiqini gözləyir. Lütfən bir az gözləyin.');
        }
      } else if (data.status === 'r') {
        Alert.alert('Rədd edildi', 'Hesabınız rədd edilib. Əlaqə üçün administratora müraciət edin.');
      } else {
        Alert.alert('Xəta', data.message ?? 'E-poçt və ya şifrə yanlışdır.');
      }
    } catch (error) {
      const data = error instanceof ApiError ? error.data as AuthResponse | null : null;
      if (data?.status === 'p') {
        if (data.pending_token) {
          await goPending(data.pending_token, data.email ?? email.trim(), 'password');
        } else {
          Alert.alert('Gözləyirik', data.message || 'Hesabınız admin təsdiqini gözləyir.');
        }
      } else if (data?.status === 'r') {
        Alert.alert('Rədd edildi', data.message || 'Hesabınız rədd edilib.');
      } else if (error instanceof ApiError) {
        Alert.alert('Şəbəkə xətası', error.message);
      } else {
        network.showToast('network.toast.server');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!network.requireOnline()) return;

    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === 'cancelled') return;
      if (result.status === 'pending') {
        if (result.pendingToken) {
          await goPending(result.pendingToken, result.email ?? null, 'google');
        } else {
          Alert.alert('Gözləyirik', result.message);
        }
        return;
      }
      if (result.status === 'rejected') {
        Alert.alert('Rədd edildi', result.message);
        return;
      }
      await finishLogin(result.user);
    } catch (error) {
      Alert.alert('Google xətası', error instanceof Error ? error.message : 'Google ilə giriş alınmadı.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.statusBarFill, { height: insets.top }]} />
      <NetworkBanner phase={network.phase} onRetry={network.retry} />
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
              {/* Apple ilə giriş yalnız iOS-da göstərilir. */}
              {Platform.OS === 'ios' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Apple ilə davam edin")}
                  hitSlop={6}
                  onPress={() => Alert.alert('Apple ilə giriş', 'Apple ilə giriş hələ aktiv deyil. Zəhmət olmasa Google ilə daxil olun.')}
                  style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
                  <AppleIcon size={22} />
                </Pressable>
              )}
              {/* Google ilə giriş */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Google ilə davam edin")}
                disabled={googleLoading}
                hitSlop={6}
                onPress={() => { void handleGoogleLogin(); }}
                style={({ pressed }) => [styles.socialButton, (pressed || googleLoading) && styles.pressed]}>
                {googleLoading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <GoogleIcon size={22} />
                )}
              </Pressable>
              {/* Telefon ilə giriş mobil platformalarda (iOS + Android) göstərilir. */}
              {Platform.OS !== 'web' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Telefon ilə davam edin")}
                  hitSlop={6}
                  onPress={() => Alert.alert('SMS ilə giriş', 'SMS ilə giriş hələ aktiv deyil. Zəhmət olmasa Google ilə daxil olun.')}
                  style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
                  <PhoneIcon size={22} />
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <NetworkToast message={network.toast} bottom={Math.max(insets.bottom, 12) + 84} />
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
    backgroundColor: colors.white,
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
