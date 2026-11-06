import { ArrowLeft, ArrowUp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalizedText as Text } from '@/components/localized-text';
import { Fonts } from '@/constants/theme';
import { useLocale } from '@/context/LocaleContext';
import { useTheme } from '@/context/ThemeContext';

export function SupportChat({ messages, onSend, onBack }: {
  messages: string[];
  onSend: (message: string) => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const thread = useRef<ScrollViewInstance>(null);
  useEffect(() => { thread.current?.scrollToEnd({ animated: true }); }, [messages]);
  const send = () => {
    const message = draft.trim();
    if (!message) return;
    onSend(message);
    setDraft('');
  };
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.screenBg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Dəstəyə qayıt')} onPress={onBack} style={styles.back}>
          <ArrowLeft color="#FFFFFF" size={21} />
        </Pressable>
        <Text style={styles.title}>Dəstək çatı</Text>
        <View style={styles.back} />
      </View>
      <ScrollView ref={thread} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => thread.current?.scrollToEnd({ animated: true })}>
        <Text style={[styles.bubble, { backgroundColor: colors.white, color: colors.textPrimary }]}>Salam! Sizə necə kömək edə bilərik?</Text>
        {messages.map((message, index) => (
          <NativeText key={index} style={[styles.bubble, styles.user, { backgroundColor: colors.header }]}>{message}</NativeText>
        ))}
      </ScrollView>
      <View style={[styles.composer, { backgroundColor: colors.white, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <Text style={[styles.notice, { color: colors.textSecondary }]}>Mesaj bu cihazda saxlanıldı. Canlı dəstək hələ qoşulmayıb.</Text>
        <View style={styles.composeRow}>
          <TextInput value={draft} onChangeText={setDraft} multiline maxLength={2000}
            placeholder={t('Mesaj yazın…')} accessibilityLabel={t('Mesaj')}
            placeholderTextColor={colors.placeholder} style={[styles.input, { backgroundColor: colors.raised, color: colors.textPrimary, borderColor: colors.border }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('Göndər')} disabled={!draft.trim()} onPress={send}
            style={[styles.send, { backgroundColor: colors.header }, !draft.trim() && styles.disabled]}>
            <ArrowUp size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 14, gap: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', textAlign: 'center', fontFamily: Fonts.bold, fontSize: 19 },
  thread: { padding: 15, gap: 13 },
  bubble: { maxWidth: '94%', alignSelf: 'flex-start', borderRadius: 17, padding: 14, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 21 },
  user: { alignSelf: 'flex-end', color: '#FFFFFF', maxWidth: '86%' },
  composer: { borderTopWidth: 1, padding: 13, gap: 9 },
  notice: { fontFamily: Fonts.regular, fontSize: 10, lineHeight: 15 },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 16, minHeight: 46, maxHeight: 120, padding: 12, fontSize: 16, fontFamily: Fonts.regular },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
