import { useDatabase } from '@/hooks/use-database';
import { getBranches } from '@/data/queries';
import type { BranchSelection } from '@/data/schema';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { LocalizedText as Text } from '@/components/localized-text';
import { useTheme } from '@/context/ThemeContext';
import { useLocale } from '@/context/LocaleContext';
import { Check, Layers2, Store, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, getColors } from '@/constants/theme';

export const getBranchOptions = () => [
  { id: null, title: 'Bütün filiallar', subtitle: 'Bütün filialların ümumi göstəriciləri', icon: 'layers' },
  ...getBranches().map(branch => ({ id: branch.id, title: branch.name, subtitle: 'Restoran filialı', icon: 'store' })),
];

export type BranchId = BranchSelection;

export function BranchSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: BranchId;
  onSelect: (id: BranchId) => void;
  onClose: () => void;
}) {
  useDatabase();
  const BRANCHES = getBranchOptions();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        accessibilityLabel={t("Bağla")}
        onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
          onPress={() => {}}
          accessibilityViewIsModal>
          <View style={styles.grabber} />

          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.heading}>Filial seçimi</Text>
              <Text style={styles.headingSub}>Restoranlarım · {BRANCHES.length - 1} filial</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Bağla")}
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              onPress={onClose}>
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.options}>
            {BRANCHES.map(branch => {
              const isSelected = branch.id === selected;
              return (
                <Pressable
                  key={branch.id ?? 'all'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={t(branch.title)}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    onSelect(branch.id);
                    onClose();
                  }}>
                  <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                    {branch.icon === 'layers' ? (
                      <Layers2 size={21} color={isSelected ? colors.brand : '#5F7C94'} strokeWidth={1.8} />
                    ) : (
                      <Store size={21} color={isSelected ? colors.brand : '#5F7C94'} strokeWidth={1.8} />
                    )}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{branch.title}</Text>
                    <Text style={styles.optionSub}>{branch.subtitle}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioChecked]}>
                    {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7,31,62,0.38)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    paddingTop: 12,
    paddingHorizontal: 18,
    shadowColor: '#061D3A',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.13,
    shadowRadius: 40,
    elevation: 24,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#C6D3DF',
    alignSelf: 'center',
    marginBottom: 18,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  headingCopy: {
    flexShrink: 1,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  headingSub: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    gap: 9,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 74,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionSelected: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionIconSelected: {
    backgroundColor: colors.raised,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  optionSub: {
    marginTop: 3,
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  radioChecked: {
    backgroundColor: colors.brand,
  },
  pressed: {
    opacity: 0.75,
  },
});
