import { usePreferences } from '@/context/PreferencesContext';
import { assistantReply } from '@/utils/assistant';
import { interpolate } from '@/utils/event-presentation';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import {
  ArrowLeft,
  ArrowUp,
  Building,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, getColors } from '@/constants/theme';

type ChatMessage = { role: 'assistant' | 'user'; text: string };

const SUGGESTIONS = ['Satışların icmalı', 'Kassa qalığı', 'Nələr diqqət tələb edir?'];

export function AiAgentOverlay({
  visible,
  branchLabel,
  onClose,
}: {
  visible: boolean;
  branchLabel: string;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t, locale } = useLocale();
  const { preferences: { profile } } = usePreferences();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    role: 'assistant', text: interpolate(t('Salam, {name}. Biznesinizlə bağlı nəyi bilmək istəyirsiniz?'), { name: profile.name.trim().split(/\s+/)[0] }),
  }]);
  const [draft, setDraft] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const threadRef = useRef<ScrollViewInstance>(null);

  const canSuggest = messages.length === 1;

  useEffect(() => {
    if (voiceMode) return;
    const t = setTimeout(() => threadRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, voiceMode]);

  const submit = (raw?: string) => {
    const value = (raw ?? draft).trim();
    if (!value) return;
    setMessages(prev => [...prev, { role: 'user', text: value }, { role: 'assistant', text: assistantReply(value, locale, t) }]);
    setDraft('');
  };

  const close = () => {
    setVoiceMode(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={[styles.top, { paddingTop: insets.top + 11 }]}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Geri qayıt")}
              style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              onPress={close}>
              <ArrowLeft size={20} color="#E1F1FF" strokeWidth={2} />
            </Pressable>

            <View style={styles.topCopy}>
              <Text style={styles.topTitle}>PROMAR AI</Text>
              <Text style={styles.topSubtitle}>Biznes köməkçiniz</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(voiceMode ? 'Yazışmaya qayıt' : 'Səsli danışıq')}
              style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              onPress={() => setVoiceMode(v => !v)}>
              {voiceMode ? (
                <Keyboard size={20} color="#E1F1FF" strokeWidth={1.8} />
              ) : (
                <Mic size={20} color="#E1F1FF" strokeWidth={1.8} />
              )}
            </Pressable>
          </View>

          <View style={styles.contextRow}>
            <Building size={13} color="#C9E4FA" strokeWidth={1.8} />
            <Text style={styles.contextText}>{branchLabel}</Text>
          </View>
        </View>

        {voiceMode ? (
          /* Voice mode */
          <View style={styles.voice}>
            <View style={styles.voiceCenter}>
              <View style={styles.orbRingOuter}>
                <View style={styles.orbRingInner}>
                  <View style={styles.orb}>
                    <Sparkles size={40} color="#FFFFFF" strokeWidth={1.8} />
                  </View>
                </View>
              </View>
              <Text style={styles.voiceTitle}>PROMAR AI</Text>
              <Text style={styles.voiceSubtitle}>Səsli söhbət</Text>
            </View>

            <View style={styles.voiceActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(muted ? 'Mikrofonu aç' : 'Mikrofonu söndür')}
                accessibilityState={{ selected: muted }}
                style={({ pressed }) => [
                  styles.voiceButton,
                  muted && styles.voiceButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setMuted(v => !v)}>
                {muted ? (
                  <MicOff size={21} color={colors.accent} strokeWidth={1.8} />
                ) : (
                  <Mic size={21} color={colors.accent} strokeWidth={1.8} />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Səsli söhbəti bitir")}
                style={({ pressed }) => [styles.voiceEnd, pressed && styles.pressed]}
                onPress={() => setVoiceMode(false)}>
                <PhoneOff size={22} color="#FFFFFF" strokeWidth={1.8} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Yazışmaya qayıt")}
                style={({ pressed }) => [styles.voiceButton, pressed && styles.pressed]}
                onPress={() => setVoiceMode(false)}>
                <Keyboard size={21} color={colors.accent} strokeWidth={1.8} />
              </Pressable>
            </View>
          </View>
        ) : (
          /* Chat mode */
          <View style={styles.chat}>
            <ScrollView
              ref={threadRef}
              style={styles.thread}
              contentContainerStyle={styles.threadContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {messages.map((message, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}>
                  <Text
                    style={[
                      styles.bubbleText,
                      message.role === 'user' && styles.bubbleTextUser,
                    ]}>
                    {message.text}
                  </Text>
                </View>
              ))}

              {canSuggest ? (
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map(text => (
                    <Pressable
                      key={text}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                      onPress={() => submit(text)}>
                      <Text style={styles.suggestionText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.compose, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.composeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Səsli danışıq")}
                  style={({ pressed }) => [styles.micButton, pressed && styles.pressed]}
                  onPress={() => setVoiceMode(true)}>
                  <Mic size={19} color={colors.accent} strokeWidth={1.8} />
                </Pressable>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("Mesajınızı yazın...")}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={styles.composeInput}
                  accessibilityLabel={t("AI agentinə mesaj")}
                  onSubmitEditing={() => submit()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Göndər")}
                  disabled={!draft.trim()}
                  style={({ pressed }) => [
                    styles.sendButton,
                    !draft.trim() && styles.sendButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => submit()}>
                  <ArrowUp size={18} color="#FFFFFF" strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  top: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCopy: {
    flex: 1,
    alignItems: 'center',
  },
  topTitle: {
    fontFamily: Fonts.bold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  topSubtitle: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#C4E1FB',
    textAlign: 'center',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 13,
  },
  contextText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#C9E4FA',
  },
  chat: {
    flex: 1,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: 16,
    paddingTop: 18,
  },
  bubble: {
    maxWidth: '94%',
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 11,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    borderBottomLeftRadius: 5,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: colors.brand,
    borderRadius: 17,
    borderBottomRightRadius: 5,
  },
  bubbleText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 6,
  },
  suggestion: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  suggestionText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: colors.accent,
  },
  compose: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 11,
    paddingHorizontal: 12,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    padding: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  micButton: {
    width: 36,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 46,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 3,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 3,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.raised,
  },
  voice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.screenBg,
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 22,
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  orbRingOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  orbRingInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.header,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#17629D',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  voiceTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  voiceSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 25,
  },
  voiceButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: colors.raised,
  },
  voiceEnd: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC5C5C',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
