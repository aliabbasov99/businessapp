import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon } from '@/components/login/back-icon';
import { Fonts, getColors } from '@/constants/theme';

const HERO_ASPECT_RATIO = 739 / 482;

export default function PhoneLoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/login');
  };

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

            <Pressable style={styles.back} hitSlop={8} onPress={goBack}>
              <BackIcon />
              <Text style={styles.backText}>Girişə qayıt</Text>
            </Pressable>

            <Text style={styles.title}>Telefon ilə giriş</Text>
            <Text style={styles.subtitle}>Nömrənizə gələn birdəfəlik kodla daxil olun.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Telefon nömrəsi</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="+994 50 000 00 00"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, focused && styles.inputFocused]}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={() =>
                router.push({ pathname: '/login_page_code', params: { phone: phone.trim() } })
              }>
              <Text style={styles.buttonText}>Kodu al</Text>
            </Pressable>
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
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
  },
  backText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    color: colors.brandLink,
  },
  title: {
    marginTop: 18,
    fontFamily: Fonts.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fieldGroup: {
    marginTop: 22,
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
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
  button: {
    height: 47,
    borderRadius: 12,
    marginTop: 22,
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
  pressed: {
    opacity: 0.7,
  },
});
