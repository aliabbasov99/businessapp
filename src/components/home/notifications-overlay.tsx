import { getById } from '@/data/database';
import { saveNotificationRead } from '@/data/api';
import { useDatabase } from '@/hooks/use-database';
import { dateKey, formatDate, formatTime } from '@/utils/format';
import { presentEvent } from '@/utils/event-presentation';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import { ArrowLeft, CheckCheck, Circle, Ellipsis, Search } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, getColors } from '@/constants/theme';

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

export function NotificationsOverlay({
  visible,
  onClose,
  onUnreadChange,
}: {
  visible: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const database = useDatabase();
  const items = useMemo(() => [...database.notifications].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id), [database.notifications]);
  const saving = useRef(false);
  const [saveError, setSaveError] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const unreadCount = items.filter(item => item.readAt === null).length;

  useEffect(() => {
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return items.map(item => ({
      ...item,
      ...presentEvent(getById(database.events, item.eventId), locale, t),
      date: formatDate(item.createdAt, locale),
      dayKey: dateKey(item.createdAt),
      time: formatTime(item.createdAt, locale),
    })).filter(
      item =>
        !q || normalize(`${item.title} ${item.body} ${item.date} ${item.time}`).includes(q),
    );
  }, [items, query, locale, t, database.events]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      if (!map.has(item.dayKey)) {
        map.set(item.dayKey, []);
        order.push(item.dayKey);
      }
      map.get(item.dayKey)!.push(item);
    }
    return order.map(key => ({ key, date: map.get(key)![0].date, items: map.get(key)! }));
  }, [filtered]);

  const updateRead = async (read: boolean, id?: number) => {
    if (saving.current) return;
    saving.current = true;
    setSaveError(false);
    try { await saveNotificationRead(read, id); }
    catch { setSaveError(true); }
    finally { saving.current = false; }
  };
  const setAllRead = (read: boolean) => { void updateRead(read); };
  const markRead = (id: number) => { void updateRead(true, id); };

  const close = () => {
    setMenuOpen(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}>
      <View style={styles.screen}>
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <View style={styles.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Geri qayıt")}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
              onPress={close}>
              <ArrowLeft size={21} color="#E4F3FF" strokeWidth={2} />
            </Pressable>
            <Text style={styles.navTitle}>Bildirişlər</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Bildiriş seçimləri")}
              accessibilityState={{ expanded: menuOpen }}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
              onPress={() => setMenuOpen(open => !open)}>
              <Ellipsis size={21} color="#E4F3FF" strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <Search size={19} color="#B9DAF6" strokeWidth={1.8} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("Axtar...")}
              placeholderTextColor="#BDDBF4"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t("Bildirişlərdə axtar")}
            />
          </View>

          {menuOpen ? (
            <View style={[styles.menu, { top: insets.top + 64 }]}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setAllRead(true);
                  setMenuOpen(false);
                }}>
                <CheckCheck size={17} color={colors.accent} strokeWidth={2} />
                <Text style={styles.menuItemText}>Hamısını oxunmuş say</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setAllRead(false);
                  setMenuOpen(false);
                }}>
                <Circle size={17} color={colors.accent} strokeWidth={2} />
                <Text style={styles.menuItemText}>Hamısını oxunmamış say</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {saveError ? <Text style={{ color: colors.trendDown, paddingHorizontal: 20 }}>Yadda saxlamaq mümkün olmadı. Yenidən cəhd edin.</Text> : null}
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {groups.map(group => (
            <View key={group.key} style={styles.dayGroup}>
              <Text style={styles.dayTitle}>{group.date}</Text>
              {group.items.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}${item.readAt === null ? ` · ${t('oxunmamış')}` : ''}`}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => markRead(item.id)}>
                  <Text style={styles.time}>{item.time}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  {item.readAt === null ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              ))}
            </View>
          ))}

          {groups.length === 0 ? (
            <Text style={styles.empty}>Bildiriş tapılmadı</Text>
          ) : null}
        </ScrollView>
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
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    fontSize: 20,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: '#FFFFFF',
    padding: 0,
  },
  menu: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 250,
    backgroundColor: colors.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    shadowColor: '#002B55',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  menuItemPressed: {
    backgroundColor: colors.raised,
  },
  menuItemText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  dayGroup: {},
  dayTitle: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 22,
    marginBottom: 11,
  },
  card: {
    position: 'relative',
    backgroundColor: colors.white,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    paddingRight: 34,
    paddingBottom: 18,
    marginBottom: 11,
    shadowColor: '#054F96',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
  },
  time: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 7,
  },
  cardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  unreadDot: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -3.5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ED5C54',
  },
  empty: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 46,
  },
  pressed: {
    opacity: 0.8,
  },
});
