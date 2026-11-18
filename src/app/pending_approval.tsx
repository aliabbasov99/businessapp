import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts, getColors } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { ApiError, checkPendingStatus, type AuthUser } from '@/data/api';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { finishLogin } from '@/utils/finish-login';
import { clearPendingAuth, getPendingAuth } from '@/utils/pending-auth';

const POLL_INTERVAL_MS = 8000;

type Phase = 'checking' | 'pending' | 'error' | 'expired';

/**
 * Shown while the account waits for admin approval. The screen is entered
 * automatically (from the intro) whenever a pending session exists, so the
 * user never has to sign in with the same account again — it polls the
 * Worker and logs in by itself the moment the admin approves.
 */
export default function PendingApprovalScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [approvedUser, setApprovedUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const aliveRef = useRef(true);

  const leaveToLogin = useCallback(async () => {
    stoppedRef.current = true;
    await clearPendingAuth();
    if (aliveRef.current) router.replace('/login');
  }, []);

  const runCheck = useCallback(async (token: string) => {
    if (busyRef.current || stoppedRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await checkPendingStatus(token);
      if (!aliveRef.current || stoppedRef.current) return;

      if (result.status === 'a') {
        // Approved: the token is consumed server-side, stop polling.
        stoppedRef.current = true;
        await clearPendingAuth();
        setApprovedUser(result.user ?? null);
        const ok = await finishLogin(result.user);
        if (!ok && aliveRef.current) {
          setPhase('error');
          setMessage('Məlumatlar yüklənmədi. İnternet bağlantınızı yoxlayın.');
        }
        return;
      }

      if (result.status === 'r') {
        stoppedRef.current = true;
        await clearPendingAuth();
        if (!aliveRef.current) return;
        Alert.alert('Rədd edildi', result.message || 'Hesabınız rədd edilib.');
        router.replace('/login');
        return;
      }

      if (result.status === 'expired') {
        stoppedRef.current = true;
        await clearPendingAuth();
        if (!aliveRef.current) return;
        setPhase('expired');
        setMessage(result.message || 'Giriş sessiyası bitib. Zəhmət olmasa yenidən daxil olun.');
        return;
      }

      if (result.email) setEmail(result.email);
      setPhase('pending');
      setMessage(result.message || 'Hesabınız admin təsdiqini gözləyir.');
    } catch (error) {
      if (!aliveRef.current || stoppedRef.current) return;
      setPhase('error');
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Yoxlamaq mümkün olmadı. İnternet bağlantınızı yoxlayın.',
      );
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    stoppedRef.current = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const record = await getPendingAuth();
      if (!aliveRef.current) return;
      if (!record) {
        router.replace('/login');
        return;
      }
      setEmail(record.email);
      await runCheck(record.token);
      if (aliveRef.current && !stoppedRef.current) {
        interval = setInterval(() => { void runCheck(record.token); }, POLL_INTERVAL_MS);
      }
    })();

    return () => {
      aliveRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [runCheck]);

  const handlePrimary = useCallback(async () => {
    if (busy) return;
    if (phase === 'expired') {
      await leaveToLogin();
      return;
    }
    if (approvedUser) {
      // The pending token was already consumed; just retry loading the data.
      setBusy(true);
      const ok = await finishLogin(approvedUser);
      setBusy(false);
      if (!ok) setMessage('Məlumatlar yüklənmədi. İnternet bağlantınızı yoxlayın.');
      return;
    }
    const record = await getPendingAuth();
    if (!record) {
      router.replace('/login');
      return;
    }
    await runCheck(record.token);
  }, [approvedUser, busy, leaveToLogin, phase, runCheck]);

  const title =
    phase === 'checking' ? 'Yoxlanılır…'
    : phase === 'expired' ? 'Sessiya bitdi'
    : phase === 'error' ? 'Xəta baş verdi'
    : 'Təsdiq gözlənilir';

  const body =
    phase === 'pending'
      ? 'Hesabınız admin təsdiqini gözləyir. Təsdiqləndikdən sonra avtomatik daxil olacaqsınız.'
      : message;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.statusBarFill, { height: insets.top }]} />
      <View style={styles.content}>
        <View style={styles.card}>
          {phase === 'checking' || phase === 'pending' ? (
            <ActivityIndicator size="large" color={colors.brand} />
          ) : null}

          <Text style={styles.title}>{title}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
          {body ? <Text style={styles.message}>{body}</Text> : null}

          {phase === 'error' || phase === 'expired' ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => { void handlePrimary(); }}
              style={({ pressed }) => [
                styles.primary,
                (pressed || busy) && styles.primaryPressed,
                busy && styles.primaryDisabled,
              ]}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{phase === 'expired' ? 'Daxil ol' : 'Yenidən cəhd et'}</Text>
              )}
            </Pressable>
          ) : null}

          {phase === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => { void leaveToLogin(); }}
              style={({ pressed }) => [styles.switchButton, pressed && styles.primaryPressed]}>
              <Text style={styles.switchText}>Başqa hesabla daxil ol</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    backgroundColor: colors.screenBg,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 22,
    paddingVertical: 30,
    shadowColor: '#163D5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 16,
  },
  email: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.brand,
    textAlign: 'center',
    marginTop: 6,
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  primary: {
    height: 46,
    minWidth: 190,
    paddingHorizontal: 26,
    marginTop: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryPressed: {
    opacity: 0.75,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: Fonts.semibold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  switchButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  switchText: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: colors.accent,
  },
});
